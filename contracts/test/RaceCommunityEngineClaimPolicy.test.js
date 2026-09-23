const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { deployAndWireRewardOracle } = require('./helpers/rewardOracle');

describe('RaceCommunityEngine claim activation + 24h cooldown', function () {
    const USDT_50 = ethers.parseEther('50');
    const LOCK_180 = BigInt(180 * 24 * 60 * 60);
    const ONE_DAY = 24 * 60 * 60;

    async function deployFixture({ wireIco = true, enableClaims = false } = {}) {
        const [owner, sponsor, user, stranger] = await ethers.getSigners();

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
        const oracle = await deployAndWireRewardOracle(ethers, owner, engine);

        let icoCompletion = null;
        if (wireIco) {
            const MockIcoCompletion = await ethers.getContractFactory('MockIcoCompletion');
            icoCompletion = await MockIcoCompletion.deploy();
            await engine.setIcoContract(await icoCompletion.getAddress());
        }

        await usdt.mint(user.address, ethers.parseEther('1000'));
        await race.mint(await router.getAddress(), ethers.parseEther('1000000'));
        await race.mint(owner.address, ethers.parseEther('100000'));
        await race.connect(owner).approve(await vault.getAddress(), ethers.parseEther('100000'));
        await vault.connect(owner).fund(ethers.parseEther('100000'));

        await usdt.connect(user).approve(await engine.getAddress(), ethers.parseEther('1000'));
        await engine.connect(user).register(ethers.ZeroAddress);
        await engine.connect(user).participate(USDT_50, LOCK_180);

        if (wireIco) {
            await icoCompletion.setIcoCompleted(true);
        }
        if (enableClaims) {
            await engine.setClaimEnabled(true);
        }

        await time.increase(ONE_DAY);

        return { owner, sponsor, user, stranger, usdt, race, router, vault, engine, oracle, icoCompletion };
    }

    it('reverts claim when ICO is not complete (wired ICO)', async function () {
        const { user, engine, icoCompletion } = await deployFixture({ wireIco: true, enableClaims: true });
        await icoCompletion.setIcoCompleted(false);

        await expect(engine.connect(user).claimReward(0)).to.be.revertedWith('engine: ico active');
    });

    it('reverts claim when claimEnabled is false', async function () {
        const { user, engine } = await deployFixture({ wireIco: true, enableClaims: false });

        await expect(engine.connect(user).claimReward(0)).to.be.revertedWith('engine: claim disabled');
    });

    it('allows claim when ICO complete and claimEnabled', async function () {
        const { user, engine, race } = await deployFixture({ wireIco: true, enableClaims: true });

        const before = await race.balanceOf(user.address);
        await expect(engine.connect(user).claimReward(0)).to.emit(engine, 'RewardPaid');
        expect(await race.balanceOf(user.address)).to.be.gt(before);
    });

    it('enforces 24h global cooldown per user', async function () {
        const { user, engine } = await deployFixture({ wireIco: true, enableClaims: true });

        await engine.connect(user).claimReward(0);
        await time.increase(ONE_DAY - 60);
        await expect(engine.connect(user).claimReward(0)).to.be.revertedWith('engine: claim cooldown');

        await time.increase(120);
        await expect(engine.connect(user).claimReward(0)).to.emit(engine, 'RewardPaid');
    });

    it('does not advance cooldown when nothing is owed', async function () {
        const { user, engine } = await deployFixture({ wireIco: true, enableClaims: true });

        await engine.connect(user).claimReward(0);
        await time.increase(ONE_DAY);
        await engine.connect(user).claimReward(0);

        const last = await engine.lastSuccessfulClaimAt(user.address);
        expect(last).to.be.gt(0);
        const next = await engine.nextAllowedClaimAt(user.address);
        expect(next).to.equal(last + BigInt(ONE_DAY));
    });

    it('accrues multi-day rewards without losing ROI when user waits', async function () {
        const { user, engine, race } = await deployFixture({ wireIco: false, enableClaims: true });

        await time.increase(ONE_DAY * 3);
        const pending = await engine.pendingRewardRace(user.address, 0);
        expect(pending).to.be.gt(0);

        const before = await race.balanceOf(user.address);
        await engine.connect(user).claimReward(0);
        const received = (await race.balanceOf(user.address)) - before;
        expect(received).to.equal(pending);
    });

    it('blocks unauthorized setClaimEnabled', async function () {
        const { stranger, engine } = await deployFixture({ wireIco: true, enableClaims: false });

        await expect(engine.connect(stranger).setClaimEnabled(true)).to.be.revertedWithCustomError(
            engine,
            'OwnableUnauthorizedAccount',
        );
    });

    it('canClaimRewards view reflects gates', async function () {
        const { user, engine, icoCompletion } = await deployFixture({ wireIco: true, enableClaims: false });

        expect(await engine.canClaimRewards(user.address)).to.equal(false);
        await engine.setClaimEnabled(true);
        expect(await engine.canClaimRewards(user.address)).to.equal(true);

        await icoCompletion.setIcoCompleted(false);
        expect(await engine.canClaimRewards(user.address)).to.equal(false);
    });
});
