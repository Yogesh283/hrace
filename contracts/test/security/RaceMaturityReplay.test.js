const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployAndWireRewardOracle, refreshOraclePrice } = require('../helpers/rewardOracle');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('Security: maturity / EMI replay', function () {
    const USDT_100 = ethers.parseEther('100');
    const LOCK_180 = BigInt(180 * 24 * 60 * 60);
    const EMI_INTERVAL = 30 * 24 * 60 * 60;

    async function deploy() {
        const [owner, user] = await ethers.getSigners();
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const usdt = await MockERC20.deploy('USDT', 'USDT', 18);
        const race = await MockERC20.deploy('RACE', 'RACE', 18);
        const MockPancakeRouter = await ethers.getContractFactory('MockPancakeRouter');
        const router = await MockPancakeRouter.deploy(await usdt.getAddress(), await race.getAddress());
        const RaceRewardVault = await ethers.getContractFactory('RaceRewardVault');
        const vault = await RaceRewardVault.deploy(owner.address, await race.getAddress());
        const RaceCommunityEngine = await ethers.getContractFactory('RaceCommunityEngine');
        const engine = await RaceCommunityEngine.deploy(
            owner.address,
            await usdt.getAddress(),
            await race.getAddress(),
            await router.getAddress(),
            await vault.getAddress(),
        );
        await vault.setEngine(await engine.getAddress());
        const oracle = await deployAndWireRewardOracle(ethers, owner, engine, ethers.parseEther('1'));
        const RaceTreasury = await ethers.getContractFactory('RaceTreasury');
        const treasury = await RaceTreasury.deploy(owner.address, await race.getAddress(), owner.address);
        await engine.setMaturityTreasury(await treasury.getAddress());
        await race.mint(await router.getAddress(), ethers.parseEther('1000000'));
        await race.mint(owner.address, ethers.parseEther('100000'));
        await race.connect(owner).approve(await vault.getAddress(), ethers.parseEther('100000'));
        await vault.connect(owner).fund(ethers.parseEther('100000'));
        await usdt.mint(user.address, ethers.parseEther('1000'));
        await usdt.connect(user).approve(await engine.getAddress(), ethers.MaxUint256);
        return { owner, user, engine, oracle };
    }

    it('rejects double matureStake', async function () {
        const { user, engine, oracle } = await deploy();
        await engine.connect(user).participate(USDT_100, LOCK_180);
        await time.increase(LOCK_180 + BigInt(24 * 60 * 60));
        await refreshOraclePrice(oracle, ethers.parseEther('1'));
        await engine.connect(user).matureStake(0);
        await expect(engine.connect(user).matureStake(0)).to.be.revertedWith('engine: already matured');
    });

    it('rejects double EMI claim', async function () {
        const { user, engine, oracle } = await deploy();
        await engine.connect(user).participate(USDT_100, LOCK_180);
        await time.increase(LOCK_180 + 1n);
        await refreshOraclePrice(oracle, ethers.parseEther('1'));
        await engine.connect(user).matureStake(0);
        await time.increase(EMI_INTERVAL + 1);
        await engine.connect(user).claimMaturityEmi(0, 1);
        await expect(engine.connect(user).claimMaturityEmi(0, 1)).to.be.revertedWith('engine: emi claimed');
    });

    it('rejects other user matureStake on victim index', async function () {
        const { user, engine } = await deploy();
        const [, other] = await ethers.getSigners();
        await engine.connect(user).participate(USDT_100, LOCK_180);
        await time.increase(LOCK_180 + 1n);
        await expect(engine.connect(other).matureStake(0)).to.be.reverted;
    });
});
