/**
 * On-chain audit: ICOStakeCreated vs CommunityReferralPaid in same tx.
 *
 * Full log scan (may hit RPC limits on free endpoints):
 *   AUDIT_LOG_CHUNK=25 BSC_TESTNET_RPC=https://bsc-testnet.publicnode.com node scripts/audit-ico-referrals-onchain.js
 *
 * Receipt-only (no eth_getLogs — use known stake tx hashes from PHP audit):
 *   AUDIT_TX_HASHES=0xabc...,0xdef... node scripts/audit-ico-referrals-onchain.js
 */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

function rpcUrlsFromEnv() {
    const raw = process.env.BSC_TESTNET_RPC || '';
    const list = raw
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.startsWith('http'));
    if (list.length > 0) {
        return list;
    }
    return [
        'https://bsc-testnet.publicnode.com',
        'https://data-seed-prebsc-1-s1.binance.org:8545',
        'https://data-seed-prebsc-2-s1.binance.org:8545',
        'https://bsc-testnet.bnbchain.org',
    ];
}

const RPC_URLS = rpcUrlsFromEnv();
const DEPLOY = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'deployment.json');
const manifest = JSON.parse(fs.readFileSync(DEPLOY, 'utf8'));
const ENGINE = manifest.raceCommunityEngine;
const START = Number(process.env.AUDIT_FROM_BLOCK || manifest.c1EngineRedeployBlock || 130944412);

const abi = [
    'event ICOStakeCreated(address indexed buyer, uint256 indexed stakeIndex, uint256 indexed icoPurchaseId, uint256 usdtPaid, uint256 raceAmount, uint256 lockPeriod, uint256 dailyRateBps, uint256 unlockAt)',
    'event CommunityReferralPaid(address indexed sponsor, address indexed from, uint256 level, uint256 usdtValue, uint256 racePaid)',
    'function referrerOf(address) view returns (address)',
    'function isParticipationActive(address) view returns (bool)',
];

const CHUNK = Math.max(5, Number(process.env.AUDIT_LOG_CHUNK || 25));
const SLEEP_MS = Math.max(0, Number(process.env.AUDIT_RPC_SLEEP_MS || 350));

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function isRateLimitError(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    const code = err?.error?.code ?? err?.code;
    return code === -32005 || msg.includes('limit exceeded') || msg.includes('rate limit');
}

function makeProvider(url) {
    return new ethers.JsonRpcProvider(url, { chainId: 97, name: 'bsc-testnet' }, { staticNetwork: true });
}

async function withRpcRotate(fn) {
    let lastErr;
    for (const url of RPC_URLS) {
        try {
            return await fn(makeProvider(url), url);
        } catch (e) {
            lastErr = e;
            if (!isRateLimitError(e)) {
                throw e;
            }
            console.warn('RPC rate limit, trying next endpoint:', url);
        }
    }
    throw lastErr;
}

async function queryFilterChunked(contract, filter, fromBlock, toBlock) {
    const stakes = [];
    let from = fromBlock;
    let chunk = CHUNK;

    while (from <= toBlock) {
        let to = Math.min(from + chunk - 1, toBlock);
        let done = false;
        while (!done) {
            try {
                const batch = await withRpcRotate(async (provider) => {
                    const c = contract.connect(provider);
                    return c.queryFilter(filter, from, to);
                });
                stakes.push(...batch);
                if (batch.length) {
                    console.log('blocks', from, to, 'stakes+', batch.length);
                }
                done = true;
                if (SLEEP_MS > 0) {
                    await sleep(SLEEP_MS);
                }
            } catch (e) {
                if (isRateLimitError(e) && chunk > 5) {
                    chunk = Math.max(5, Math.floor(chunk / 2));
                    to = Math.min(from + chunk - 1, toBlock);
                    console.warn('Shrinking log chunk to', chunk, 'for blocks', from, '-', to);
                    await sleep(800);
                    continue;
                }
                throw e;
            }
        }
        from = to + 1;
    }

    return stakes;
}

function parseStakeAndRefs(receipt, iface, engineLower) {
    let stake = null;
    const refs = [];
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== engineLower) {
            continue;
        }
        try {
            const parsed = iface.parseLog(log);
            if (parsed.name === 'ICOStakeCreated') {
                stake = parsed;
            }
            if (parsed.name === 'CommunityReferralPaid') {
                refs.push({
                    sponsor: parsed.args.sponsor,
                    level: parsed.args.level.toString(),
                    usdt: ethers.formatEther(parsed.args.usdtValue),
                    race: ethers.formatEther(parsed.args.racePaid),
                });
            }
        } catch {
            /* other events */
        }
    }
    return { stake, refs };
}

async function auditStakeEvent(provider, contract, e) {
    const usdt = Number(ethers.formatEther(e.args.usdtPaid));
    const buyer = e.args.buyer;
    const tx = e.transactionHash;
    const receipt = await provider.getTransactionReceipt(tx);
    const { refs } = parseStakeAndRefs(receipt, contract.interface, ENGINE.toLowerCase());
    const refCount = refs.length;

    const referrer = await contract.referrerOf(buyer);
    const sponsorActive =
        referrer !== ethers.ZeroAddress ? await contract.isParticipationActive(referrer) : false;

    return {
        buyer,
        usdt,
        icoPurchaseId: e.args.icoPurchaseId.toString(),
        referralEvents: refCount,
        referrer,
        sponsorActive,
        tx,
        refs,
        block: e.blockNumber,
    };
}

async function auditByTxHashes() {
    const raw = process.env.AUDIT_TX_HASHES || '';
    const hashes = raw
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^0x[a-f0-9]{64}$/.test(s));

    if (hashes.length === 0) {
        console.error('AUDIT_TX_HASHES: no valid tx hashes (0x + 64 hex chars).');
        process.exit(1);
    }

    console.log('MODE receipt-only (no eth_getLogs)');
    console.log('ENGINE', ENGINE);
    console.log('TX_COUNT', hashes.length);
    console.log('RPC', RPC_URLS.join(', '));

    let ok = 0;
    let missing = 0;
    let skipLow = 0;
    const missingRows = [];

    await withRpcRotate(async (provider) => {
        const c = new ethers.Contract(ENGINE, abi, provider);

        for (const tx of hashes) {
            const receipt = await provider.getTransactionReceipt(tx);
            if (!receipt) {
                console.log(JSON.stringify({ tx, status: 'RECEIPT_NOT_FOUND' }));
                continue;
            }
            const { stake, refs } = parseStakeAndRefs(receipt, c.interface, ENGINE.toLowerCase());
            if (!stake) {
                console.log(JSON.stringify({ tx, status: 'NO_ICO_STAKE_CREATED_IN_TX' }));
                continue;
            }

            const usdt = Number(ethers.formatEther(stake.args.usdtPaid));
            const buyer = stake.args.buyer;
            if (usdt < 50) {
                skipLow++;
                continue;
            }

            const referrer = await c.referrerOf(buyer);
            const sponsorActive =
                referrer !== ethers.ZeroAddress ? await c.isParticipationActive(referrer) : false;

            const row = {
                buyer,
                usdt,
                icoPurchaseId: stake.args.icoPurchaseId.toString(),
                referralEvents: refs.length,
                referrer,
                sponsorActive,
                tx,
            };
            console.log(JSON.stringify(row));
            for (const r of refs) {
                console.log('  REF', JSON.stringify(r));
            }

            if (refs.length > 0) {
                ok++;
            } else {
                missing++;
                missingRows.push({
                    ...row,
                    block: receipt.blockNumber,
                });
            }
            if (SLEEP_MS > 0) {
                await sleep(SLEEP_MS);
            }
        }
    });

    console.log('--- SUMMARY ---');
    console.log(JSON.stringify({ qualifying: ok + missing, ok, missing, below50: skipLow }, null, 2));
    if (missingRows.length) {
        console.log('--- MISSING REFERRAL PAYOUT ---');
        for (const row of missingRows) {
            console.log(JSON.stringify(row));
        }
    }
}

async function auditByLogScan() {
    const latest = await withRpcRotate((p) => p.getBlockNumber());
    console.log('MODE log-scan');
    console.log('ENGINE', ENGINE);
    console.log('SCAN', START, '->', latest);
    console.log('CHUNK', CHUNK, 'RPC', RPC_URLS.join(', '));

    const filterContract = new ethers.Contract(ENGINE, abi, makeProvider(RPC_URLS[0]));
    const stakes = await queryFilterChunked(
        filterContract,
        filterContract.filters.ICOStakeCreated(),
        START,
        latest,
    );

    console.log('ICOStakeCreated_total', stakes.length);

    let ok = 0;
    let skipLow = 0;
    let missing = 0;
    const missingRows = [];

    await withRpcRotate(async (provider) => {
        const c = new ethers.Contract(ENGINE, abi, provider);

        for (const e of stakes) {
            const usdt = Number(ethers.formatEther(e.args.usdtPaid));
            if (usdt < 50) {
                skipLow++;
                continue;
            }

            const row = await auditStakeEvent(provider, c, e);
            console.log(
                JSON.stringify({
                    buyer: row.buyer,
                    usdt: row.usdt,
                    icoPurchaseId: row.icoPurchaseId,
                    referralEvents: row.referralEvents,
                    referrer: row.referrer,
                    sponsorActive: row.sponsorActive,
                    tx: row.tx,
                }),
            );
            for (const r of row.refs) {
                console.log('  REF', JSON.stringify(r));
            }

            if (row.referralEvents > 0) {
                ok++;
            } else {
                missing++;
                missingRows.push({
                    buyer: row.buyer,
                    usdt: row.usdt,
                    icoPurchaseId: row.icoPurchaseId,
                    tx: row.tx,
                    block: row.block,
                    referrer: row.referrer,
                    sponsorActive: row.sponsorActive,
                });
            }
            if (SLEEP_MS > 0) {
                await sleep(SLEEP_MS);
            }
        }
    });

    console.log('--- SUMMARY ---');
    console.log(JSON.stringify({ qualifying: ok + missing, ok, missing, below50: skipLow }, null, 2));
    if (missingRows.length) {
        console.log('--- MISSING REFERRAL PAYOUT ---');
        for (const row of missingRows) {
            console.log(JSON.stringify(row));
        }
    }
}

async function main() {
    if (process.env.AUDIT_TX_HASHES && process.env.AUDIT_TX_HASHES.trim() !== '') {
        await auditByTxHashes();
        return;
    }
    await auditByLogScan();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
