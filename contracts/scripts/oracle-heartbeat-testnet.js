/**
 * Refresh RaceRewardPriceOracle on BSC Testnet (fixes OracleStale 0x04578698 on ICO buy).
 *
 *   cd contracts
 *   set CONFIRM_TESTNET_DEPLOYMENT=YES
 *   set DEPLOY_ENV=testnet
 *   npx hardhat run scripts/oracle-heartbeat-testnet.js --network bscTestnet
 */
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const { loadContractsEnv, envFirst } = require('./lib/loadContractsEnv');

const DEPLOYMENT = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'deployment.json');

async function main() {
    loadContractsEnv();
    if (process.env.CONFIRM_TESTNET_DEPLOYMENT !== 'YES') {
        throw new Error('Set CONFIRM_TESTNET_DEPLOYMENT=YES');
    }

    const manifest = JSON.parse(fs.readFileSync(DEPLOYMENT, 'utf8'));
    const oracleAddr = manifest.raceRewardPriceOracle;
    if (!oracleAddr) {
        throw new Error('raceRewardPriceOracle missing in deployment.json');
    }

    const priceHuman = envFirst('ORACLE_PRICE_USDT', 'ORACLE_HEARTBEAT_PRICE') || '1';
    const priceWei = hre.ethers.parseEther(String(priceHuman));

    const oracle = await hre.ethers.getContractAt('RaceRewardPriceOracle', oracleAddr);
    const [signer] = await hre.ethers.getSigners();
    console.log('Oracle:', oracleAddr);
    console.log('Signer:', signer.address);
    console.log('updatePrice:', priceHuman, 'USDT per RACE');

    const tx = await oracle.updatePrice(priceWei);
    console.log('tx:', tx.hash);
    const rc = await tx.wait();
    console.log('status:', rc.status === 1 ? 'SUCCESS' : 'FAIL');
    const fresh = await oracle.racePriceUsdt();
    console.log('racePriceUsdt() OK:', hre.ethers.formatEther(fresh));
}

main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
});
