/**
 * Resume 2026-09-26 mainnet deploy after RPC timeout at ICOContract.
 */
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');
const { loadContractsEnv } = require('./lib/loadContractsEnv');
loadContractsEnv();

const A = {
    deployer: '0x2a797d98E05444D84238748E23Dec4dbAc0A5C5c',
    raceMultiSig: '0x81BffBF2C2a258E662e9df0a0f6e34150b33F3df',
    raceCoin: '0xa29683442d9221Df0Eb7AFF3932c1E165FFa93EB',
    raceTreasury: '0xDFff662C7009a4FbFe12ee97b77b4f06a79Ae155',
    raceDevelopmentTreasury: '0xB255d395b872Af9727812c71176114f229878671',
    raceMarketingTreasury: '0xF75e6989Cf7C2Ab6c85D19F1471d3dAFE733E6A1',
    raceOperationsTreasury: '0x2BBCC874a556540da04e9604b4A33B9FFFD1fda9',
    raceAutoLiquidity: '0x37975d8C0D590ae95EFB3Fc4446962Ea3e133Aa9',
    raceStaking: '0x1B313cB83aDA893CC37B83bAD1a9D0188056EEb9',
    raceRewardVault: '0xa59543817202fE2967be2B6e9EE081b765aE8958',
    raceCommunityEngine: '0x93E75234026aA3942624Dd61Dc4EF2aCf958E1DE',
    raceParticipation: '0x0cbBb4d3871343AB25EAe2A707956DC4E5779821',
    raceICO: '0x631C12254A98cC69516859fD43c4Da494F5073CA',
    icoAdminWallet: '0x568B11c83A104c81c70cde58cCdbF4aa9c97b225',
    usdt: '0x55d398326f99059ff775485246999027b3197955',
    pancakeRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
};

const ALLOC = {
    liquidity: hre.ethers.parseEther('400000'),
    strategicReserve: hre.ethers.parseEther('2500000'),
    developmentFund: hre.ethers.parseEther('2500000'),
    partnerships: hre.ethers.parseEther('2500000'),
};
const SIX_MONTHS = 183 * 24 * 60 * 60;
const TWELVE_MONTHS = 365 * 24 * 60 * 60;
const TWENTY_FOUR_MONTHS = 730 * 24 * 60 * 60;

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const network = await hre.ethers.provider.getNetwork();
    if (Number(network.chainId) !== 56) throw new Error('mainnet only');
    if (deployer.address.toLowerCase() !== A.deployer.toLowerCase()) {
        throw new Error(`wrong deployer ${deployer.address}`);
    }
    const now = Math.floor(Date.now() / 1000);
    const icoAdminWallet = A.icoAdminWallet;
    console.log('Resume deployer', deployer.address, 'bal', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)));

    const raceCoin = await hre.ethers.getContractAt('RaceCoin', A.raceCoin);
    const treasury = await hre.ethers.getContractAt('RaceTreasury', A.raceTreasury);
    const staking = await hre.ethers.getContractAt('RaceStaking', A.raceStaking);
    const rewardVault = await hre.ethers.getContractAt('RaceRewardVault', A.raceRewardVault);
    const communityEngine = await hre.ethers.getContractAt('RaceCommunityEngine', A.raceCommunityEngine);
    const raceIco = await hre.ethers.getContractAt('RaceICO', A.raceICO);
    const autoLiq = await hre.ethers.getContractAt('RaceAutoLiquidity', A.raceAutoLiquidity);

    let icoReserveAddress = await raceIco.icoReserve();
    let icoReserve;
    if (icoReserveAddress === hre.ethers.ZeroAddress) {
        const ICOContract = await hre.ethers.getContractFactory('ICOContract');
        icoReserve = await ICOContract.deploy(deployer.address, A.raceCoin, icoAdminWallet);
        await icoReserve.waitForDeployment();
        icoReserveAddress = await icoReserve.getAddress();
        await (await icoReserve.setRaceIco(A.raceICO)).wait();
        await (await raceIco.setIcoReserve(icoReserveAddress)).wait();
        console.log('ICO Contract:', icoReserveAddress);
    } else {
        icoReserve = await hre.ethers.getContractAt('ICOContract', icoReserveAddress);
        console.log('ICO Contract already set:', icoReserveAddress);
    }

    if ((await raceIco.stakingEngine()) === hre.ethers.ZeroAddress) {
        await (await raceIco.setStakingEngine(A.raceCommunityEngine)).wait();
    }
    if ((await communityEngine.icoContract()) === hre.ethers.ZeroAddress) {
        await (await communityEngine.setIcoContract(A.raceICO)).wait();
    }
    console.log('ICO reserve ↔ RaceICO ↔ Engine linked');

    let rewardPriceOracleAddress = await communityEngine.rewardPriceOracle();
    let rewardPriceOracle;
    if (rewardPriceOracleAddress === hre.ethers.ZeroAddress) {
        const initialRacePriceUsdt = hre.ethers.parseEther(process.env.RACE_REWARD_PRICE_USDT || '0.05');
        const RaceRewardPriceOracle = await hre.ethers.getContractFactory('RaceRewardPriceOracle');
        rewardPriceOracle = await RaceRewardPriceOracle.deploy(
            deployer.address,
            initialRacePriceUsdt,
            24 * 60 * 60,
            hre.ethers.parseEther(process.env.RACE_REWARD_PRICE_MIN || '0.01'),
            hre.ethers.parseEther(process.env.RACE_REWARD_PRICE_MAX || '100'),
        );
        await rewardPriceOracle.waitForDeployment();
        rewardPriceOracleAddress = await rewardPriceOracle.getAddress();
        await (await communityEngine.setRewardPriceOracle(rewardPriceOracleAddress)).wait();
        console.log('RaceRewardPriceOracle:', rewardPriceOracleAddress);
    } else {
        rewardPriceOracle = await hre.ethers.getContractAt('RaceRewardPriceOracle', rewardPriceOracleAddress);
        console.log('Oracle already set:', rewardPriceOracleAddress);
    }

    let incomeHoldAddress = await communityEngine.incomeHold();
    let incomeHold;
    if (incomeHoldAddress === hre.ethers.ZeroAddress) {
        const RaceIncomeHold = await hre.ethers.getContractFactory('RaceIncomeHold');
        incomeHold = await RaceIncomeHold.deploy(
            deployer.address,
            A.raceCoin,
            A.usdt,
            icoAdminWallet,
            rewardPriceOracleAddress,
        );
        await incomeHold.waitForDeployment();
        incomeHoldAddress = await incomeHold.getAddress();
        await (await incomeHold.setVault(A.raceRewardVault)).wait();
        await (await incomeHold.setEngine(A.raceCommunityEngine)).wait();
        await (await rewardVault.setIncomeHold(incomeHoldAddress)).wait();
        await (await communityEngine.setIncomeHold(incomeHoldAddress)).wait();
        await (await incomeHold.lockCreditors()).wait();
        if (!(await rewardVault.wiringLocked())) {
            await (await rewardVault.lockWiring()).wait();
        }
        if (!(await communityEngine.incomeHoldLocked())) {
            await (await communityEngine.lockIncomeHold()).wait();
        }
        console.log('RaceIncomeHold:', incomeHoldAddress);
    } else {
        incomeHold = await hre.ethers.getContractAt('RaceIncomeHold', incomeHoldAddress);
        console.log('IncomeHold already set:', incomeHoldAddress);
    }

    if ((await communityEngine.maturityTreasury()) === hre.ethers.ZeroAddress) {
        await (await communityEngine.setMaturityTreasury(A.raceTreasury)).wait();
    }
    if (!(await communityEngine.maturityTreasuryLocked())) {
        await (await communityEngine.lockMaturityTreasury()).wait();
    }
    if (!(await communityEngine.icoContractLocked())) {
        await (await communityEngine.lockIcoContract()).wait();
    }
    if (!(await communityEngine.rewardPriceOracleLocked())) {
        await (await communityEngine.lockRewardPriceOracle()).wait();
    }
    if (!(await raceIco.stakingEngineLocked())) {
        await (await raceIco.lockStakingEngine()).wait();
    }
    if (!(await raceIco.icoReserveLocked())) {
        await (await raceIco.lockIcoReserve()).wait();
    }
    if (!(await icoReserve.raceIcoLocked())) {
        await (await icoReserve.lockRaceIco()).wait();
    }
    if (!(await treasury.multisigLocked())) {
        await (await treasury.lockMultisig()).wait();
    }
    console.log('Security locks done');

    const RaceRewardPool = await hre.ethers.getContractFactory('RaceRewardPool');
    const rewardPool = await RaceRewardPool.deploy(deployer.address, A.raceCoin, A.raceStaking);
    await rewardPool.waitForDeployment();
    const rewardPoolAddress = await rewardPool.getAddress();
    console.log('RaceRewardPool:', rewardPoolAddress);

    const RaceGovernor = await hre.ethers.getContractFactory('RaceGovernor');
    const governor = await RaceGovernor.deploy(A.raceStaking);
    await governor.waitForDeployment();
    const governorAddress = await governor.getAddress();
    console.log('RaceGovernor:', governorAddress);

    const RaceEcosystemVault = await hre.ethers.getContractFactory('RaceEcosystemVault');
    const ecosystemVault = await RaceEcosystemVault.deploy(deployer.address, A.raceCoin, governorAddress);
    await ecosystemVault.waitForDeployment();
    console.log('RaceEcosystemVault:', await ecosystemVault.getAddress());

    const RaceVesting = await hre.ethers.getContractFactory('RaceVesting');
    const strategicVesting = await RaceVesting.deploy(
        deployer.address, A.raceCoin, A.raceMultiSig, now, TWELVE_MONTHS, 0, ALLOC.strategicReserve,
    );
    await strategicVesting.waitForDeployment();
    const devVesting = await RaceVesting.deploy(
        deployer.address, A.raceCoin, A.raceMultiSig, now, SIX_MONTHS, TWENTY_FOUR_MONTHS, ALLOC.developmentFund,
    );
    await devVesting.waitForDeployment();
    const partnershipsVesting = await RaceVesting.deploy(
        deployer.address, A.raceCoin, A.raceMultiSig, now, TWELVE_MONTHS, 0, ALLOC.partnerships,
    );
    await partnershipsVesting.waitForDeployment();
    console.log('Vesting:', await strategicVesting.getAddress(), await devVesting.getAddress(), await partnershipsVesting.getAddress());

    await (await staking.setRewardPool(rewardPoolAddress)).wait();
    await (await raceCoin.setFeeRecipients(
        A.raceAutoLiquidity,
        A.raceTreasury,
        rewardPoolAddress,
        await devVesting.getAddress(),
    )).wait();
    await (await raceCoin.setGovernance(governorAddress)).wait();
    await (await rewardPool.setGovernance(governorAddress)).wait();
    await (await staking.setGovernance(governorAddress)).wait();

    const feeExempt = [
        A.raceStaking,
        A.raceParticipation,
        A.raceCommunityEngine,
        A.raceRewardVault,
        incomeHoldAddress,
        A.raceICO,
        icoReserveAddress,
        A.raceTreasury,
        A.raceDevelopmentTreasury,
        A.raceMarketingTreasury,
        A.raceOperationsTreasury,
        await ecosystemVault.getAddress(),
        await strategicVesting.getAddress(),
        await devVesting.getAddress(),
        await partnershipsVesting.getAddress(),
        A.pancakeRouter,
        icoAdminWallet,
    ];
    for (const account of feeExempt) {
        await (await raceCoin.setFeeExempt(account, true)).wait();
    }

    const initialMint = await raceCoin.INITIAL_MINT();
    const adminBal = await raceCoin.balanceOf(icoAdminWallet);
    if (adminBal < initialMint) {
        await (await raceCoin.transfer(icoAdminWallet, initialMint - adminBal)).wait();
        console.log('INITIAL_MINT sent to admin', icoAdminWallet);
    } else {
        console.log('Admin already has INITIAL_MINT');
    }
    if (!(await raceCoin.isMinter(A.raceRewardVault))) {
        await (await raceCoin.setMinter(A.raceRewardVault, true)).wait();
    }
    console.log('Minter: RewardVault');

    const oracleUpdater = (process.env.ORACLE_UPDATER || icoAdminWallet).trim();
    await (await rewardPriceOracle.setUpdater(oracleUpdater, true)).wait();
    if (oracleUpdater.toLowerCase() !== deployer.address.toLowerCase()) {
        await (await rewardPriceOracle.setUpdater(deployer.address, false)).wait();
    }
    await (await rewardPriceOracle.transferOwnership(A.raceMultiSig)).wait();
    await (await communityEngine.transferOwnership(A.raceMultiSig)).wait();
    await (await treasury.transferOwnership(A.raceMultiSig)).wait();
    await (await raceCoin.transferOwnership(A.raceMultiSig)).wait();
    await (await raceIco.transferOwnership(A.raceMultiSig)).wait();
    await (await icoReserve.transferOwnership(A.raceMultiSig)).wait();
    await (await rewardVault.transferOwnership(A.raceMultiSig)).wait();
    await (await incomeHold.transferOwnership(A.raceMultiSig)).wait();
    console.log('Ownership → MultiSig');

    const summary = {
        network: '56',
        completedAt: new Date().toISOString(),
        deployer: A.deployer,
        ...A,
        icoContract: icoReserveAddress,
        raceRewardPriceOracle: rewardPriceOracleAddress,
        raceIncomeHold: incomeHoldAddress,
        raceRewardPool: rewardPoolAddress,
        raceGovernor: governorAddress,
        raceEcosystemVault: await ecosystemVault.getAddress(),
        strategicReserveVesting: await strategicVesting.getAddress(),
        developmentFundVesting: await devVesting.getAddress(),
        partnershipsVesting: await partnershipsVesting.getAddress(),
        icoAdminWallet,
        maxSupply: '150000000',
        initialMint: '1000000',
    };
    const outDir = path.join(__dirname, '..', 'deployments', 'mainnet');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'core-deployment-20260926.json');
    fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
    console.log('Wrote', outFile);
    console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
