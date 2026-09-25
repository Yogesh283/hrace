/**
 * Deploy RaceCoinBsc — totalSupply = MAX_SUPPLY (150M) so BscScan Max Total Supply = 15 Crore.
 * Transfers 1,000,000 to ICO_ADMIN; remainder → Multisig; ownership → Multisig.
 *
 *   npx hardhat run scripts/deploy-racecoin-bsc-fullsupply.js --network bsc
 */
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');
const { loadContractsEnv, looksLikePlaceholderKey } = require('./lib/loadContractsEnv');

loadContractsEnv();

async function main() {
    const network = await hre.ethers.provider.getNetwork();
    if (Number(network.chainId) !== 56) throw new Error('STOP: BSC mainnet only');
    if (process.env.DEPLOY_ENV !== 'mainnet' || process.env.CONFIRM_MAINNET_DEPLOYMENT !== 'YES') {
        throw new Error('STOP: DEPLOY_ENV=mainnet + CONFIRM_MAINNET_DEPLOYMENT=YES required');
    }
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        throw new Error('STOP: DEPLOYER_PRIVATE_KEY missing');
    }

    const [deployer] = await hre.ethers.getSigners();
    const icoAdmin = (process.env.ICO_ADMIN_WALLET || '').trim();
    if (!icoAdmin) throw new Error('STOP: ICO_ADMIN_WALLET required');

    const corePath = path.join(__dirname, '..', 'deployments', 'mainnet', 'core-deployment.json');
    let multiSig = (process.env.RACE_MULTISIG_CONTRACT || '').trim();
    if (fs.existsSync(corePath)) {
        const core = JSON.parse(fs.readFileSync(corePath, 'utf8'));
        if (core.raceMultiSig) multiSig = core.raceMultiSig;
    }
    // Prefer known good Multisig from first successful core deploy
    if (!multiSig || multiSig.toLowerCase() === '0x6e043a778fbd5b372bfb8a41746a42e2ede3c64a') {
        multiSig = '0x46aC99282929bb95B4362Aa06CbbAdecEC3D2e4B';
    }

    const bal = await hre.ethers.provider.getBalance(deployer.address);
    console.log('Deployer:', deployer.address);
    console.log('BNB:', hre.ethers.formatEther(bal));
    if (bal < hre.ethers.parseEther('0.002')) throw new Error('STOP: BNB too low');

    await hre.run('compile');
    const Factory = await hre.ethers.getContractFactory('RaceCoinBsc');
    const race = await Factory.deploy(
        deployer.address,
        deployer.address,
        deployer.address,
        deployer.address,
        deployer.address,
    );
    await race.waitForDeployment();
    const raceAddress = await race.getAddress();

    const max = await race.MAX_SUPPLY();
    const total = await race.totalSupply();
    const circulating = await race.INITIAL_CIRCULATING();
    console.log('RaceCoinBsc (NEW):', raceAddress);
    console.log('MAX_SUPPLY / totalSupply:', hre.ethers.formatEther(max), '/', hre.ethers.formatEther(total));

    if (total !== max) throw new Error('ASSERT: totalSupply must equal MAX_SUPPLY');

    // 10 Lakh → admin (ICO+LP bag)
    await (await race.transfer(icoAdmin, circulating)).wait();
    console.log('Transferred', hre.ethers.formatEther(circulating), '→ ICO admin', icoAdmin);

    // Remainder → Multisig (149M)
    const rest = await race.balanceOf(deployer.address);
    if (rest > 0n) {
        await (await race.transfer(multiSig, rest)).wait();
        console.log('Transferred', hre.ethers.formatEther(rest), '→ Multisig', multiSig);
    }

    await (await race.setFeeExempt(icoAdmin, true)).wait();
    await (await race.setFeeExempt(multiSig, true)).wait();
    await (await race.transferOwnership(multiSig)).wait();
    console.log('Ownership → Multisig');

    const outDir = path.join(__dirname, '..', 'deployments', 'mainnet');
    fs.mkdirSync(outDir, { recursive: true });
    const summary = {
        network: 'bsc',
        chainId: 56,
        deployedAt: new Date().toISOString(),
        contract: 'RaceCoinBsc',
        raceCoin: raceAddress,
        maxSupply: '150000000',
        totalSupply: '150000000',
        adminCirculating: '1000000',
        icoAdminWallet: icoAdmin,
        raceMultiSig: multiSig,
        bscscan: `https://bscscan.com/token/${raceAddress}`,
        note: 'totalSupply=150M for explorer Max Total Supply. Income must be paid from Multisig bag (no remaining mint room).',
    };
    fs.writeFileSync(path.join(outDir, 'racecoin-fullsupply.json'), JSON.stringify(summary, null, 2));

    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        let t = fs.readFileSync(envPath, 'utf8');
        const setKey = (k, v) => {
            const re = new RegExp('^' + k + '=.*$', 'm');
            if (re.test(t)) t = t.replace(re, k + '=' + v);
            else t = t.trimEnd() + '\n' + k + '=' + v + '\n';
        };
        setKey('RACE_TOKEN_CONTRACT', raceAddress);
        setKey('RACE_MULTISIG_CONTRACT', multiSig);
        fs.writeFileSync(envPath, t);
    }

    console.log('\n=== FULL-SUPPLY TOKEN DEPLOYED ===');
    console.log(JSON.stringify(summary, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
