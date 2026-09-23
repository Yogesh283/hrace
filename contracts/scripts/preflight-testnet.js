/**
 * TESTNET PREFLIGHT — must PASS before deploy:testnet.
 * Never prints private keys. Does not deploy.
 *
 *   npm run preflight:testnet
 */
const fs = require('fs');
const { ethers } = require('ethers');
const {
    connectTestnetProvider,
    getDeployerWallet,
    assertTestnetEnvFlags,
    parseUniqueAddresses,
    classifyTbnb,
    readinessLabel,
    validateTestnetTokenConfig,
    resolveMultisigSignersRaw,
    resolveGovernanceMembersRaw,
    envFirst,
    loadContractsEnv,
} = require('./lib/testnetNetwork');
const { ENV_PATH } = require('./lib/loadContractsEnv');

async function main() {
    if (!fs.existsSync(ENV_PATH)) {
        console.error('STOP: contracts/.env missing');
        process.exitCode = 1;
        return;
    }

    const { provider, rpc, chainId, flagErrors } = await connectTestnetProvider();
    const flags = assertTestnetEnvFlags({ requireConfirm: true });
    const token = validateTestnetTokenConfig();
    const errors = [...flagErrors, ...flags.errors, ...token.errors];

    const { wallet, error: depErr } = getDeployerWallet(provider);
    if (depErr) errors.push(depErr);

    let deployer = '—';
    let bal = '—';
    let tier = 'ZERO';
    if (wallet) {
        deployer = wallet.address;
        bal = ethers.formatEther(await provider.getBalance(wallet.address));
        tier = classifyTbnb(bal);
        if (tier === 'ZERO') errors.push('Deployer tBNB balance is 0');
    }

    const ms = parseUniqueAddresses(resolveMultisigSignersRaw(), {
        label: 'MULTISIG_SIGNERS',
        exactCount: 5,
    });
    errors.push(...ms.errors);

    const gmRaw = resolveGovernanceMembersRaw();
    let govStatus = 'OPTIONAL (unset)';
    if (gmRaw.length) {
        const gm = parseUniqueAddresses(gmRaw, {
            label: 'GOVERNANCE_MEMBERS',
            minCount: 10,
            maxCount: 12,
        });
        errors.push(...gm.errors);
        const thr = Number(envFirst('GOVERNANCE_THRESHOLD') || '7');
        if (gm.list.length && (!Number.isInteger(thr) || thr * 2 <= gm.list.length || thr > gm.list.length)) {
            errors.push(`Invalid GOVERNANCE_THRESHOLD=${thr} for ${gm.list.length} members`);
        }
        govStatus = gm.errors.length ? 'FAIL' : 'PASS';
    }

    const oracle = envFirst('ORACLE_UPDATER');
    if (oracle) {
        try {
            const a = ethers.getAddress(oracle);
            if (a === ethers.ZeroAddress) errors.push('ORACLE_UPDATER is zero address');
        } catch {
            errors.push('ORACLE_UPDATER malformed');
        }
    }

    const icoAdmin = envFirst('ICO_ADMIN_WALLET') || deployer;
    if (icoAdmin && icoAdmin !== '—') {
        try {
            ethers.getAddress(icoAdmin);
        } catch {
            errors.push('ICO_ADMIN_WALLET malformed');
        }
    }

    const msPass = ms.errors.length === 0 && ms.list.length === 5;
    const envPass = flags.errors.length === 0;
    const netPass = flagErrors.length === 0 && chainId === 97;
    const tokenPass = token.errors.length === 0;

    console.log('TESTNET PREFLIGHT');
    console.log('=================');
    console.log('RPC:', rpc);
    console.log('Chain ID:', chainId);
    console.log('DEPLOY_ENV:', flags.deployEnv);
    console.log('CONFIRM_TESTNET_DEPLOYMENT:', flags.confirm);
    console.log('Deployer:', deployer);
    console.log('tBNB:', bal, `(${tier}) — ${readinessLabel(tier)}`);
    console.log('USDT:', token.usdt || '(missing)');
    console.log('PANCAKE_ROUTER:', token.router || '(missing)');
    console.log('Multisig signers:', msPass ? 'PASS' : 'FAIL');
    console.log('Governance members:', govStatus);
    console.log('Environment confirmation:', envPass ? 'PASS' : 'FAIL');
    console.log('Network safety:', netPass ? 'PASS' : 'FAIL');
    console.log('Token/router safety:', tokenPass ? 'PASS' : 'FAIL');

    if (errors.length) {
        console.error('\nBLOCKERS:');
        for (const e of errors) console.error('-', e);
        console.error('\nTESTNET PREFLIGHT: FAIL');
        console.error('Do not start contract deployment until fixed.');
        process.exitCode = 1;
        return;
    }

    if (tier === 'LOW') {
        console.warn('\nWARN: tBNB below recommended 0.20 — deploy not blocked, but prefer ≥ 0.30.');
    }

    console.log('\nREADY FOR TESTNET DEPLOYMENT');
    console.log('TESTNET PREFLIGHT: PASS');
    console.log('Private keys were not printed.');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
