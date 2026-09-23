const hre = require('hardhat');
const {
    loadContractsEnv,
    resolveUsdt,
    resolvePancakeRouter,
    looksLikePlaceholderKey,
} = require('./lib/loadContractsEnv');
loadContractsEnv();

// Vesting schedule caps (tokens minted later via minters / governance — deploy starts with 10L only).
const ALLOC = {
    liquidity: hre.ethers.parseEther('500000'), // from INITIAL_MINT for LP seed
    strategicReserve: hre.ethers.parseEther('2500000'),
    developmentFund: hre.ethers.parseEther('2500000'),
    ecosystemGrowth: hre.ethers.parseEther('7500000'),
    stakingRewards: hre.ethers.parseEther('20000000'),
    treasuryReserve: hre.ethers.parseEther('10000000'),
    partnerships: hre.ethers.parseEther('2500000'),
};

const SIX_MONTHS = 183 * 24 * 60 * 60;
const TWELVE_MONTHS = 365 * 24 * 60 * 60;
const TWENTY_FOUR_MONTHS = 730 * 24 * 60 * 60;
const FIVE_YEARS = 5 * 365 * 24 * 60 * 60;

function getMultisigSigners(deployer, accounts, { requireEnv = false } = {}) {
    const thresholdEnv = process.env.MULTISIG_THRESHOLD;
    if (thresholdEnv !== undefined && thresholdEnv !== '') {
        const t = Number(thresholdEnv);
        if (!Number.isInteger(t) || t !== 3) {
            throw new Error(
                `MULTISIG_THRESHOLD must be 3 (RaceMultiSig.REQUIRED is immutable). Got: ${thresholdEnv}`,
            );
        }
    }

    let raw;
    if (process.env.MULTISIG_SIGNERS) {
        raw = process.env.MULTISIG_SIGNERS.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (requireEnv) {
        throw new Error(
            'Production/mainnet deploy requires MULTISIG_SIGNERS (exactly 5 unique addresses).',
        );
    } else if (accounts.length >= 5) {
        raw = accounts.slice(0, 5).map((a) => a.address);
    } else {
        throw new Error('Provide MULTISIG_SIGNERS in .env or deploy on a network with 5 accounts');
    }

    if (raw.length !== 5) {
        throw new Error(`MULTISIG_SIGNERS must contain exactly 5 addresses (got ${raw.length})`);
    }

    const seen = new Set();
    const signers = raw.map((addr, i) => {
        let checksummed;
        try {
            checksummed = hre.ethers.getAddress(addr);
        } catch {
            throw new Error(`MULTISIG_SIGNERS[${i}] is not a valid address: ${addr}`);
        }
        if (checksummed === hre.ethers.ZeroAddress) {
            throw new Error(`MULTISIG_SIGNERS[${i}] is the zero address`);
        }
        const key = checksummed.toLowerCase();
        if (seen.has(key)) {
            throw new Error(`MULTISIG_SIGNERS contains duplicate: ${checksummed}`);
        }
        seen.add(key);
        return checksummed;
    });

    return signers;
}

async function main() {
    const accounts = await hre.ethers.getSigners();
    const deployer = accounts[0];
    const network = await hre.ethers.provider.getNetwork();
    const now = Math.floor(Date.now() / 1000);

    console.log('Deployer:', deployer.address);
    console.log('Chain ID:', network.chainId.toString());

    const chainId = network.chainId;
    const isBscMainnet = chainId === 56n || chainId === 56;
    const isBscTestnet = chainId === 97n || chainId === 97;
    const requireProdMultisig =
        isBscMainnet ||
        process.env.REQUIRE_MULTISIG_SIGNERS === '1' ||
        process.env.REQUIRE_MULTISIG_SIGNERS === 'true';

    // Explicit confirmation for live BSC Testnet deploys (CI/local hardhat exempt).
    if (isBscMainnet) {
        throw new Error(
            'STOP: BSC Mainnet (chain 56) deploy is blocked by this safety task. Use testnet only.',
        );
    }

    if (isBscTestnet) {
        if (process.env.DEPLOY_ENV !== 'testnet') {
            throw new Error(
                'STOP: Set DEPLOY_ENV=testnet in contracts/.env before BSC Testnet deploy.',
            );
        }
        if (process.env.CONFIRM_TESTNET_DEPLOYMENT !== 'YES') {
            throw new Error(
                'STOP: Set CONFIRM_TESTNET_DEPLOYMENT=YES to deploy to BSC Testnet (chain 97).',
            );
        }
        const rpcUrl =
            process.env.BSC_TESTNET_RPC ||
            process.env.BSC_TESTNET_RPC_URL ||
            '';
        if (
            rpcUrl &&
            /bsc-dataseed|mainnet/i.test(rpcUrl) &&
            !/testnet|seed-prebsc/i.test(rpcUrl)
        ) {
            throw new Error('STOP: Mainnet RPC detected while DEPLOY_ENV=testnet');
        }
    }

    if (isBscTestnet && looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        throw new Error(
            'STOP: DEPLOYER_PRIVATE_KEY missing or still a placeholder. Put a real testnet key in contracts/.env',
        );
    }

    let pancakeRouter;
    let usdt;
    if (isBscTestnet) {
        pancakeRouter = resolvePancakeRouter();
        usdt = resolveUsdt();
        if (!pancakeRouter || !usdt) {
            throw new Error(
                'STOP: Testnet requires explicit TESTNET_USDT_ADDRESS (or USDT) and PANCAKE_ROUTER_ADDRESS (or PANCAKE_ROUTER).',
            );
        }
    } else {
        pancakeRouter =
            resolvePancakeRouter() || '0x10ED43C718714eb63d5aA57B78B54704E256024E';
        usdt = resolveUsdt() || '0x55d398326f99059ff775485246999027b3197955';
    }
    const mainnetUsdt = '0x55d398326f99059ff775485246999027b3197955';
    const mainnetRouter = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
    if (
        isBscTestnet &&
        (usdt.toLowerCase() === mainnetUsdt.toLowerCase() ||
            pancakeRouter.toLowerCase() === mainnetRouter.toLowerCase())
    ) {
        throw new Error(
            'STOP: Testnet deploy refuses mainnet USDT/Pancake defaults. Set TESTNET_USDT_ADDRESS (or USDT) + PANCAKE_ROUTER_ADDRESS (or PANCAKE_ROUTER).',
        );
    }
    try {
        if (hre.ethers.getAddress(usdt) === hre.ethers.ZeroAddress) {
            throw new Error('USDT zero');
        }
        if (hre.ethers.getAddress(pancakeRouter) === hre.ethers.ZeroAddress) {
            throw new Error('router zero');
        }
    } catch (e) {
        if (isBscTestnet) {
            throw new Error(`STOP: Invalid USDT or PANCAKE_ROUTER address (${e.message})`);
        }
    }

    const multisigSigners = getMultisigSigners(deployer, accounts, {
        requireEnv: requireProdMultisig || isBscTestnet,
    });

    // Reject obvious wrong-chain env mismatches when explicitly targeting BSC.
    if (isBscMainnet && process.env.EXPECTED_CHAIN_ID && Number(process.env.EXPECTED_CHAIN_ID) !== 56) {
        throw new Error('EXPECTED_CHAIN_ID does not match BSC mainnet (56)');
    }
    if (isBscTestnet && process.env.EXPECTED_CHAIN_ID && Number(process.env.EXPECTED_CHAIN_ID) !== 97) {
        throw new Error('EXPECTED_CHAIN_ID does not match BSC testnet (97)');
    }

    const deployerBal = await hre.ethers.provider.getBalance(deployer.address);
    console.log('Deployer balance (native):', hre.ethers.formatEther(deployerBal));
    if (isBscTestnet && deployerBal === 0n) {
        throw new Error('STOP: Deployer has 0 tBNB');
    }

    console.log('MULTISIG_SIGNERS:', multisigSigners.join(', '));
    console.log('USDT:', usdt);
    console.log('PANCAKE_ROUTER:', pancakeRouter);
    console.log('CONFIRM_TESTNET_DEPLOYMENT:', process.env.CONFIRM_TESTNET_DEPLOYMENT || '(n/a)');

    const RaceMultiSig = await hre.ethers.getContractFactory('RaceMultiSig');
    const multiSig = await RaceMultiSig.deploy(multisigSigners);
    await multiSig.waitForDeployment();
    const multiSigAddress = await multiSig.getAddress();
    console.log('RaceMultiSig (3/5):', multiSigAddress);

    const RaceCoin = await hre.ethers.getContractFactory('RaceCoin');
    const raceCoin = await RaceCoin.deploy(
        deployer.address,
        deployer.address,
        deployer.address,
        deployer.address,
        deployer.address,
    );
    await raceCoin.waitForDeployment();
    const raceAddress = await raceCoin.getAddress();
    console.log('RaceCoin:', raceAddress);

    const RaceTreasury = await hre.ethers.getContractFactory('RaceTreasury');
    const treasury = await RaceTreasury.deploy(deployer.address, raceAddress, multiSigAddress);
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();
    console.log('RaceTreasury (Company):', treasuryAddress);

    // Expense Multisig funds (Dev / Marketing / Ops). No auto-allocation — empty until funded.
    // Locked tokenomics: Expense bucket ≤ 30M RACE via 3-of-5; split among these funds = PENDING BUSINESS APPROVAL.
    const RaceDevelopmentTreasury = await hre.ethers.getContractFactory('RaceDevelopmentTreasury');
    const developmentTreasury = await RaceDevelopmentTreasury.deploy(multiSigAddress, raceAddress, usdt);
    await developmentTreasury.waitForDeployment();
    const developmentTreasuryAddress = await developmentTreasury.getAddress();
    console.log('RaceDevelopmentTreasury:', developmentTreasuryAddress);

    const RaceMarketingTreasury = await hre.ethers.getContractFactory('RaceMarketingTreasury');
    const marketingTreasury = await RaceMarketingTreasury.deploy(multiSigAddress, raceAddress, usdt);
    await marketingTreasury.waitForDeployment();
    const marketingTreasuryAddress = await marketingTreasury.getAddress();
    console.log('RaceMarketingTreasury:', marketingTreasuryAddress);

    const RaceOperationsTreasury = await hre.ethers.getContractFactory('RaceOperationsTreasury');
    const operationsTreasury = await RaceOperationsTreasury.deploy(multiSigAddress, raceAddress, usdt);
    await operationsTreasury.waitForDeployment();
    const operationsTreasuryAddress = await operationsTreasury.getAddress();
    console.log('RaceOperationsTreasury:', operationsTreasuryAddress);

    const RaceAutoLiquidity = await hre.ethers.getContractFactory('RaceAutoLiquidity');
    const autoLiq = await RaceAutoLiquidity.deploy(
        deployer.address,
        raceAddress,
        usdt,
        pancakeRouter,
    );
    await autoLiq.waitForDeployment();
    console.log('RaceAutoLiquidity:', await autoLiq.getAddress());

    const RaceStaking = await hre.ethers.getContractFactory('RaceStaking');
    const staking = await RaceStaking.deploy(deployer.address, raceAddress, hre.ethers.ZeroAddress);
    await staking.waitForDeployment();
    const stakingAddress = await staking.getAddress();
    console.log('RaceStaking:', stakingAddress);

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
    console.log('RaceCommunityEngine:', communityEngineAddress);
    await (await rewardVault.setEngine(communityEngineAddress)).wait();

    const RaceParticipation = await hre.ethers.getContractFactory('RaceParticipation');
    const participation = await RaceParticipation.deploy(
        deployer.address,
        usdt,
        raceAddress,
        pancakeRouter,
    );
    await participation.waitForDeployment();
    const participationAddress = await participation.getAddress();
    console.log('RaceParticipation:', participationAddress);

    const icoAdminWallet = process.env.ICO_ADMIN_WALLET || deployer.address;
    const RaceICO = await hre.ethers.getContractFactory('RaceICO');
    const raceIco = await RaceICO.deploy(deployer.address, raceAddress, usdt, icoAdminWallet);
    await raceIco.waitForDeployment();
    const raceIcoAddress = await raceIco.getAddress();
    console.log('RaceICO:', raceIcoAddress);
    console.log('ICO admin wallet (USDT proceeds):', icoAdminWallet);
    await (await raceIco.setStakingEngine(communityEngineAddress)).wait();
    await (await communityEngine.setIcoContract(raceIcoAddress)).wait();
    console.log('RaceICO ↔ RaceCommunityEngine linked for ICO→stake');

    // Reward mint conversion — NOT Pancake spot. Ops must keep price fresh (heartbeat).
    // Mainnet: refuse placeholder $1 — require explicit RACE_REWARD_PRICE_USDT.
    if (isBscMainnet && !process.env.RACE_REWARD_PRICE_USDT) {
        throw new Error(
            'Mainnet deploy requires RACE_REWARD_PRICE_USDT (USDT per 1 RACE, e.g. 0.05). Placeholder $1 refused.',
        );
    }
    if (!process.env.RACE_REWARD_PRICE_USDT) {
        console.warn(
            'WARN: RACE_REWARD_PRICE_USDT unset — using $1 only for local/test. Set real price for testnet/mainnet.',
        );
    }
    const initialRacePriceUsdt = hre.ethers.parseEther(process.env.RACE_REWARD_PRICE_USDT || '1');
    const RaceRewardPriceOracle = await hre.ethers.getContractFactory('RaceRewardPriceOracle');
    const rewardPriceOracle = await RaceRewardPriceOracle.deploy(
        deployer.address,
        initialRacePriceUsdt,
        24 * 60 * 60,
        hre.ethers.parseEther(process.env.RACE_REWARD_PRICE_MIN || '0.01'),
        hre.ethers.parseEther(process.env.RACE_REWARD_PRICE_MAX || '100'),
    );
    await rewardPriceOracle.waitForDeployment();
    const rewardPriceOracleAddress = await rewardPriceOracle.getAddress();
    await (await communityEngine.setRewardPriceOracle(rewardPriceOracleAddress)).wait();
    console.log(
        'RaceRewardPriceOracle:',
        rewardPriceOracleAddress,
        `($${process.env.RACE_REWARD_PRICE_USDT || '1'}/RACE)`,
    );

    // Fixed-maturity 10% fee → RaceTreasury, then permanently lock destination.
    await (await communityEngine.setMaturityTreasury(treasuryAddress)).wait();
    await (await communityEngine.lockMaturityTreasury()).wait();
    console.log('Engine maturityTreasury → RaceTreasury (LOCKED)');

    const RaceRewardPool = await hre.ethers.getContractFactory('RaceRewardPool');
    const rewardPool = await RaceRewardPool.deploy(deployer.address, raceAddress, stakingAddress);
    await rewardPool.waitForDeployment();
    const rewardPoolAddress = await rewardPool.getAddress();
    console.log('RaceRewardPool:', rewardPoolAddress);

    const RaceGovernor = await hre.ethers.getContractFactory('RaceGovernor');
    const governor = await RaceGovernor.deploy(stakingAddress);
    await governor.waitForDeployment();
    const governorAddress = await governor.getAddress();
    console.log('RaceGovernor:', governorAddress);

    const RaceEcosystemVault = await hre.ethers.getContractFactory('RaceEcosystemVault');
    const ecosystemVault = await RaceEcosystemVault.deploy(
        deployer.address,
        raceAddress,
        governorAddress,
    );
    await ecosystemVault.waitForDeployment();
    console.log('RaceEcosystemVault:', await ecosystemVault.getAddress());

    const RaceVesting = await hre.ethers.getContractFactory('RaceVesting');

    const strategicVesting = await RaceVesting.deploy(
        deployer.address,
        raceAddress,
        multiSigAddress,
        now,
        TWELVE_MONTHS,
        0,
        ALLOC.strategicReserve,
    );
    await strategicVesting.waitForDeployment();
    console.log('StrategicReserveVesting (12mo lock):', await strategicVesting.getAddress());

    const devVesting = await RaceVesting.deploy(
        deployer.address,
        raceAddress,
        multiSigAddress,
        now,
        SIX_MONTHS,
        TWENTY_FOUR_MONTHS,
        ALLOC.developmentFund,
    );
    await devVesting.waitForDeployment();
    console.log('DevelopmentFundVesting (6mo cliff + 24mo linear):', await devVesting.getAddress());

    const partnershipsVesting = await RaceVesting.deploy(
        deployer.address,
        raceAddress,
        multiSigAddress,
        now,
        TWELVE_MONTHS,
        0,
        ALLOC.partnerships,
    );
    await partnershipsVesting.waitForDeployment();
    console.log('PartnershipsVesting (12mo lock):', await partnershipsVesting.getAddress());

    await (await staking.setRewardPool(rewardPoolAddress)).wait();

    await (
        await raceCoin.setFeeRecipients(
            await autoLiq.getAddress(),
            await treasury.getAddress(),
            rewardPoolAddress,
            await devVesting.getAddress(),
        )
    ).wait();

    await (await raceCoin.setGovernance(governorAddress)).wait();
    await (await rewardPool.setGovernance(governorAddress)).wait();
    await (await staking.setGovernance(governorAddress)).wait();

    const feeExempt = [
        stakingAddress,
        participationAddress,
        communityEngineAddress,
        rewardVaultAddress,
        raceIcoAddress,
        treasuryAddress,
        developmentTreasuryAddress,
        marketingTreasuryAddress,
        operationsTreasuryAddress,
        await ecosystemVault.getAddress(),
        await strategicVesting.getAddress(),
        await devVesting.getAddress(),
        await partnershipsVesting.getAddress(),
        pancakeRouter,
    ];
    for (const account of feeExempt) {
        await (await raceCoin.setFeeExempt(account, true)).wait();
    }

    // Mint-on-demand: ICO buy + income (vault.pay) mint RACE to users — no pre-fund inventory.
    await (await raceCoin.setMinter(raceIcoAddress, true)).wait();
    await (await raceCoin.setMinter(rewardVaultAddress, true)).wait();
    console.log('Minters enabled: RaceICO + RaceRewardVault');

    let liquidityLockerAddress = null;
    if (process.env.LP_TOKEN) {
        const RaceLiquidityLocker = await hre.ethers.getContractFactory('RaceLiquidityLocker');
        const locker = await RaceLiquidityLocker.deploy(
            deployer.address,
            process.env.LP_TOKEN,
            multiSigAddress,
            now + FIVE_YEARS,
        );
        await locker.waitForDeployment();
        liquidityLockerAddress = await locker.getAddress();
        console.log('RaceLiquidityLocker (5yr):', liquidityLockerAddress);
    } else {
        console.log('RaceLiquidityLocker: skipped (set LP_TOKEN after creating PancakeSwap pair)');
    }

    const summary = {
        network: network.chainId.toString(),
        raceCoin: raceAddress,
        raceMultiSig: multiSigAddress,
        raceTreasury: treasuryAddress,
        raceDevelopmentTreasury: developmentTreasuryAddress,
        raceMarketingTreasury: marketingTreasuryAddress,
        raceOperationsTreasury: operationsTreasuryAddress,
        raceAutoLiquidity: await autoLiq.getAddress(),
        raceStaking: stakingAddress,
        raceParticipation: participationAddress,
        raceICO: raceIcoAddress,
        raceRewardVault: rewardVaultAddress,
        raceCommunityEngine: communityEngineAddress,
        raceRewardPriceOracle: rewardPriceOracleAddress,
        raceRewardPool: rewardPoolAddress,
        raceGovernor: governorAddress,
        raceEcosystemVault: await ecosystemVault.getAddress(),
        strategicReserveVesting: await strategicVesting.getAddress(),
        developmentFundVesting: await devVesting.getAddress(),
        partnershipsVesting: await partnershipsVesting.getAddress(),
        raceLiquidityLocker: liquidityLockerAddress,
        initialMint: '1000000',
        maxSupply: '150000000',
        icoAdminWallet,
        icoStakingEngine: communityEngineAddress,
        liquidityDeployerBalance: hre.ethers.formatEther(ALLOC.liquidity),
        pancakeRouter,
        usdt,
        multisigSigners,
    };

    // ── Governance hardening (OZ Ownable.transferOwnership) ─────────────────
    // Production: Engine / Oracle / Treasury / RaceCoin / ICO / Vault → RaceMultiSig (3-of-5).
    // Oracle updater may stay a dedicated ops EOA for heartbeat. Does NOT auto-start ICO.
    const hardenGovernance =
        process.env.HARDEN_GOVERNANCE === '1' ||
        process.env.HARDEN_GOVERNANCE === 'true' ||
        isBscMainnet;

    // Oracle updater: dedicated ops EOA. Do NOT silently use MultiSig on Testnet
    // (MultiSig cannot heartbeat without 3/5; assert failed when harden was off).
    let oracleUpdater;
    if (isBscTestnet) {
        if (!process.env.ORACLE_UPDATER || !String(process.env.ORACLE_UPDATER).trim()) {
            throw new Error(
                'STOP: ORACLE_UPDATER required on BSC Testnet (dedicated ops wallet). Do not rely on MultiSig fallback.',
            );
        }
        oracleUpdater = process.env.ORACLE_UPDATER.trim();
    } else {
        oracleUpdater = (process.env.ORACLE_UPDATER || multiSigAddress).trim();
    }
    if (hardenGovernance && isBscMainnet && !process.env.ORACLE_UPDATER) {
        console.warn(
            'WARN: ORACLE_UPDATER unset on mainnet — Multisig will be the only price updater (3/5 per update).',
        );
    }

    // Always activate explicit updater (even when HARDEN_GOVERNANCE is off).
    await (await rewardPriceOracle.setUpdater(oracleUpdater, true)).wait();
    console.log('Oracle updater activated:', oracleUpdater);

    if (hardenGovernance) {
        if (oracleUpdater.toLowerCase() !== deployer.address.toLowerCase()) {
            await (await rewardPriceOracle.setUpdater(deployer.address, false)).wait();
        }
        await (await rewardPriceOracle.transferOwnership(multiSigAddress)).wait();
        await (await communityEngine.transferOwnership(multiSigAddress)).wait();
        // RaceTreasury.owner can setMultisig — move to MultiSig so deployer cannot retarget withdraw authority.
        await (await treasury.transferOwnership(multiSigAddress)).wait();
        // RaceCoin: setMinter / setGovernance / fee controls leave deployer EOA.
        // NEVER transfer RaceCoin ownership to Community Governance (governanceMint risk via setGovernance).
        await (await raceCoin.transferOwnership(multiSigAddress)).wait();
        // RaceICO: startPhase / wallet / engine settings leave deployer EOA.
        await (await raceIco.transferOwnership(multiSigAddress)).wait();
        // Vault: setEngine must not remain single-EOA after wiring.
        await (await rewardVault.transferOwnership(multiSigAddress)).wait();
        console.log(
            'Governance hardened: Engine/Oracle/Treasury/RaceCoin/ICO/Vault ownership → RaceMultiSig',
        );
    } else {
        console.warn(
            'WARN: HARDEN_GOVERNANCE not set — privileged contracts remain deployer-owned (local/dev only). Set HARDEN_GOVERNANCE=1 for testnet.',
        );
    }

    // ── Post-deploy assertions ──────────────────────────────────────────────
    const multiSigThreshold = await multiSig.threshold();
    const multiSigRequired = await multiSig.REQUIRED();
    const onChainSigners = await multiSig.getSigners();
    const engineOwner = await communityEngine.owner();
    const engineTreasury = await communityEngine.maturityTreasury();
    const treasuryLocked = await communityEngine.maturityTreasuryLocked();
    const treasuryOwner = await treasury.owner();
    const treasuryMultisig = await treasury.multisig();
    const oracleOwner = await rewardPriceOracle.owner();
    const raceCoinOwner = await raceCoin.owner();
    const icoOwner = await raceIco.owner();
    const vaultOwner = await rewardVault.owner();
    const updaterIsActive = await rewardPriceOracle.isUpdater(oracleUpdater);

    const expectedOwner = hardenGovernance ? multiSigAddress : deployer.address;

    if (Number(multiSigThreshold) !== 3 || Number(multiSigRequired) !== 3) {
        throw new Error(`ASSERT FAIL: MultiSig threshold ${multiSigThreshold} / REQUIRED ${multiSigRequired} != 3`);
    }
    for (let i = 0; i < 5; i++) {
        if (onChainSigners[i].toLowerCase() !== multisigSigners[i].toLowerCase()) {
            throw new Error(`ASSERT FAIL: signer[${i}] mismatch`);
        }
    }
    if (engineOwner.toLowerCase() !== expectedOwner.toLowerCase()) {
        throw new Error(`ASSERT FAIL: Engine.owner ${engineOwner} != ${expectedOwner}`);
    }
    if (engineTreasury.toLowerCase() !== treasuryAddress.toLowerCase()) {
        throw new Error(`ASSERT FAIL: maturityTreasury ${engineTreasury} != RaceTreasury ${treasuryAddress}`);
    }
    if (!treasuryLocked) {
        throw new Error('ASSERT FAIL: maturityTreasury not locked');
    }
    if (treasuryMultisig.toLowerCase() !== multiSigAddress.toLowerCase()) {
        throw new Error(`ASSERT FAIL: RaceTreasury.multisig ${treasuryMultisig} != MultiSig`);
    }
    if (treasuryOwner.toLowerCase() !== expectedOwner.toLowerCase()) {
        throw new Error(`ASSERT FAIL: RaceTreasury.owner ${treasuryOwner} != ${expectedOwner}`);
    }
    if (oracleOwner.toLowerCase() !== expectedOwner.toLowerCase()) {
        throw new Error(`ASSERT FAIL: Oracle.owner ${oracleOwner} != ${expectedOwner}`);
    }
    if (raceCoinOwner.toLowerCase() !== expectedOwner.toLowerCase()) {
        throw new Error(`ASSERT FAIL: RaceCoin.owner ${raceCoinOwner} != ${expectedOwner}`);
    }
    if (icoOwner.toLowerCase() !== expectedOwner.toLowerCase()) {
        throw new Error(`ASSERT FAIL: RaceICO.owner ${icoOwner} != ${expectedOwner}`);
    }
    if (vaultOwner.toLowerCase() !== expectedOwner.toLowerCase()) {
        throw new Error(`ASSERT FAIL: RaceRewardVault.owner ${vaultOwner} != ${expectedOwner}`);
    }
    if (!updaterIsActive) {
        throw new Error(`ASSERT FAIL: Oracle updater ${oracleUpdater} not active`);
    }
    if (hardenGovernance && engineOwner.toLowerCase() === deployer.address.toLowerCase()) {
        throw new Error('ASSERT FAIL: Engine still owned by deployer EOA');
    }

    const devMs = await developmentTreasury.multisig();
    const mktMs = await marketingTreasury.multisig();
    const opsMs = await operationsTreasury.multisig();
    if (devMs.toLowerCase() !== multiSigAddress.toLowerCase()) {
        throw new Error('ASSERT FAIL: DevelopmentTreasury.multisig mismatch');
    }
    if (mktMs.toLowerCase() !== multiSigAddress.toLowerCase()) {
        throw new Error('ASSERT FAIL: MarketingTreasury.multisig mismatch');
    }
    if (opsMs.toLowerCase() !== multiSigAddress.toLowerCase()) {
        throw new Error('ASSERT FAIL: OperationsTreasury.multisig mismatch');
    }

    console.log('\n=== MULTISIG / GOVERNANCE VERIFICATION ===');
    console.log('MULTISIG ADDRESS:    ', multiSigAddress);
    console.log('SIGNERS:             ', multisigSigners.join(', '));
    console.log('THRESHOLD:           ', multiSigThreshold.toString(), '(REQUIRED=', multiSigRequired.toString(), ')');
    console.log('COMPANY TREASURY:    ', treasuryAddress, '(controller=', treasuryMultisig, ')');
    console.log('DEVELOPMENT TREASURY:', developmentTreasuryAddress, '(controller=', devMs, ')');
    console.log('MARKETING TREASURY:  ', marketingTreasuryAddress, '(controller=', mktMs, ')');
    console.log('OPERATIONS TREASURY: ', operationsTreasuryAddress, '(controller=', opsMs, ')');
    console.log('TREASURY OWNER:      ', treasuryOwner);
    console.log('ENGINE OWNER:        ', engineOwner);
    console.log('ORACLE OWNER:        ', oracleOwner);
    console.log('ORACLE UPDATER:      ', oracleUpdater, updaterIsActive ? '(active)' : '(INACTIVE)');
    console.log('RACECOIN OWNER:      ', raceCoinOwner);
    console.log('ICO OWNER:           ', icoOwner);
    console.log('VAULT OWNER:         ', vaultOwner);
    console.log('MATURITY TREASURY:   ', engineTreasury, treasuryLocked ? '(LOCKED)' : '(UNLOCKED)');
    console.log('HARDEN_GOVERNANCE:   ', hardenGovernance);
    console.log('NOTE: Dev/Marketing/Ops RACE funding split of Expense ≤30M = PENDING BUSINESS APPROVAL');
    console.log('==========================================\n');

    summary.engineOwner = engineOwner;
    summary.maturityTreasury = engineTreasury;
    summary.maturityTreasuryLocked = treasuryLocked;
    summary.treasuryOwner = treasuryOwner;
    summary.treasuryMultisig = treasuryMultisig;
    summary.oracleOwner = oracleOwner;
    summary.oracleUpdater = oracleUpdater;
    summary.raceCoinOwner = raceCoinOwner;
    summary.icoOwner = icoOwner;
    summary.vaultOwner = vaultOwner;
    summary.multisigThreshold = multiSigThreshold.toString();
    summary.hardenGovernance = hardenGovernance;

    console.log('\n--- Token allocation deployed ---');
    console.log(JSON.stringify(summary, null, 2));

    if (isBscTestnet) {
        const fs = require('fs');
        const path = require('path');
        const outDir = path.join(__dirname, '..', 'deployments', 'bscTestnet');
        fs.mkdirSync(outDir, { recursive: true });
        const artifact = {
            ...summary,
            chainId: 97,
            network: 'bscTestnet',
            deploymentTimestamp: new Date().toISOString(),
            blockNumber: await hre.ethers.provider.getBlockNumber(),
            deployer: deployer.address,
            note: 'TESTNET ONLY — not production ready',
        };
        const outFile = path.join(outDir, 'deployment.json');
        fs.writeFileSync(outFile, JSON.stringify(artifact, null, 2));
        console.log('Wrote', outFile);
    }

    console.log('\nNext steps:');
    console.log('1. Mint model: ICO mints RACE on buy (USDT → ICO_ADMIN_WALLET); vault mints income to users.');
    console.log('2. raceICO.startPhase(1) when ready to launch ICO (NOT auto-started).');
    console.log('3. Set RACE_ICO_CONTRACT (+ optional ICO_ADMIN_WALLET) in Laravel .env and rebuild frontend.');
    console.log('4. After ICO: Add RACE/USDT liquidity on PancakeSwap from deployer INITIAL_MINT balance.');
    console.log('5. raceCoin.setFeeExempt(pairAddress, true)');
    console.log('6. Transfer LP tokens to RaceLiquidityLocker (deploy with LP_TOKEN or run lock-lp script).');
    console.log('7. Keep oracle price fresh via ORACLE_UPDATER (or Multisig) before claims/compounds.');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
