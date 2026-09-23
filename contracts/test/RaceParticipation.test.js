const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('RaceParticipation', function () {
    const USDT_50 = ethers.parseEther('50');
    const ONE_DAY = 24 * 60 * 60;

    async function deployFixture() {
        const [owner, sponsor, user, funder] = await ethers.getSigners();

        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const usdt = await MockERC20.deploy('USDT', 'USDT', 18);
        const race = await MockERC20.deploy('RACE', 'RACE', 18);

        const MockPancakeRouter = await ethers.getContractFactory('MockPancakeRouter');
        const router = await MockPancakeRouter.deploy(await usdt.getAddress(), await race.getAddress());

        const RaceParticipation = await ethers.getContractFactory('RaceParticipation');
        const participation = await RaceParticipation.deploy(
            owner.address,
            await usdt.getAddress(),
            await race.getAddress(),
            await router.getAddress(),
        );

        await usdt.mint(sponsor.address, ethers.parseEther('1000'));
        await usdt.mint(user.address, ethers.parseEther('1000'));
        await race.mint(await router.getAddress(), ethers.parseEther('1000000'));
        await race.mint(funder.address, ethers.parseEther('1000000'));

        await usdt.connect(user).approve(await participation.getAddress(), ethers.parseEther('1000'));
        await race.connect(funder).approve(await participation.getAddress(), ethers.parseEther('100000'));

        return { owner, sponsor, user, funder, usdt, race, router, participation };
    }

    it('allows flexible participate at 0.35% daily', async function () {
        const { usdt, participation } = await deployFixture();
        const [, , , stranger] = await ethers.getSigners();

        await usdt.mint(stranger.address, ethers.parseEther('100'));
        await usdt.connect(stranger).approve(await participation.getAddress(), USDT_50);

        await participation.connect(stranger).participate(USDT_50, 0);
        const stake = await participation.stakeAt(stranger.address, 0);
        expect(stake.dailyRateBps).to.equal(35n);
    });

    it('stakes RACE from USDT via pancake price', async function () {
        const { user, participation } = await deployFixture();

        await expect(participation.connect(user).participate(USDT_50, 180 * ONE_DAY))
            .to.emit(participation, 'ParticipationPurchased')
            .and.to.emit(participation, 'StakeCreated');

        const stake = await participation.stakeAt(user.address, 0);
        expect(stake.principalUsdt).to.equal(USDT_50);
        expect(stake.stakedRace).to.equal(ethers.parseEther('500'));
        expect(stake.dailyRateBps).to.equal(50n);
    });

    it('pays daily rewards in RACE without admin approval', async function () {
        const { user, participation, funder, race } = await deployFixture();

        await participation.connect(user).participate(USDT_50, 0);
        await participation.connect(funder).fundRewardVault(ethers.parseEther('10000'));

        await time.increase(ONE_DAY);

        const pending = await participation.pendingRewardRace(user.address, 0);
        expect(pending).to.be.gt(0);

        await expect(participation.connect(user).claimReward(0))
            .to.emit(participation, 'RewardPaid')
            .and.to.emit(participation, 'RewardClaimed');

        expect(await race.balanceOf(user.address)).to.be.gt(0);
    });

    it('charges 10% fee on flexible stake withdraw', async function () {
        const { user, participation, race } = await deployFixture();

        await participation.connect(user).participate(USDT_50, 0);
        const before = await race.balanceOf(user.address);
        await expect(participation.connect(user).withdrawStake(0))
            .to.emit(participation, 'StakeWithdrawn')
            .withArgs(user.address, 0, ethers.parseEther('450'), ethers.parseEther('50'));

        const after = await race.balanceOf(user.address);
        expect(after - before).to.equal(ethers.parseEther('450'));
    });

    it('blocks fixed stake withdrawal before unlock', async function () {
        const { user, participation } = await deployFixture();

        await participation.connect(user).participate(USDT_50, 180 * ONE_DAY);
        await expect(participation.connect(user).withdrawStake(0)).to.be.revertedWith(
            'RaceParticipation: locked',
        );

        await time.increase(180 * ONE_DAY);
        await participation.connect(user).withdrawStake(0);
    });

    it('accepts 365 / 730 / 1095 day locks with official rates', async function () {
        const { user, participation, usdt } = await deployFixture();
        await usdt.connect(user).approve(await participation.getAddress(), ethers.parseEther('1000'));

        await participation.connect(user).participate(USDT_50, 365 * ONE_DAY);
        expect((await participation.stakeAt(user.address, 0)).dailyRateBps).to.equal(70n);

        await participation.connect(user).participate(USDT_50, 730 * ONE_DAY);
        expect((await participation.stakeAt(user.address, 1)).dailyRateBps).to.equal(90n);

        await participation.connect(user).participate(USDT_50, 1095 * ONE_DAY);
        expect((await participation.stakeAt(user.address, 2)).dailyRateBps).to.equal(100n);
    });
});
