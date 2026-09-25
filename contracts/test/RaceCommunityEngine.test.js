const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { deployAndWireRewardOracle } = require('./helpers/rewardOracle');

describe('RaceCommunityEngine', function () {
    const USDT_50 = ethers.parseEther('50');
    const ONE_DAY = 24 * 60 * 60;

    async function deployFixture() {
        const [owner, sponsor, user, funder] = await ethers.getSigners();

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

        await usdt.mint(sponsor.address, ethers.parseEther('1000'));
        await usdt.mint(user.address, ethers.parseEther('1000'));
        await race.mint(await router.getAddress(), ethers.parseEther('1000000'));
        await race.mint(funder.address, ethers.parseEther('1000000'));
        await race.connect(funder).approve(await vault.getAddress(), ethers.parseEther('100000'));
        await vault.connect(funder).fund(ethers.parseEther('100000'));

        await usdt.connect(sponsor).approve(await engine.getAddress(), ethers.parseEther('1000'));
        await engine.connect(sponsor).register(ethers.ZeroAddress);
        await usdt.connect(user).approve(await engine.getAddress(), ethers.parseEther('1000'));
        await engine.connect(user).register(sponsor.address);

        await engine.connect(sponsor).participate(USDT_50, 0);

        return { owner, sponsor, user, funder, usdt, race, router, vault, engine, oracle };
    }

    it('auto-registers on participate when not registered', async function () {
        const { usdt, engine } = await deployFixture();
        const [, , , stranger] = await ethers.getSigners();

        await usdt.mint(stranger.address, ethers.parseEther('100'));
        await usdt.connect(stranger).approve(await engine.getAddress(), ethers.parseEther('100'));

        await expect(engine.connect(stranger).participate(USDT_50, 0))
            .to.emit(engine, 'MemberRegistered')
            .and.to.emit(engine, 'MemberActivated')
            .and.to.emit(engine, 'ParticipationPurchased');

        expect(await engine.isRegistered(stranger.address)).to.equal(true);
        expect(await engine.stakeCount(stranger.address)).to.equal(1);
    });

    it('emits MemberActivated on register', async function () {
        const { engine } = await deployFixture();
        const [, , , stranger] = await ethers.getSigners();

        await expect(engine.connect(stranger).register(ethers.ZeroAddress))
            .to.emit(engine, 'MemberActivated')
            .and.to.emit(engine, 'MemberRegistered');
    });

    it('pays daily rewards in RACE from vault', async function () {
        const { user, engine, race } = await deployFixture();

        await engine.connect(user).participate(USDT_50, 0);
        await engine.setClaimEnabled(true);
        await time.increase(ONE_DAY);

        const pending = await engine.pendingRewardRace(user.address, 0);
        expect(pending).to.be.gt(0);

        await expect(engine.connect(user).claimReward(0)).to.emit(engine, 'RewardPaid');
        expect(await race.balanceOf(user.address)).to.be.gt(0);
    });

    it('pays community referrals on participate', async function () {
        const { sponsor, user, engine } = await deployFixture();

        await expect(engine.connect(user).participate(USDT_50, 0))
            .to.emit(engine, 'ParticipationPurchased')
            .and.to.emit(engine, 'CommunityReferralPaid');
    });

    it('pays L2 community referral when upline is self-active with only one direct', async function () {
        const { usdt, race, engine } = await deployFixture();
        const signers = await ethers.getSigners();
        const l2 = signers[4];
        const mid = signers[5];
        const leaf = signers[6];

        // Chain: l2 → mid → leaf. l2 has only 1 participation direct (mid).
        for (const [who, ref] of [
            [l2, ethers.ZeroAddress],
            [mid, l2.address],
            [leaf, mid.address],
        ]) {
            await usdt.mint(who.address, ethers.parseEther('100'));
            await usdt.connect(who).approve(await engine.getAddress(), ethers.parseEther('100'));
            await engine.connect(who).register(ref);
        }

        await engine.connect(l2).participate(USDT_50, 0);
        await engine.connect(mid).participate(USDT_50, 0);

        const l2Before = await race.balanceOf(l2.address);
        await expect(engine.connect(leaf).participate(USDT_50, 0)).to.emit(engine, 'CommunityReferralPaid');

        // L2 = 1% of $50; paid even though l2 has only 1 direct (not 2).
        expect(await race.balanceOf(l2.address)).to.be.gt(l2Before);
        const stats = await engine.memberStats(l2.address);
        expect(stats[3]).to.equal(1n); // participationDirectCount
    });

    it('charges team reward fee on withdraw', async function () {
        const { user, sponsor, engine, race } = await deployFixture();

        await engine.connect(user).participate(USDT_50, 0);
        const sponsorBefore = await race.balanceOf(sponsor.address);

        await time.increase(ONE_DAY);
        await engine.connect(user).withdrawStake(0);

        const sponsorAfter = await race.balanceOf(sponsor.address);
        expect(sponsorAfter).to.be.gt(sponsorBefore);
    });

    it('only vault engine may pay rewards', async function () {
        const { vault, user } = await deployFixture();
        await expect(vault.pay(user.address, 1)).to.be.revertedWith('RaceRewardVault: not engine');
    });

    it('pays leadership as roi of roi (team daily roi x rank %)', async function () {
        const { sponsor, user, funder, usdt, race, engine, vault } = await deployFixture();
        const [, , , userB] = await ethers.getSigners();

        const USDT_2000 = ethers.parseEther('2000');
        const LOCK_180 = 180 * 24 * 60 * 60;

        await usdt.mint(user.address, USDT_2000);
        await usdt.connect(user).approve(await engine.getAddress(), ethers.MaxUint256);
        await usdt.mint(userB.address, ethers.parseEther('2010'));
        await usdt.connect(userB).approve(await engine.getAddress(), ethers.MaxUint256);
        await race.mint(funder.address, ethers.parseEther('500000'));
        await race.connect(funder).approve(await vault.getAddress(), ethers.parseEther('500000'));
        await vault.connect(funder).fund(ethers.parseEther('500000'));

        await engine.connect(userB).register(sponsor.address);
        await engine.connect(user).participate(USDT_2000, 0);
        await engine.connect(userB).participate(USDT_2000, LOCK_180);

        const stats = await engine.memberStats(sponsor.address);
        const teamDailyRoi = stats[2];
        expect(teamDailyRoi).to.equal(ethers.parseEther('17'));

        const latest = await ethers.provider.getBlock('latest');
        const day = BigInt(Math.floor(Number(latest.timestamp) / 86400)) - 1n;
        const sponsorBefore = await race.balanceOf(sponsor.address);
        await engine.setClaimEnabled(true);
        await expect(engine.distributeLeadershipForMember(sponsor.address, day - 1n)).to.be.revertedWith(
            'engine: only yesterday',
        );
        await engine.distributeLeadershipForMember(sponsor.address, day);
        const sponsorAfter = await race.balanceOf(sponsor.address);
        expect(sponsorAfter).to.be.gt(sponsorBefore);
    });

    it('pays own ROI on $1–$49 without participation activation or referral income', async function () {
        const { sponsor, user, usdt, race, engine } = await deployFixture();
        const USDT_40 = ethers.parseEther('40');

        await usdt.mint(user.address, USDT_40);
        await usdt.connect(user).approve(await engine.getAddress(), ethers.MaxUint256);

        const sponsorBefore = await engine.memberStats(sponsor.address);
        const sponsorRaceBefore = await race.balanceOf(sponsor.address);
        await engine.connect(user).participate(USDT_40, 0);

        expect(await engine.isParticipationActive(user.address)).to.equal(false);
        const stake = await engine.stakeAt(user.address, 0);
        expect(stake.dailyRateBps).to.equal(35n);
        expect(stake.principalUsdt).to.equal(USDT_40);

        const sponsorAfter = await engine.memberStats(sponsor.address);
        expect(sponsorAfter[1] - sponsorBefore[1]).to.equal(USDT_40); // teamParticipationUsdt
        expect(sponsorAfter[2] - sponsorBefore[2]).to.equal(ethers.parseEther('0.14')); // 40 * 0.35%
        expect(await race.balanceOf(sponsor.address)).to.equal(sponsorRaceBefore); // no referral payout

        await time.increase(ONE_DAY);
        await engine.setClaimEnabled(true);
        await expect(engine.connect(user).claimReward(0)).to.emit(engine, 'RewardPaid');
        expect(await race.balanceOf(user.address)).to.be.gt(0);
    });
});
