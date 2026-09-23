const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { deployAndWireRewardOracle } = require('../helpers/rewardOracle');

describe('Security: RaceCommunityEngine distributeReward access', function () {
    const USDT_50 = ethers.parseEther('50');
    const LOCK_180 = BigInt(180 * 24 * 60 * 60);
    const ONE_DAY = 24 * 60 * 60;

    async function deployWithClaimReady() {
        const [owner, victim, attacker] = await ethers.getSigners();
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

        await usdt.mint(victim.address, ethers.parseEther('1000'));
        await race.mint(await router.getAddress(), ethers.parseEther('1000000'));
        await race.mint(owner.address, ethers.parseEther('100000'));
        await race.connect(owner).approve(await vault.getAddress(), ethers.parseEther('100000'));
        await vault.connect(owner).fund(ethers.parseEther('100000'));

        await usdt.connect(victim).approve(await engine.getAddress(), ethers.parseEther('1000'));
        await engine.connect(victim).participate(USDT_50, LOCK_180);
        await time.increase(ONE_DAY);

        return { victim, attacker, engine, race };
    }

    it('reverts when attacker distributes for victim', async function () {
        const { victim, attacker, engine } = await deployWithClaimReady();
        await expect(
            engine.connect(attacker).distributeReward(victim.address, 0),
        ).to.be.revertedWith('engine: not user');
    });

    it('allows victim to distribute own reward (same as claim path)', async function () {
        const { victim, engine, race } = await deployWithClaimReady();
        const before = await race.balanceOf(victim.address);
        await engine.connect(victim).distributeReward(victim.address, 0);
        expect(await race.balanceOf(victim.address)).to.be.gt(before);
        expect(await engine.lastSuccessfulClaimAt(victim.address)).to.be.gt(0n);
    });
});
