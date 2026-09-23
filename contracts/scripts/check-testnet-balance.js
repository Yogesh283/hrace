/**
 * TESTNET ONLY — deployer tBNB balance check.
 * Never prints private keys.
 *
 *   npm run check:testnet-balance
 */
const {
    connectTestnetProvider,
    getDeployerWallet,
    assertTestnetEnvFlags,
    classifyTbnb,
    readinessLabel,
    MIN_RECOMMENDED_TBNB,
    PREFERRED_TBNB,
    redactRpc,
} = require('./lib/testnetNetwork');
const { ethers } = require('ethers');

async function main() {
    const { provider, rpc, chainId, blockNumber, flagErrors } = await connectTestnetProvider();
    const flags = assertTestnetEnvFlags({ requireConfirm: false });

    console.log('NETWORK: BSC Testnet (expected)');
    console.log('RPC:', rpc ? redactRpc(rpc) : '(none)');
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

    const balWei = await provider.getBalance(wallet.address);
    const bal = ethers.formatEther(balWei);
    const tier = classifyTbnb(bal);

    console.log('DEPLOYER ADDRESS:', wallet.address);
    console.log('tBNB BALANCE:', bal);
    console.log('BALANCE TIER:', tier);
    console.log('RECOMMENDED MIN:', MIN_RECOMMENDED_TBNB, 'tBNB');
    console.log('PREFERRED:', PREFERRED_TBNB, 'tBNB');
    console.log('DEPLOYMENT READINESS:', readinessLabel(tier));
    console.log(
        'NOTE: Tier is advisory — exact gas depends on network conditions; not a hard gas guarantee.',
    );

    if (tier === 'ZERO') {
        console.error('\nSTOP: Deployer tBNB balance is 0. Get testnet tBNB before deploy.');
        process.exitCode = 1;
        return;
    }
    if (tier === 'LOW') {
        console.warn(
            `\nWARN: Balance below recommended ${MIN_RECOMMENDED_TBNB} tBNB. Deploy may still work; prefer ≥ ${PREFERRED_TBNB}.`,
        );
    }

    if (flags.errors.length) {
        console.warn('\nENV WARNINGS (required before deploy:testnet):');
        for (const e of flags.errors) console.warn('-', e);
    }

    console.log('\nBalance check finished. Private keys were not printed.');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
