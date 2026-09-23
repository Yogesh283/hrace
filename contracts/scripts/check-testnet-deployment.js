/**
 * Post-deploy check — loads deployments/bscTestnet/deployment.json
 * and verifies contracts respond on chain 97.
 *
 *   npm run check:testnet-deployment
 *
 * Never prints private keys. Does not modify contracts.
 */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { connectTestnetProvider, envFirst } = require('./lib/testnetNetwork');

const DEPLOYMENT_FILE = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'deployment.json');

const MINIMAL_ABI = [
    'function owner() view returns (address)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function totalSupply() view returns (uint256)',
    'function threshold() view returns (uint256)',
    'function getSigners() view returns (address[])',
    'function memberCount() view returns (uint256)',
    'function approvalThreshold() view returns (uint256)',
];

const KEYS = [
    ['RaceCoin', ['raceCoin', 'RaceCoin', 'race']],
    ['RaceMultiSig', ['raceMultiSig', 'multiSig', 'RaceMultiSig', 'multisig']],
    ['RaceGovernance', ['raceGovernance', 'governance', 'RaceGovernance']],
    ['RaceICO', ['raceICO', 'ico', 'RaceICO']],
    ['RaceCommunityEngine', ['raceCommunityEngine', 'engine', 'RaceCommunityEngine', 'communityEngine']],
    ['RaceRewardVault', ['raceRewardVault', 'vault', 'RaceRewardVault', 'rewardVault']],
    ['RaceRewardPriceOracle', ['raceRewardPriceOracle', 'oracle', 'RaceRewardPriceOracle', 'rewardOracle']],
    ['RaceTreasury', ['raceTreasury', 'treasury', 'RaceTreasury']],
    ['RaceDevelopmentTreasury', ['raceDevelopmentTreasury', 'developmentTreasury', 'RaceDevelopmentTreasury']],
    ['RaceMarketingTreasury', ['raceMarketingTreasury', 'marketingTreasury', 'RaceMarketingTreasury']],
    ['RaceOperationsTreasury', ['raceOperationsTreasury', 'operationsTreasury', 'RaceOperationsTreasury']],
    ['RaceLiquidityLocker', ['raceLiquidityLocker', 'locker', 'RaceLiquidityLocker', 'liquidityLocker']],
];

function pickAddress(doc, aliases) {
    for (const k of aliases) {
        if (doc[k] && typeof doc[k] === 'string' && doc[k].startsWith('0x')) return doc[k];
        if (doc.contracts && doc.contracts[k]) return doc.contracts[k];
        if (doc.addresses && doc.addresses[k]) return doc.addresses[k];
    }
    return null;
}

async function probe(provider, label, address) {
    if (!address) return { label, address: '—', status: 'MISSING_IN_JSON' };
    try {
        const code = await provider.getCode(address);
        if (!code || code === '0x') return { label, address, status: 'NO_CODE' };
        const c = new ethers.Contract(address, MINIMAL_ABI, provider);
        let extra = '';
        try {
            const n = await c.name();
            extra = ` name=${n}`;
        } catch {
            /* not ERC20 */
        }
        try {
            const o = await c.owner();
            extra += ` owner=${o}`;
        } catch {
            /* no owner */
        }
        try {
            const t = await c.threshold();
            extra += ` threshold=${t}`;
        } catch {
            /* n/a */
        }
        return { label, address, status: 'OK' + extra };
    } catch (e) {
        return { label, address, status: `ERROR: ${e.message}` };
    }
}

async function main() {
    if (!fs.existsSync(DEPLOYMENT_FILE)) {
        console.error('STOP: Missing', DEPLOYMENT_FILE);
        console.error('Run npm run deploy:testnet first (after preflight PASS).');
        process.exitCode = 1;
        return;
    }

    const doc = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf8'));
    const { provider, rpc, chainId, flagErrors } = await connectTestnetProvider();
    console.log('RPC:', rpc);
    console.log('CHAIN ID:', chainId);
    console.log('DEPLOYMENT FILE:', DEPLOYMENT_FILE);
    console.log('FILE network/chainId:', doc.network || doc.chainId || '(n/a)');

    if (flagErrors.length) {
        for (const e of flagErrors) console.error(e);
        process.exitCode = 1;
        return;
    }
    if (doc.chainId && Number(doc.chainId) !== 97) {
        console.error('STOP: deployment.json chainId is not 97');
        process.exitCode = 1;
        return;
    }

    const OPTIONAL_MISSING = new Set(['RaceGovernance', 'RaceLiquidityLocker']);

    console.log('\nContract | Address | Status');
    let fails = 0;
    for (const [label, aliases] of KEYS) {
        const addr = pickAddress(doc, aliases);
        const row = await probe(provider, label, addr);
        console.log(`${row.label} | ${row.address} | ${row.status}`);
        if (row.status.startsWith('ERROR') || row.status === 'NO_CODE') fails += 1;
        if (row.status === 'MISSING_IN_JSON') {
            if (OPTIONAL_MISSING.has(label)) {
                console.log('  (optional / not deployed yet)');
            } else {
                fails += 1;
            }
        }
    }

    if (fails) {
        console.error(`\nTESTNET DEPLOYMENT CHECK: FAIL (${fails} issues)`);
        process.exitCode = 1;
        return;
    }
    console.log('\nTESTNET DEPLOYMENT CHECK: PASS (addresses respond on chain 97)');
    console.log('This does NOT mean production ready.');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
