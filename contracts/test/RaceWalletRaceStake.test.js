const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('RaceWalletRaceStake', function () {
    const LOCK_180 = BigInt(180 * 24 * 60 * 60);
    const ONE_DAY = 24 * 60 * 60;
    const RACE_100 = ethers.parseEther('100');

    async function deployFixture({ enableClaims = true } = {}) {
        const [owner, user, treasury, stranger] = await ethers.getSigners();

        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const usdt = await MockERC20.deploy('USDT', 'USDT', 18);
        const race = await MockERC20.deploy('RACE', 'RACE', 18);

        const MockPancakeRouter = await ethers.getContractFactory('MockPancakeRouter');
        const router = await MockPancakeRouter.deploy(await usdt.getAddress(), await race.getAddress());

        const RaceRewardVault = await ethers.getContractFactory('RaceRewardVault');
        const vault = await RaceRewardVault.deploy(owner.address, await race.getAddress());

        const Factory = await ethers.getContractFactory('RaceWalletRaceStake');
        const stake = await Factory.deploy(
            owner.address,
            await usdt.getAddress(),
            await race.getAddress(),
            await router.getAddress(),
            await vault.getAddress(),
        );

        await vault.setPayer(await stake.getAddress(), true);
        await stake.setMaturityTreasury(treasury.address);
        if (enableClaims) {
            await stake.setClaimEnabled(true);
        }

        await race.mint(user.address, ethers.parseEther('10000'));
        await race.connect(user).approve(await stake.getAddress(), ethers.MaxUint256);

        return { owner, user, treasury, stranger, usdt, race, router, vault, stake };
    }

    it('opens stake with default 180d rate 50 bps', async function () {
        const { user, stake } = await deployFixture();
        await expect(stake.connect(user).stakeRace(RACE_100, LOCK_180)).to.emit(stake, 'StakeOpened');
        const s = await stake.stakeAt(user.address, 0);
        expect(s.dailyRateBps).to.equal(50n);
    });

    it('Multisig can set any daily ROI bps (no min/max)', async function () {
        const { owner, user, stranger, stake } = await deployFixture();

        await expect(stake.connect(stranger).setDailyRates(1, 2, 3, 4, 5)).to.be.reverted;

        await expect(stake.connect(owner).setDailyRates(10, 200, 1, 9999, 0))
            .to.emit(stake, 'DailyRatesUpdated')
            .withArgs(10, 200, 1, 9999, 0);

        const rates = await stake.dailyRates();
        expect(rates.flexibleBps).to.equal(10n);
        expect(rates.lock180Bps).to.equal(200n);
        expect(rates.lock1095Bps).to.equal(0n);

        // new 180d stake uses updated 200 bps
        await stake.connect(user).stakeRace(RACE_100, LOCK_180);
        expect((await stake.stakeAt(user.address, 0)).dailyRateBps).to.equal(200n);
    });

    it('rate update does not change already-open stake snapshot', async function () {
        const { owner, user, stake } = await deployFixture();
        await stake.connect(user).stakeRace(RACE_100, LOCK_180);
        expect((await stake.stakeAt(user.address, 0)).dailyRateBps).to.equal(50n);

        await stake.connect(owner).setDailyRates(35, 80, 70, 90, 100);
        expect((await stake.stakeAt(user.address, 0)).dailyRateBps).to.equal(50n);
    });

    it('daily claim mints RACE via RewardVault', async function () {
        const { user, race, stake } = await deployFixture({ enableClaims: true });
        await stake.connect(user).stakeRace(RACE_100, LOCK_180);
        await time.increase(ONE_DAY);
        const before = await race.balanceOf(user.address);
        await expect(stake.connect(user).claimReward(0)).to.emit(stake, 'RewardPaid');
        expect(await race.balanceOf(user.address)).to.be.gt(before);
    });

    it('Multisig can update transferTaxBps (preview)', async function () {
        const { owner, stranger, stake } = await deployFixture();

        expect(await stake.transferTaxBps()).to.equal(400n);
        expect(await stake.expectedNetRace(RACE_100)).to.equal(ethers.parseEther('96'));

        await expect(stake.connect(stranger).setTransferTaxBps(0)).to.be.reverted;
        await expect(stake.connect(owner).setTransferTaxBps(0)).to.emit(stake, 'TransferTaxBpsUpdated').withArgs(0);
        expect(await stake.expectedNetRace(RACE_100)).to.equal(RACE_100);

        await stake.connect(owner).setTransferTaxBps(1000);
        expect(await stake.expectedNetRace(RACE_100)).to.equal(ethers.parseEther('90'));
        expect(await stake.grossForDesiredNet(ethers.parseEther('90'))).to.equal(RACE_100);
    });

    it('enforceTransferTax allows stake when received >= Multisig expected net', async function () {
        const { owner, user, stake } = await deployFixture();
        await stake.connect(owner).setTransferTaxBps(1000); // expect 90; mock delivers 100
        await stake.connect(owner).setEnforceTransferTax(true);
        await expect(stake.connect(user).stakeRace(RACE_100, LOCK_180)).to.emit(stake, 'StakeOpened');
    });

    it('Multisig can update min / fee / cooldown / maxRewardDays; stranger blocked', async function () {
        const { owner, stranger, stake } = await deployFixture();

        expect(await stake.minParticipationUsdt()).to.equal(ethers.parseEther('1'));
        expect(await stake.withdrawalFeeBps()).to.equal(1000n);
        expect(await stake.claimCooldown()).to.equal(BigInt(24 * 60 * 60));
        expect(await stake.maxRewardDays()).to.equal(30n);

        await expect(stake.connect(stranger).setMinParticipationUsdt(ethers.parseEther('5'))).to.be.reverted;
        await expect(stake.connect(stranger).setWithdrawalFeeBps(500)).to.be.reverted;
        await expect(stake.connect(stranger).setClaimCooldown(3600)).to.be.reverted;
        await expect(stake.connect(stranger).setMaxRewardDays(7)).to.be.reverted;

        await expect(stake.connect(owner).setMinParticipationUsdt(ethers.parseEther('5')))
            .to.emit(stake, 'MinParticipationUsdtUpdated')
            .withArgs(ethers.parseEther('5'));
        await expect(stake.connect(owner).setWithdrawalFeeBps(500))
            .to.emit(stake, 'WithdrawalFeeBpsUpdated')
            .withArgs(500);
        await expect(stake.connect(owner).setClaimCooldown(3600)).to.emit(stake, 'ClaimCooldownUpdated').withArgs(3600);
        await expect(stake.connect(owner).setMaxRewardDays(7)).to.emit(stake, 'MaxRewardDaysUpdated').withArgs(7);

        expect(await stake.minParticipationUsdt()).to.equal(ethers.parseEther('5'));
        expect(await stake.withdrawalFeeBps()).to.equal(500n);
        expect(await stake.claimCooldown()).to.equal(3600n);
        expect(await stake.maxRewardDays()).to.equal(7n);

        await expect(stake.connect(owner).setWithdrawalFeeBps(10_000)).to.be.revertedWith('wrs: fee >=100%');
        await expect(stake.connect(owner).setMinParticipationUsdt(0)).to.be.revertedWith('wrs: zero min');
        await expect(stake.connect(owner).setMaxRewardDays(0)).to.be.revertedWith('wrs: zero days');
    });

    it('E2E timed: daily claims mint through lock; early mature blocked; unlock → EMI release', async function () {
        const { user, treasury, race, stake } = await deployFixture({ enableClaims: true });
        const EMI = 30 * ONE_DAY;

        await stake.connect(user).stakeRace(RACE_100, LOCK_180);
        const opened = await stake.stakeAt(user.address, 0);
        expect(opened.lockPeriod).to.equal(LOCK_180);
        expect(opened.stakedRace).to.equal(RACE_100);

        // Day 1 claim → real RACE minted to user
        await time.increase(ONE_DAY);
        let before = await race.balanceOf(user.address);
        await expect(stake.connect(user).claimReward(0)).to.emit(stake, 'RewardPaid');
        expect(await race.balanceOf(user.address)).to.be.gt(before);

        // Second claim within 24h cooldown blocked
        await expect(stake.connect(user).claimReward(0)).to.be.revertedWith('wrs: claim cooldown');

        // Another day → claim again (accrual continues across lock)
        await time.increase(ONE_DAY);
        before = await race.balanceOf(user.address);
        await stake.connect(user).claimReward(0);
        expect(await race.balanceOf(user.address)).to.be.gt(before);

        // Before unlock: mature blocked
        await expect(stake.connect(user).matureStake(0)).to.be.revertedWith('wrs: locked');

        // Jump to unlock
        await time.increaseTo(opened.unlockAt);
        const treBefore = await race.balanceOf(treasury.address);
        await expect(stake.connect(user).matureStake(0)).to.emit(stake, 'StakeMatured');
        // 10% fee to treasury
        expect(await race.balanceOf(treasury.address)).to.equal(treBefore + ethers.parseEther('10'));

        // EMI1 early blocked; after +30d released
        await expect(stake.connect(user).claimMaturityEmi(0, 1)).to.be.revertedWith('wrs: emi early');
        await time.increase(EMI);
        before = await race.balanceOf(user.address);
        await stake.connect(user).claimMaturityEmi(0, 1);
        expect(await race.balanceOf(user.address)).to.equal(before + ethers.parseEther('30'));

        await time.increase(EMI);
        await stake.connect(user).claimMaturityEmi(0, 2);
        await time.increase(EMI);
        before = await race.balanceOf(user.address);
        await stake.connect(user).claimMaturityEmi(0, 3);
        // EMI3 = 30% remainder of 90% pool = 30 RACE
        expect(await race.balanceOf(user.address)).to.equal(before + ethers.parseEther('30'));

        const done = await stake.stakeAt(user.address, 0);
        expect(done.withdrawn).to.equal(true);
        expect(done.stakedRace).to.equal(0n);
    });

    it('owner can adminReleaseStake after lock; stranger blocked; early blocked', async function () {
        const { owner, user, stranger, treasury, race, stake } = await deployFixture();
        await stake.connect(user).stakeRace(RACE_100, LOCK_180);
        const opened = await stake.stakeAt(user.address, 0);

        await expect(stake.connect(stranger).adminReleaseStake(user.address, 0)).to.be.reverted;
        await expect(stake.connect(owner).adminReleaseStake(user.address, 0)).to.be.revertedWith('wrs: locked');

        await time.increaseTo(opened.unlockAt);
        const treBefore = await race.balanceOf(treasury.address);
        await expect(stake.connect(owner).adminReleaseStake(user.address, 0))
            .to.emit(stake, 'AdminReleaseExecuted')
            .and.to.emit(stake, 'StakeMatured');
        expect(await race.balanceOf(treasury.address)).to.equal(treBefore + ethers.parseEther('10'));

        await time.increase(30 * ONE_DAY);
        const before = await race.balanceOf(user.address);
        await expect(stake.connect(owner).adminClaimMaturityEmi(user.address, 0, 1)).to.emit(
            stake,
            'EmiClaimed',
        );
        expect(await race.balanceOf(user.address)).to.equal(before + ethers.parseEther('30'));
    });

    it('E2E flexible: claim mint then unlock withdraw 90% + 10% treasury', async function () {
        const { user, treasury, race, stake } = await deployFixture({ enableClaims: true });
        // no ICO set → flexible allowed
        await stake.connect(user).stakeRace(RACE_100, 0n);
        await time.increase(ONE_DAY);
        const beforeClaim = await race.balanceOf(user.address);
        await stake.connect(user).claimReward(0);
        expect(await race.balanceOf(user.address)).to.be.gt(beforeClaim);

        // flexible unlockAt = start (lock 0) → withdraw immediately after claim path
        const treBefore = await race.balanceOf(treasury.address);
        const beforeWd = await race.balanceOf(user.address);
        await expect(stake.connect(user).withdrawStake(0)).to.emit(stake, 'StakeWithdrawn');
        expect(await race.balanceOf(treasury.address)).to.equal(treBefore + ethers.parseEther('10'));
        expect(await race.balanceOf(user.address)).to.equal(beforeWd + ethers.parseEther('90'));
    });
});
