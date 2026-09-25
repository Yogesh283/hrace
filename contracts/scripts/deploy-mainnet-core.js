/**
 * MAINNET CORE DEPLOY — Token + MultiSig + ICO + Staking (Engine) only.
 * Rest (vesting, governance UI, LP locker) later.
 *
 * Env (contracts/.env):
 *   DEPLOY_ENV=mainnet
 *   CONFIRM_MAINNET_DEPLOYMENT=YES
 *   EXPECTED_CHAIN_ID=56
 *   MULTISIG_SIGNERS=0x...,0x...,0x...,0x...,0x...
 *   ICO_ADMIN_WALLET=0x...          // ICO USDT proceeds
 *   FEE_ADMIN_WALLET=0x...          // IncomeHold $1 / 1% USDT fees
 *   RACE_REWARD_PRICE_USDT=0.05
 *   HARDEN_GOVERNANCE=1
 *   EXISTING_RACE_TOKEN=0x...       // optional; only used if bytecode exists
 *
 *   npm run deploy:mainnet-core
 */
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');
const {
    loadContractsEnv,
    looksLikePlaceholderKey,
    resolveUsdt,
    resolvePancakeRouter,
    resolveMultisigSignersRaw,
} = require('./lib/loadContractsEnv');

loadContractsEnv();

const MAINNET_USDT = '0x55d398326f99059ff775485246999027b3197955';
const MAINNET_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

const ABI_NAMES = [
    'RaceCoin',
    'RaceMultiSig',
    'RaceICO',
    'ICOContract',
    'RaceCommunityEngine',
    'RaceRewardVault',
    'RaceIncomeHold',
    'RaceRewardPriceOracle',
    'RaceTreasury',
];

function exportAbis(outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const artifactsRoot = path.join(__dirname, '..', 'artifacts', 'src');
    for (const name of ABI_NAMES) {
        const candidates = [
            path.join(artifactsRoot, `${name}.sol`, `${name}.json`),
            path.join(artifactsRoot, 'interfaces', `I${name}.sol`, `I${name}.json`),
        ];
        const file = candidates.find((f) => fs.existsSync(f));
        if (!file) {
            console.warn('ABI skip (not found):', name);
            continue;
        }
        const art = JSON.parse(fs.readFileSync(file, 'utf8'));
        const out = path.join(outDir, `${name}.json`);
        fs.writeFileSync(
            out,
            JSON.stringify({ contractName: name, abi: art.abi, bytecode: art.bytecode }, null, 2),
        );
        console.log('ABI →', out);
    }
}

async function main() {
    const accounts = await hre.ethers.getSigners();
    const deployer = accounts[0];
    const network = await hre.ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    console.log('Deployer:', deployer.address);
    console.log('Chain ID:', chainId);

    if (chainId !== 56) {
        throw new Error(`STOP: Expected BSC mainnet 56, got ${chainId}`);
    }
    if (process.env.DEPLOY_ENV !== 'mainnet') {
        throw new Error('STOP: DEPLOY_ENV=mainnet required');
    }
    if (process.env.CONFIRM_MAINNET_DEPLOYMENT !== 'YES') {
        throw new Error('STOP: CONFIRM_MAINNET_DEPLOYMENT=YES required');
    }
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        throw new Error('STOP: DEPLOYER_PRIVATE_KEY missing');
    }

    const icoAdminWallet = (process.env.ICO_ADMIN_WALLET || '').trim();
    const feeAdminWallet = (process.env.FEE_ADMIN_WALLET || process.env.ICO_ADMIN_WALLET || '').trim();
    if (!icoAdminWallet) throw new Error('STOP: ICO_ADMIN_WALLET required (ICO USDT receiver)');
    if (!feeAdminWallet) throw new Error('STOP: FEE_ADMIN_WALLET required (admin $1/1% fees)');

    const price = process.env.RACE_REWARD_PRICE_USDT;
    if (!price || String(price).trim() === '1') {
        throw new Error('STOP: RACE_REWARD_PRICE_USDT must be real (not 1)');
    }

    let signers = resolveMultisigSignersRaw();
    if (signers.length !== 5) {
        throw new Error(`STOP: need 5 MULTISIG_SIGNERS, got ${signers.length}`);
    }
    signers = signers.map((a) => hre.ethers.getAddress(a));

    const usdt = MAINNET_USDT;
    const pancakeRouter = MAINNET_ROUTER;

    const bal = await hre.ethers.provider.getBalance(deployer.address);
    console.log('Deployer BNB:', hre.ethers.formatEther(bal));
    if (bal < hre.ethers.parseEther('0.01')) {
        throw new Error(
            `STOP: Deployer BNB too low (${hre.ethers.formatEther(bal)}). Send ≥ 0.05 BNB to ${deployer.address} (safer buffer).`,
        );
    }
    if (bal < hre.ethers.parseEther('0.05')) {
        console.warn(
            `WARN: Only ${hre.ethers.formatEther(bal)} BNB — proceeding at current low gas; top up if txs start failing.`,
        );
    }

    // ── MultiSig ───────────────────────────────────────────────────────────
    const RaceMultiSig = await hre.ethers.getContractFactory('RaceMultiSig');
    const multiSig = await RaceMultiSig.deploy(signers);
    await multiSig.waitForDeployment();
    const multiSigAddress = await multiSig.getAddress();
    console.log('RaceMultiSig:', multiSigAddress);

    // ── Token (existing only if bytecode present) ──────────────────────────
    let raceAddress;
    let raceCoin;
    const existing = (process.env.EXISTING_RACE_TOKEN || process.env.RACE_TOKEN_CONTRACT || '').trim();
    if (existing) {
        const code = await hre.ethers.provider.getCode(existing);
        if (!code || code === '0x') {
            console.warn(
                `WARN: EXISTING_RACE_TOKEN ${existing} has NO bytecode on chain ${chainId} — deploying NEW RaceCoin.`,
            );
        } else {
            raceAddress = hre.ethers.getAddress(existing);
            raceCoin = await hre.ethers.getContractAt('RaceCoin', raceAddress);
            console.log('Using existing RaceCoin:', raceAddress);
        }
    }
    if (!raceAddress) {
        const RaceCoin = await hre.ethers.getContractFactory('RaceCoin');
        // constructor needs fee recipients — use deployer placeholders then update
        raceCoin = await RaceCoin.deploy(
            deployer.address,
            deployer.address,
            deployer.address,
            deployer.address,
            deployer.address,
        );
        await raceCoin.waitForDeployment();
        raceAddress = await raceCoin.getAddress();
        console.log('RaceCoin (NEW):', raceAddress);
        console.log('INITIAL_MINT 1,000,000 → deployer; move 6L to ICO admin after wire');
    }

    // ── Treasury (maturity fee destination) ────────────────────────────────
    const RaceTreasury = await hre.ethers.getContractFactory('RaceTreasury');
    const treasury = await RaceTreasury.deploy(deployer.address, raceAddress, multiSigAddress);
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();
    await (await treasury.lockMultisig()).wait();
    console.log('RaceTreasury:', treasuryAddress);

    // ── Reward vault + Engine (staking) ────────────────────────────────────
    const RaceRewardVault = await hre.ethers.getContractFactory('RaceRewardVault');
    const rewardVault = await RaceRewardVault.deploy(deployer.address, raceAddress);
    await rewardVault.waitForDeployment();
    const rewardVaultAddress = await rewardVault.getAddress();
    console.log('RaceRewardVault:', rewardVaultAddress);

    const RaceCommunityEngine = await hre.ethers.getContractFactory('RaceCommunityEngine');
    const communityEngine = await RaceCommunityEngine.deploy(
        deployer.address,
        usdt,
        raceAddress,
        pancakeRouter,
        rewardVaultAddress,
    );
    await communityEngine.waitForDeployment();
    const communityEngineAddress = await communityEngine.getAddress();
    console.log('RaceCommunityEngine (staking):', communityEngineAddress);
    await (await rewardVault.setEngine(communityEngineAddress)).wait();

    // ── ICO ────────────────────────────────────────────────────────────────
    const RaceICO = await hre.ethers.getContractFactory('RaceICO');
    const raceIco = await RaceICO.deploy(deployer.address, raceAddress, usdt, icoAdminWallet);
    await raceIco.waitForDeployment();
    const raceIcoAddress = await raceIco.getAddress();
    console.log('RaceICO:', raceIcoAddress);
    console.log('ICO USDT →', icoAdminWallet);

    const ICOContract = await hre.ethers.getContractFactory('ICOContract');
    const icoReserve = await ICOContract.deploy(deployer.address, raceAddress, icoAdminWallet);
    await icoReserve.waitForDeployment();
    const icoReserveAddress = await icoReserve.getAddress();
    await (await icoReserve.setRaceIco(raceIcoAddress)).wait();
    await (await raceIco.setIcoReserve(icoReserveAddress)).wait();
    await (await raceIco.setStakingEngine(communityEngineAddress)).wait();
    await (await communityEngine.setIcoContract(raceIcoAddress)).wait();
    console.log('ICOContract (reserve):', icoReserveAddress);

    // ── Oracle + IncomeHold ────────────────────────────────────────────────
    const initialPrice = hre.ethers.parseEther(String(price));
    const RaceRewardPriceOracle = await hre.ethers.getContractFactory('RaceRewardPriceOracle');
    const oracle = await RaceRewardPriceOracle.deploy(
        deployer.address,
        initialPrice,
        24 * 60 * 60,
        hre.ethers.parseEther(process.env.RACE_REWARD_PRICE_MIN || '0.01'),
        hre.ethers.parseEther(process.env.RACE_REWARD_PRICE_MAX || '100'),
    );
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    await (await communityEngine.setRewardPriceOracle(oracleAddress)).wait();
    console.log('RaceRewardPriceOracle:', oracleAddress, `@ $${price}`);

    const RaceIncomeHold = await hre.ethers.getContractFactory('RaceIncomeHold');
    const incomeHold = await RaceIncomeHold.deploy(
        deployer.address,
        raceAddress,
        usdt,
        feeAdminWallet,
        oracleAddress,
    );
    await incomeHold.waitForDeployment();
    const incomeHoldAddress = await incomeHold.getAddress();
    await (await incomeHold.setVault(rewardVaultAddress)).wait();
    await (await incomeHold.setEngine(communityEngineAddress)).wait();
    await (await rewardVault.setIncomeHold(incomeHoldAddress)).wait();
    await (await communityEngine.setIncomeHold(incomeHoldAddress)).wait();
    console.log('RaceIncomeHold:', incomeHoldAddress);
    console.log('Admin fees ($1 / 1%) →', feeAdminWallet);

    // ── Locks ──────────────────────────────────────────────────────────────
    await (await incomeHold.lockCreditors()).wait();
    await (await rewardVault.lockWiring()).wait();
    await (await communityEngine.lockIncomeHold()).wait();
    await (await communityEngine.setMaturityTreasury(treasuryAddress)).wait();
    await (await communityEngine.lockMaturityTreasury()).wait();
    await (await communityEngine.lockIcoContract()).wait();
    await (await communityEngine.lockRewardPriceOracle()).wait();
    await (await raceIco.lockStakingEngine()).wait();
    await (await raceIco.lockIcoReserve()).wait();
    await (await icoReserve.lockRaceIco()).wait();
    console.log('Security locks applied');

    // ── Fee exempt + minter ────────────────────────────────────────────────
    const feeExempt = [
        communityEngineAddress,
        rewardVaultAddress,
        raceIcoAddress,
        icoReserveAddress,
        incomeHoldAddress,
        treasuryAddress,
        multiSigAddress,
        icoAdminWallet,
        feeAdminWallet,
    ];
    for (const account of feeExempt) {
        try {
            await (await raceCoin.setFeeExempt(account, true)).wait();
        } catch (e) {
            console.warn('setFeeExempt failed (need token owner):', account, e.shortMessage || e.message);
        }
    }
    try {
        await (await raceCoin.setMinter(rewardVaultAddress, true)).wait();
        console.log('Minter enabled: RaceRewardVault');
    } catch (e) {
        console.warn(
            'STOP-WARN: setMinter failed — token owner must call setMinter(RewardVault, true):',
            e.shortMessage || e.message,
        );
    }

    // Move INITIAL_MINT to ICO admin when we minted fresh token
    try {
        const initialMint = await raceCoin.INITIAL_MINT();
        const depBal = await raceCoin.balanceOf(deployer.address);
        if (depBal >= initialMint && icoAdminWallet.toLowerCase() !== deployer.address.toLowerCase()) {
            await (await raceCoin.transfer(icoAdminWallet, initialMint)).wait();
            console.log('Transferred 1,000,000 RACE → ICO_ADMIN_WALLET (deposit 600k reserve + keep 400k LP)');
        }
    } catch (e) {
        console.warn('INITIAL_MINT transfer skipped:', e.shortMessage || e.message);
    }

    // ── Harden ownership → Multisig ────────────────────────────────────────
    const harden =
        process.env.HARDEN_GOVERNANCE === '1' || process.env.HARDEN_GOVERNANCE === 'true';
    const oracleUpdater = (process.env.ORACLE_UPDATER || '').trim() || multiSigAddress;
    await (await oracle.setUpdater(oracleUpdater, true)).wait();
    if (harden) {
        if (oracleUpdater.toLowerCase() !== deployer.address.toLowerCase()) {
            await (await oracle.setUpdater(deployer.address, false)).wait();
        }
        await (await oracle.transferOwnership(multiSigAddress)).wait();
        await (await communityEngine.transferOwnership(multiSigAddress)).wait();
        await (await treasury.transferOwnership(multiSigAddress)).wait();
        await (await raceIco.transferOwnership(multiSigAddress)).wait();
        await (await icoReserve.transferOwnership(multiSigAddress)).wait();
        await (await rewardVault.transferOwnership(multiSigAddress)).wait();
        await (await incomeHold.transferOwnership(multiSigAddress)).wait();
        try {
            await (await raceCoin.transferOwnership(multiSigAddress)).wait();
        } catch (e) {
            console.warn('RaceCoin ownership transfer failed (maybe already Multisig):', e.shortMessage || e.message);
        }
        console.log('Ownership → MultiSig (3-of-5)');
    }

    const outDir = path.join(__dirname, '..', 'deployments', 'mainnet');
    fs.mkdirSync(outDir, { recursive: true });
    exportAbis(path.join(outDir, 'abi'));

    const summary = {
        network: 'bsc',
        chainId: 56,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        raceCoin: raceAddress,
        raceMultiSig: multiSigAddress,
        multisigSigners: signers,
        raceICO: raceIcoAddress,
        icoContract: icoReserveAddress,
        icoAdminWallet,
        feeAdminWallet,
        raceCommunityEngine: communityEngineAddress,
        raceRewardVault: rewardVaultAddress,
        raceIncomeHold: incomeHoldAddress,
        raceRewardPriceOracle: oracleAddress,
        raceTreasury: treasuryAddress,
        usdt,
        pancakeRouter,
        raceRewardPriceUsdt: price,
        notes: [
            'ICO USDT → icoAdminWallet',
            'IncomeHold admin fees → feeAdminWallet',
            'Admin must depositReserve(600000e18) then Multisig startPhase(1)',
            'Add 400k RACE + USDT LP on Pancake after deploy',
        ],
    };
    const summaryPath = path.join(outDir, 'core-deployment.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log('\n=== MAINNET CORE DEPLOYED ===');
    console.log(JSON.stringify(summary, null, 2));
    console.log('Saved:', summaryPath);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
