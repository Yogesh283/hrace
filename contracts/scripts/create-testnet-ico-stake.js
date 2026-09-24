/**
 * One-shot: create ICO Buy&Stake on BSC Testnet (existing ICO + new Engine).
 *   DEPLOY_ENV=testnet npx hardhat run scripts/create-testnet-ico-stake.js --network bscTestnet
 */
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const { loadContractsEnv, envFirst, looksLikePlaceholderKey } = require('./lib/loadContractsEnv');

const MANIFEST = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'deployment.json');
const LOCK_180 = 180 * 24 * 60 * 60;
const BUY_USDT = hre.ethers.parseEther('50');

async function main() {
    loadContractsEnv();
    if (envFirst('DEPLOY_ENV') !== 'testnet') throw new Error('STOP: DEPLOY_ENV=testnet');
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) throw new Error('STOP: deployer key');

    const net = await hre.ethers.provider.getNetwork();
    if (Number(net.chainId) !== 97) throw new Error('STOP: not testnet');

    const d = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const [buyer] = await hre.ethers.getSigners();
    console.log('BUYER:', buyer.address);
    console.log('ICO:', d.raceICO);
    console.log('ENGINE:', d.raceCommunityEngine);

    const ico = await hre.ethers.getContractAt('RaceICO', d.raceICO, buyer);
    const engine = await hre.ethers.getContractAt('RaceCommunityEngine', d.raceCommunityEngine, buyer);
    const usdt = await hre.ethers.getContractAt('TestnetMockUSDT', d.usdt, buyer);

    const linked = await ico.stakingEngine();
    if (linked.toLowerCase() !== d.raceCommunityEngine.toLowerCase()) {
        throw new Error(`ICO stakingEngine mismatch: ${linked}`);
    }

    let bal = await usdt.balanceOf(buyer.address);
    if (bal < BUY_USDT) {
        console.log('Minting TEST-USDT…');
        await (await usdt.mint(buyer.address, hre.ethers.parseEther('200'))).wait();
        bal = await usdt.balanceOf(buyer.address);
    }
    console.log('USDT bal:', hre.ethers.formatEther(bal));

    const allowance = await usdt.allowance(buyer.address, d.raceICO);
    if (allowance < BUY_USDT) {
        console.log('Approving ICO…');
        await (await usdt.approve(d.raceICO, BUY_USDT * 10n)).wait();
    }

    // Ensure registered (referrer optional)
    try {
        const registered = await engine.isRegistered(buyer.address);
        if (!registered) {
            console.log('Registering on Engine…');
            await (await engine.register(hre.ethers.ZeroAddress)).wait();
        }
    } catch (e) {
        console.warn('register skip:', (e.shortMessage || e.message || '').slice(0, 120));
    }

    const stakesBefore = await engine.stakeCount(buyer.address);
    console.log('stakes before:', stakesBefore.toString());

    console.log('purchase(50 USDT, 180d)…');
    // Keep gasLimit modest — deployer often has low tBNB on testnet.
    let gasLimit = 2_500_000n;
    try {
        const est = await ico.purchase.estimateGas(BUY_USDT, LOCK_180);
        gasLimit = (est * 130n) / 100n;
        if (gasLimit < 1_500_000n) gasLimit = 1_500_000n;
        if (gasLimit > 4_000_000n) gasLimit = 4_000_000n;
        console.log('estimateGas', est.toString(), '→', gasLimit.toString());
    } catch (e) {
        console.warn('estimateGas failed, using', gasLimit.toString(), (e.shortMessage || e.message || '').slice(0, 100));
    }
    const fee = await buyer.provider.getFeeData();
    const gasPrice = fee.gasPrice || hre.ethers.parseUnits('3', 'gwei');
    const need = gasLimit * gasPrice;
    const native = await buyer.provider.getBalance(buyer.address);
    console.log('native', hre.ethers.formatEther(native), 'need~', hre.ethers.formatEther(need), 'gasPrice', gasPrice.toString());
    if (native < need) {
        throw new Error(`insufficient tBNB: have ${hre.ethers.formatEther(native)} need ~${hre.ethers.formatEther(need)}`);
    }
    const tx = await ico.purchase(BUY_USDT, LOCK_180, { gasLimit, gasPrice });
    console.log('tx:', tx.hash);
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error('purchase reverted');

    const stakesAfter = await engine.stakeCount(buyer.address);
    console.log('stakes after:', stakesAfter.toString());
    console.log('explorer: https://testnet.bscscan.com/tx/' + tx.hash);
    console.log('STAKE CREATE: PASS');
}

main().catch((e) => {
    console.error('STAKE CREATE: FAIL', e.shortMessage || e.message || e);
    process.exitCode = 1;
});
