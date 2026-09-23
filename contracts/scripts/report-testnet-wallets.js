/**
 * TESTNET ONLY — role/address/tBNB report. Never prints private keys.
 *
 *   npm run report:testnet-wallets
 */
const { ethers } = require('ethers');
const {
    connectTestnetProvider,
    getDeployerWallet,
    resolveMultisigSignersRaw,
    resolveGovernanceMembersRaw,
    envFirst,
} = require('./lib/testnetNetwork');

async function main() {
    const { provider, rpc, chainId, flagErrors } = await connectTestnetProvider();
    console.log('RPC:', rpc);
    console.log('CHAIN ID:', chainId);
    if (flagErrors.length) {
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
    const add = async (role, address, needsGas) => {
        let bal = '—';
        let status = 'MISSING';
        if (address) {
            try {
                bal = ethers.formatEther(await provider.getBalance(address));
                const n = Number(bal);
                if (needsGas) status = n > 0 ? 'READY' : 'NO_GAS';
                else status = n > 0 ? 'FUNDED' : 'ZERO_OK';
            } catch {
                status = 'RPC_ERROR';
            }
        }
        rows.push({ role, address: address || '—', bal, needsGas, status });
    };

    await add('DEPLOYER', wallet.address, true);
    const ms = resolveMultisigSignersRaw();
    for (let i = 0; i < 5; i++) await add(`MULTISIG_SIGNER_${i + 1}`, ms[i], false);
    const gm = resolveGovernanceMembersRaw();
    for (let i = 0; i < 12; i++) await add(`GOVERNANCE_MEMBER_${i + 1}`, gm[i], false);
    await add('ORACLE_UPDATER', envFirst('ORACLE_UPDATER') || null, false);
    await add('ICO_ADMIN', envFirst('ICO_ADMIN_WALLET') || wallet.address, false);

    console.log('\nRole | Address | tBNB | Needs gas? | Status');
    for (const r of rows) {
        console.log(
            `${r.role}\n${r.address}\n${r.bal} tBNB\n${r.needsGas ? 'YES' : 'NO'}\n${r.status}\n`,
        );
    }
    console.log('Private keys were not printed.');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
