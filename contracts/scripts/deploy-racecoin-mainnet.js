/**
 * Deploy a fresh RaceCoin on BSC mainnet (locked tokenomics).
 * MAX_SUPPLY=150M, INITIAL_MINT=1M → ICO_ADMIN_WALLET, ownership → Multisig.
 *
 *   npx hardhat run scripts/deploy-racecoin-mainnet.js --network bsc
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
        throw new Error('STOP: DEPLOY_ENV=mainnet and CONFIRM_MAINNET_DEPLOYMENT=YES required');
    }
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        throw new Error('STOP: DEPLOYER_PRIVATE_KEY missing');
    }

    const [deployer] = await hre.ethers.getSigners();
    const icoAdmin = (process.env.ICO_ADMIN_WALLET || '').trim();
    if (!icoAdmin) throw new Error('STOP: ICO_ADMIN_WALLET required');

    // Prefer last successful core Multisig if present
    const corePath = path.join(__dirname, '..', 'deployments', 'mainnet', 'core-deployment.json');
    let multiSig = (process.env.RACE_MULTISIG_CONTRACT || '').trim();
    if (fs.existsSync(corePath)) {
        const core = JSON.parse(fs.readFileSync(corePath, 'utf8'));
        if (core.raceMultiSig) multiSig = core.raceMultiSig;
    }
    if (!multiSig) throw new Error('STOP: RACE_MULTISIG_CONTRACT / core Multisig missing');

    const bal = await hre.ethers.provider.getBalance(deployer.address);
    console.log('Deployer:', deployer.address);
    console.log('BNB:', hre.ethers.formatEther(bal));
    if (bal < hre.ethers.parseEther('0.002')) {
        throw new Error('STOP: BNB too low for token deploy');
    }

    const RaceCoin = await hre.ethers.getContractFactory('RaceCoin');
    const race = await RaceCoin.deploy(
        deployer.address,
        deployer.address,
        deployer.address,
        deployer.address,
        deployer.address,
    );
    await race.waitForDeployment();
    const raceAddress = await race.getAddress();
    console.log('RaceCoin (NEW):', raceAddress);
    console.log('MAX_SUPPLY:', hre.ethers.formatEther(await race.MAX_SUPPLY()));
    console.log('totalSupply:', hre.ethers.formatEther(await race.totalSupply()));

    const initial = await race.INITIAL_MINT();
    if (icoAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
        await (await race.transfer(icoAdmin, initial)).wait();
        console.log('Transferred', hre.ethers.formatEther(initial), 'RACE →', icoAdmin);
    }

    await (await race.setFeeExempt(icoAdmin, true)).wait();
    await (await race.setFeeExempt(multiSig, true)).wait();
    await (await race.transferOwnership(multiSig)).wait();
    console.log('Ownership → Multisig:', multiSig);

    const outDir = path.join(__dirname, '..', 'deployments', 'mainnet');
    fs.mkdirSync(outDir, { recursive: true });
    const summary = {
        network: 'bsc',
        chainId: 56,
        deployedAt: new Date().toISOString(),
        raceCoin: raceAddress,
        maxSupply: '150000000',
        initialMint: '1000000',
        icoAdminWallet: icoAdmin,
        raceMultiSig: multiSig,
        note: 'ICO/Engine still point at previous token until core rewired or redeployed.',
    };
    fs.writeFileSync(path.join(outDir, 'racecoin-latest.json'), JSON.stringify(summary, null, 2));

    // Update contracts/.env pointer
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

    console.log('\n=== NEW TOKEN DEPLOYED ===');
    console.log(JSON.stringify(summary, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
