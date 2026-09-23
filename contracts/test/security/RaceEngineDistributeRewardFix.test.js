const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { deployAndWireRewardOracle } = require('../helpers/rewardOracle');

describe('ENG-HIGH-01: distributeReward authorization (fixed behavior)', function () {
    const USDT_50 = ethers.parseEther('50');
    const LOCK_180 = BigInt(180 * 24 * 60 * 60);
    const ONE_DAY = 24 * 60 * 60;

    async function deployClaimReady() {
        const [owner, user, attacker] = await ethers.getSigners();
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
        await deployAndWireRewardOracle(ethers, owner, engine);
        await engine.setClaimEnabled(true);
        await race.mint(await router.getAddress(), ethers.parseEther('1000000'));
        await race.mint(owner.address, ethers.parseEther('100000'));
        await race.connect(owner).approve(await vault.getAddress(), ethers.parseEther('100000'));
        await vault.connect(owner).fund(ethers.parseEther('100000'));
        await usdt.mint(user.address, ethers.parseEther('1000'));
        await usdt.connect(user).approve(await engine.getAddress(), ethers.parseEther('1000'));
        await engine.connect(user).participate(USDT_50, LOCK_180);
        await time.increase(ONE_DAY);
        return { user, attacker, engine, race };
    }

    it('reverts when attacker calls distributeReward for victim', async function () {
        const { user, attacker, engine } = await deployClaimReady();
        await expect(engine.connect(attacker).distributeReward(user.address, 0)).to.be.revertedWith(
            'engine: not user',
        );
    });

    it('allows user to call distributeReward for self', async function () {
        const { user, engine, race } = await deployClaimReady();
        const before = await race.balanceOf(user.address);
        await engine.connect(user).distributeReward(user.address, 0);
        expect(await race.balanceOf(user.address)).to.be.gt(before);
    });

    it('claimReward still works for legitimate user flow', async function () {
        const { user, engine, race } = await deployClaimReady();
        const before = await race.balanceOf(user.address);
        await engine.connect(user).claimReward(0);
        expect(await race.balanceOf(user.address)).to.be.gt(before);
        expect(await engine.lastSuccessfulClaimAt(user.address)).to.be.gt(0n);
    });
});
