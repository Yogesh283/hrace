/**
 * On-chain audit: every ICOStakeCreated vs CommunityReferralPaid in same tx.
 *
 *   cd contracts && node scripts/audit-ico-referrals-onchain.js
 */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const RPC = process.env.BSC_TESTNET_RPC || 'https://bsc-testnet.bnbchain.org';
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

const CHUNK = Number(process.env.AUDIT_LOG_CHUNK || 250);

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC, { chainId: 97, name: 't' }, { staticNetwork: true });
    const c = new ethers.Contract(ENGINE, abi, provider);
    const latest = await provider.getBlockNumber();
    console.log('ENGINE', ENGINE);
    console.log('SCAN', START, '->', latest);

    const stakes = [];
    for (let from = START; from <= latest; from += CHUNK) {
        const to = Math.min(from + CHUNK - 1, latest);
        const batch = await c.queryFilter(c.filters.ICOStakeCreated(), from, to);
        stakes.push(...batch);
        if (batch.length) console.log('blocks', from, to, 'stakes+', batch.length);
    }

    console.log('ICOStakeCreated_total', stakes.length);

    let ok = 0;
    let skipLow = 0;
    let missing = 0;
    const missingRows = [];

    for (const e of stakes) {
        const usdt = Number(ethers.formatEther(e.args.usdtPaid));
        const buyer = e.args.buyer;
        const tx = e.transactionHash;
        if (usdt < 50) {
            skipLow++;
            continue;
        }

        const receipt = await provider.getTransactionReceipt(tx);
        const iface = c.interface;
        let refCount = 0;
        const refs = [];
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== ENGINE.toLowerCase()) continue;
            try {
                const parsed = iface.parseLog(log);
                if (parsed.name === 'CommunityReferralPaid') {
                    refCount++;
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

        const referrer = await c.referrerOf(buyer);
        const sponsorActive = referrer !== ethers.ZeroAddress
            ? await c.isParticipationActive(referrer)
            : false;

        if (refCount > 0) {
            ok++;
        } else {
            missing++;
            missingRows.push({
                buyer,
                usdt,
                icoPurchaseId: e.args.icoPurchaseId.toString(),
                tx,
                block: e.blockNumber,
                referrer,
                sponsorActive,
            });
        }

        console.log(
            JSON.stringify({
                buyer,
                usdt,
                icoPurchaseId: e.args.icoPurchaseId.toString(),
                referralEvents: refCount,
                referrer,
                sponsorActive,
                tx,
            }),
        );
        for (const r of refs) {
            console.log('  REF', JSON.stringify(r));
        }
    }

    console.log('--- SUMMARY ---');
    console.log(JSON.stringify({ qualifying: ok + missing, ok, missing, below50: skipLow }, null, 2));
    if (missingRows.length) {
        console.log('--- MISSING REFERRAL PAYOUT ---');
        for (const row of missingRows) {
            console.log(JSON.stringify(row));
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
