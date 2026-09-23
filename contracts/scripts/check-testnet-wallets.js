/**
 * TESTNET ONLY — wallet roles + balances. Never prints private keys.
 *
 *   npm run check:testnet-wallets
 */
const fs = require('fs');
const { ethers } = require('ethers');
const { ENV_PATH } = require('./lib/loadContractsEnv');
const {
    connectTestnetProvider,
    getBalanceSafe,
    getDeployerWallet,
    assertTestnetEnvFlags,
    resolveMultisigSignersRaw,
    resolveGovernanceMembersRaw,
    validateTestnetTokenConfig,
    redactRpc,
    envFirst,
} = require('./lib/testnetNetwork');

async function main() {
    if (!fs.existsSync(ENV_PATH)) {
        console.error('STOP: contracts/.env missing. Copy .env.example and fill TESTNET values.');
        process.exitCode = 1;
        return;
    }

    const { provider, rpc, chainId, blockNumber, flagErrors } = await connectTestnetProvider();
    const flags = assertTestnetEnvFlags({ requireConfirm: false });

    console.log('NETWORK RPC:', rpc ? redactRpc(rpc) : '(none)');
    console.log('CHAIN ID:', chainId);
    if (blockNumber != null) console.log('BLOCK:', blockNumber);
    console.log('DEPLOY_ENV:', flags.deployEnv);
    console.log('CONFIRM_TESTNET_DEPLOYMENT:', flags.confirm);

    if (flagErrors.length || !provider) {
        for (const e of flagErrors) console.error(e);
        process.exitCode = 1;
        return;
    }

    const { wallet, error } = getDeployerWallet(provider);
    if (error) {
        console.error('STOP:', error);
        process.exitCode = 1;
        return;
    }

    const rows = [];
    const push = async (role, address, required) => {
        let bal = 'n/a';
        let status = 'MISSING';
        if (address && !String(address).includes('...')) {
            try {
                const b = await getBalanceSafe(provider, address);
                bal = ethers.formatEther(b);
                status = Number(bal) > 0 ? 'OK' : required ? 'NO_GAS' : 'ZERO_OK';
            } catch {
                status = 'RPC_ERROR';
            }
        } else if (address && String(address).includes('...')) {
            status = 'PLACEHOLDER';
        }
        rows.push({ role, address: address || '—', bal, required, status });
    };

    await push('DEPLOYER', wallet.address, true);

    const ms = resolveMultisigSignersRaw();
    for (let i = 0; i < 5; i++) {
        await push(`MULTISIG_SIGNER_${i + 1}`, ms[i], true);
    }

    const gm = resolveGovernanceMembersRaw();
    for (let i = 0; i < 12; i++) {
        await push(`GOVERNANCE_MEMBER_${i + 1}`, gm[i], false);
    }

    await push('ORACLE_UPDATER', envFirst('ORACLE_UPDATER') || null, false);
    await push('ICO_ADMIN', envFirst('ICO_ADMIN_WALLET') || wallet.address, false);

    console.log('\nRole | Address | Native (tBNB) | Required | Status');
    for (const r of rows) {
        console.log(`${r.role} | ${r.address} | ${r.bal} | ${r.required} | ${r.status}`);
    }

    const dep = rows.find((r) => r.role === 'DEPLOYER');
    if (!dep || dep.status === 'NO_GAS' || dep.status === 'MISSING' || dep.status === 'RPC_ERROR') {
        console.error('\nSTOP: Deployer needs testnet tBNB (target ~0.2–0.3), or RPC failed.');
        process.exitCode = 1;
        return;
    }

    const badMs = rows.filter(
        (r) =>
            r.role.startsWith('MULTISIG_SIGNER_') &&
            (r.status === 'MISSING' || r.status === 'PLACEHOLDER'),
    );
    if (badMs.length) {
        console.error(
            '\nSTOP: Set MULTISIG_SIGNER_1..5 (or MULTISIG_SIGNERS csv) to 5 real testnet addresses.',
        );
        console.error('If private keys exist: npm run sync:testnet-multisig-signers');
        process.exitCode = 1;
        return;
    }

    const token = validateTestnetTokenConfig();
    console.log('\nUSDT:', token.usdt || '(missing)');
    console.log('PANCAKE_ROUTER:', token.router || '(missing)');
    if (token.errors.length) {
        console.warn('\nWARN (blocks deploy:testnet):');
        for (const e of token.errors) console.warn('-', e);
    }
    if (flags.errors.length) {
        console.warn('\nWARN (blocks deploy:testnet):');
        for (const e of flags.errors) console.warn('-', e);
    }

    console.log('\nWallet check finished. Private keys were not printed.');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
