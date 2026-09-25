/**
 * Resume after deploy-mainnet-core RPC timeout — finish ownership → Multisig + save summary/ABIs.
 *
 * Set addresses in env or edit DEFAULTS below, then:
 *   npx hardhat run scripts/complete-mainnet-core.js --network bsc
 */
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');
const { loadContractsEnv, resolveMultisigSignersRaw } = require('./lib/loadContractsEnv');

loadContractsEnv();

const DEFAULTS = {
    raceMultiSig: '0x46aC99282929bb95B4362Aa06CbbAdecEC3D2e4B',
    raceCoin: '0x7603AaCDc5cB7aF15dBFA0a0B52e5Fd0337365c8',
    raceTreasury: '0xb8ad9eE82739B7cd420c847F6B32347E73791854',
    raceRewardVault: '0xb39f30932fcfC11d816F16A1619690498fA2295B',
    raceCommunityEngine: '0x4CC371a67EBc287978Ab8885D50021A28e9E49Bf',
    raceICO: '0x6E9c778841bF4037365A65a1F0ca413b49BaCe05',
    icoContract: '0xA473409De978d1F0D8BB9CB1A34cCe315D820Af4',
    raceRewardPriceOracle: '0xC05DC44304C8c0adBb1a3C2320be0DB41EC8D4ae',
    raceIncomeHold: '0xe0698e9D5a58977Ec57dd082F002e6c234b5F813',
    icoAdminWallet: '0x568B11c83A104c81c70cde58cCdbF4aa9c97b225',
    feeAdminWallet: '0x53fcf2f5569296478ce76C2e2977766B121D35E2',
    usdt: '0x55d398326f99059ff775485246999027b3197955',
    pancakeRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
};

async function maybeTransferOwnable(label, address, multiSig) {
    const c = await hre.ethers.getContractAt(
        ['function owner() view returns (address)', 'function transferOwnership(address)'],
        address,
    );
    const owner = await c.owner();
    const [signer] = await hre.ethers.getSigners();
    console.log(`${label} owner:`, owner);
    if (owner.toLowerCase() === multiSig.toLowerCase()) {
        console.log(`  already Multisig`);
        return;
    }
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        console.warn(`  skip — not deployer-owned (owner=${owner})`);
        return;
    }
    const tx = await c.transferOwnership(multiSig);
    await tx.wait();
    console.log(`  → Multisig OK`);
}

async function main() {
    const network = await hre.ethers.provider.getNetwork();
    if (Number(network.chainId) !== 56) throw new Error('mainnet only');

    const a = { ...DEFAULTS };
    const multiSig = a.raceMultiSig;
    const [deployer] = await hre.ethers.getSigners();
    console.log('Deployer:', deployer.address);
    console.log('MultiSig:', multiSig);

    const oracle = await hre.ethers.getContractAt('RaceRewardPriceOracle', a.raceRewardPriceOracle);
    const updater = (process.env.ORACLE_UPDATER || '').trim() || multiSig;
    try {
        const tx = await oracle.setUpdater(updater, true);
        await tx.wait();
        console.log('Oracle updater:', updater);
        if (updater.toLowerCase() !== deployer.address.toLowerCase()) {
            await (await oracle.setUpdater(deployer.address, false)).wait();
        }
    } catch (e) {
        console.warn('Oracle updater:', e.shortMessage || e.message);
    }

    await maybeTransferOwnable('Oracle', a.raceRewardPriceOracle, multiSig);
    await maybeTransferOwnable('Engine', a.raceCommunityEngine, multiSig);
    await maybeTransferOwnable('Treasury', a.raceTreasury, multiSig);
    await maybeTransferOwnable('RaceICO', a.raceICO, multiSig);
    await maybeTransferOwnable('ICOContract', a.icoContract, multiSig);
    await maybeTransferOwnable('Vault', a.raceRewardVault, multiSig);
    await maybeTransferOwnable('IncomeHold', a.raceIncomeHold, multiSig);
    await maybeTransferOwnable('RaceCoin', a.raceCoin, multiSig);

    const outDir = path.join(__dirname, '..', 'deployments', 'mainnet');
    fs.mkdirSync(outDir, { recursive: true });
    const abiDir = path.join(outDir, 'abi');
    fs.mkdirSync(abiDir, { recursive: true });
    for (const name of [
        'RaceCoin',
        'RaceMultiSig',
        'RaceICO',
        'ICOContract',
        'RaceCommunityEngine',
        'RaceRewardVault',
        'RaceIncomeHold',
        'RaceRewardPriceOracle',
        'RaceTreasury',
    ]) {
        const file = path.join(__dirname, '..', 'artifacts', 'src', `${name}.sol`, `${name}.json`);
        if (!fs.existsSync(file)) continue;
        const art = JSON.parse(fs.readFileSync(file, 'utf8'));
        fs.writeFileSync(path.join(abiDir, `${name}.json`), JSON.stringify({ contractName: name, abi: art.abi }, null, 2));
    }

    let signers = [];
    try {
        signers = resolveMultisigSignersRaw();
    } catch {
        /* ignore */
    }

    const summary = {
        network: 'bsc',
        chainId: 56,
        completedAt: new Date().toISOString(),
        deployer: deployer.address,
        ...a,
        multisigSigners: signers,
        notes: [
            'ICO USDT → icoAdminWallet',
            'IncomeHold fees → feeAdminWallet',
            'Admin: deposit 600k RACE into ICOContract, then Multisig startPhase(1)',
            'Keep 400k RACE for Pancake LP',
        ],
    };
    const summaryPath = path.join(outDir, 'core-deployment.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log('\n=== COMPLETE ===');
    console.log(JSON.stringify(summary, null, 2));
    console.log('Saved', summaryPath);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
