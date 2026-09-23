/**
 * Deploy RaceIncomeVault — BSC Testnet only. Does NOT modify core contracts.
 *
 *   CONFIRM_INCOME_VAULT_DEPLOY=YES DEPLOY_ENV=testnet CONFIRM_TESTNET_DEPLOYMENT=YES \
 *   npx hardhat run scripts/deploy-income-vault-testnet.js --network bscTestnet
 */
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const { loadContractsEnv, envFirst } = require('./lib/loadContractsEnv');

const MANIFEST = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'deployment.json');
const OUT = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'income-vault.json');

async function main() {
    loadContractsEnv();
    const net = await hre.ethers.provider.getNetwork();
    const chainId = Number(net.chainId);
    if (chainId === 56) throw new Error('STOP: Mainnet forbidden');
    if (chainId !== 97) throw new Error(`STOP: chainId must be 97 (got ${chainId})`);
    if (envFirst('DEPLOY_ENV') !== 'testnet') throw new Error('STOP: DEPLOY_ENV=testnet required');
    if (envFirst('CONFIRM_TESTNET_DEPLOYMENT') !== 'YES') {
        throw new Error('STOP: CONFIRM_TESTNET_DEPLOYMENT=YES required');
    }
    if (envFirst('CONFIRM_INCOME_VAULT_DEPLOY') !== 'YES') {
        throw new Error('STOP: CONFIRM_INCOME_VAULT_DEPLOY=YES required');
    }

    if (!fs.existsSync(MANIFEST)) throw new Error('deployment.json missing');
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

    const settlementSigner = envFirst('INCOME_VAULT_SETTLEMENT_SIGNER');
    const adminFeeRecipient = envFirst('INCOME_VAULT_ADMIN_FEE_RECIPIENT') || manifest.raceMultiSig;
    const liquidityPool = envFirst('INCOME_VAULT_LIQUIDITY_POOL') || manifest.deployer;
    if (!settlementSigner) throw new Error('INCOME_VAULT_SETTLEMENT_SIGNER required');

    const [deployer] = await hre.ethers.getSigners();
    const RaceIncomeVault = await hre.ethers.getContractFactory('RaceIncomeVault');
    const vault = await RaceIncomeVault.deploy(
        deployer.address,
        manifest.usdt,
        settlementSigner,
        adminFeeRecipient,
        liquidityPool,
    );
    await vault.waitForDeployment();
    const address = await vault.getAddress();
    const deployTx = vault.deploymentTransaction()?.hash;

    const record = {
        network: 'bscTestnet',
        chainId: 97,
        raceIncomeVault: address,
        settlementToken: manifest.usdt,
        settlementSigner,
        adminFeeRecipient,
        incomeLiquidityPool: liquidityPool,
        deployer: deployer.address,
        deployTx,
        deployedAt: new Date().toISOString(),
        verificationStatus: 'PENDING_MANUAL_BSCSCAN',
        note: 'New income layer only — core RACE contracts unchanged.',
    };
    fs.writeFileSync(OUT, JSON.stringify(record, null, 2));
    console.log(JSON.stringify(record, null, 2));
}

main().catch((e) => {
    console.error('INCOME VAULT DEPLOY FAIL', e.message || e);
    process.exitCode = 1;
});
