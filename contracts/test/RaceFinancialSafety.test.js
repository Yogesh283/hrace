const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { deployAndWireRewardOracle, refreshOraclePrice } = require('./helpers/rewardOracle');

describe('Financial safety — withdraw settle + reward oracle', function () {
    const USDT_100 = ethers.parseEther('100');
    const LOCK_FLEX = 0n;
    const LOCK_180 = BigInt(180 * 24 * 60 * 60);
    const ONE_DAY = 24 * 60 * 60;
    const ORACLE_PRICE = ethers.parseEther('1'); // $1 / RACE

    async function deployFixture() {
        const [owner, buyer, funder] = await ethers.getSigners();
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
        const oracle = await deployAndWireRewardOracle(ethers, owner, engine, ORACLE_PRICE);
        await engine.setClaimEnabled(true);

        await race.mint(await router.getAddress(), ethers.parseEther('10000000'));
        await usdt.mint(buyer.address, ethers.parseEther('100000'));
        await usdt.connect(buyer).approve(await engine.getAddress(), ethers.MaxUint256);

        return { owner, buyer, funder, usdt, race, router, vault, engine, oracle };
    }

    function expectedDailyRewardRace(principalUsdt, dailyRateBps) {
        const rewardUsdt = (principalUsdt * BigInt(dailyRateBps)) / 10_000n;
        return (rewardUsdt * 10n ** 18n) / ORACLE_PRICE;
    }

    // ── Blocker #1: withdraw settles rewards ───────────────────────────────

    it('1. accrued reward is paid on withdraw (exactly once with principal)', async function () {
        const { buyer, engine, race } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        await time.increase(ONE_DAY);

        const before = await race.balanceOf(buyer.address);
        const stake = await engine.stakeAt(buyer.address, 0);
        const expectedReward = expectedDailyRewardRace(stake.principalUsdt, 50);
        const fee = (stake.stakedRace * 1000n) / 10_000n;
        const netPrincipal = stake.stakedRace - fee;

        await expect(engine.connect(buyer).withdrawStake(0)).to.emit(engine, 'RewardPaid');
        const after = await race.balanceOf(buyer.address);
        expect(after - before).to.equal(expectedReward + netPrincipal);
        expect((await engine.stakeAt(buyer.address, 0)).withdrawn).to.equal(true);
    });

    it('2. partial-day accrual remains zero until full day', async function () {
        const { buyer, engine } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        await time.increase(ONE_DAY / 2);
        expect(await engine.pendingRewardUsdt(buyer.address, 0)).to.equal(0n);
    });

    it('3. fixed maturity: accrual stops at unlockAt; mature settles then creates EMI (not full withdraw)', async function () {
        const { buyer, engine, race, oracle } = await deployFixture();
        const treasuryWallet = (await ethers.getSigners())[5];
        await engine.setMaturityTreasury(treasuryWallet.address);

        await engine.connect(buyer).participate(USDT_100, LOCK_180);
        await time.increase(LOCK_180 + BigInt(ONE_DAY * 10)); // 10 days past maturity
        await refreshOraclePrice(oracle, ORACLE_PRICE);

        const pending = await engine.pendingRewardUsdt(buyer.address, 0);
        const stake = await engine.stakeAt(buyer.address, 0);
        const fullDays = (stake.unlockAt - stake.lastRewardAt) / BigInt(ONE_DAY);
        const fullUsdt = (stake.principalUsdt * 50n * fullDays) / 10_000n;
        expect(fullUsdt).to.be.gt(pending); // uncapped > capped pending view

        const beforeBuyer = await race.balanceOf(buyer.address);
        const beforeTreasury = await race.balanceOf(treasuryWallet.address);
        await expect(engine.connect(buyer).withdrawStake(0)).to.be.revertedWith('engine: use matureStake');
        await engine.connect(buyer).matureStake(0);
        const afterBuyer = await race.balanceOf(buyer.address);
        const afterTreasury = await race.balanceOf(treasuryWallet.address);

        const expectedRewardRace = (fullUsdt * 10n ** 18n) / ORACLE_PRICE;
        const fee = (stake.stakedRace * 1000n) / 10_000n;
        expect(afterBuyer - beforeBuyer).to.equal(expectedRewardRace); // reward only; principal escrowed
        expect(afterTreasury - beforeTreasury).to.equal(fee);

        const emi = await engine.maturityEmiAt(buyer.address, 0);
        expect(emi.matured).to.equal(true);
        expect(emi.emiPoolRace).to.equal(stake.stakedRace - fee);
        expect(emi.emi1Race + emi.emi2Race + emi.emi3Race).to.equal(emi.emiPoolRace);
    });

    it('4. already-claimed reward is not paid again on withdraw', async function () {
        const { buyer, engine, race } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        await time.increase(ONE_DAY);
        await engine.connect(buyer).claimReward(0);
        const afterClaim = await race.balanceOf(buyer.address);
        const stake = await engine.stakeAt(buyer.address, 0);
        const fee = (stake.stakedRace * 1000n) / 10_000n;
        const net = stake.stakedRace - fee;

        await engine.connect(buyer).withdrawStake(0);
        expect(await race.balanceOf(buyer.address)).to.equal(afterClaim + net);
    });

    it('5. withdraw then claim yields no additional reward', async function () {
        const { buyer, engine, race } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        await time.increase(ONE_DAY);
        await engine.connect(buyer).withdrawStake(0);
        const afterWithdraw = await race.balanceOf(buyer.address);
        await expect(engine.connect(buyer).claimReward(0)).to.be.revertedWith('engine: withdrawn');
        expect(await race.balanceOf(buyer.address)).to.equal(afterWithdraw);
    });

    it('6. reward settlement failure reverts entire withdrawal (not withdrawn)', async function () {
        const { buyer, engine, oracle } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        await time.increase(ONE_DAY);
        await oracle.setMaxStaleness(60); // 1 minute
        await time.increase(120);
        await expect(engine.connect(buyer).withdrawStake(0)).to.be.reverted;
        expect((await engine.stakeAt(buyer.address, 0)).withdrawn).to.equal(false);
        await oracle.setMaxStaleness(7 * 24 * 60 * 60);
        await oracle.updatePrice(ORACLE_PRICE);
        await engine.connect(buyer).withdrawStake(0);
        expect((await engine.stakeAt(buyer.address, 0)).withdrawn).to.equal(true);
    });

    it('8. withdrawn flag only after successful settlement', async function () {
        const { buyer, engine, oracle } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        await time.increase(ONE_DAY);
        await oracle.setMaxStaleness(60);
        await time.increase(120);
        await expect(engine.connect(buyer).withdrawStake(0)).to.be.reverted;
        expect((await engine.stakeAt(buyer.address, 0)).withdrawn).to.equal(false);
        await oracle.setMaxStaleness(7 * 24 * 60 * 60);
        await oracle.updatePrice(ORACLE_PRICE);
        await engine.connect(buyer).withdrawStake(0);
        expect((await engine.stakeAt(buyer.address, 0)).withdrawn).to.equal(true);
    });

    it('10. stale oracle price reverts claim/compound', async function () {
        const { buyer, engine, oracle } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        await time.increase(ONE_DAY);
        await oracle.setMaxStaleness(60);
        await time.increase(120);
        await expect(engine.connect(buyer).claimReward(0)).to.be.reverted;
        await expect(engine.connect(buyer).compoundReward(0)).to.be.reverted;
    });

    it('7. principal returned correctly (90% after 10% fee)', async function () {
        const { buyer, engine, race } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        const stake = await engine.stakeAt(buyer.address, 0);
        const fee = (stake.stakedRace * 1000n) / 10_000n;
        const before = await race.balanceOf(buyer.address);
        await engine.connect(buyer).withdrawStake(0);
        // no day elapsed → reward 0
        expect((await race.balanceOf(buyer.address)) - before).to.equal(stake.stakedRace - fee);
    });

    // ── Blocker #2: oracle price security ──────────────────────────────────

    it('9. zero oracle price rejected on update', async function () {
        const { oracle } = await deployFixture();
        await expect(oracle.updatePrice(0)).to.be.revertedWithCustomError(oracle, 'OracleZeroPrice');
    });

    it('11. invalid / out-of-bounds price rejected', async function () {
        const { oracle } = await deployFixture();
        await expect(oracle.updatePrice(ethers.parseEther('0.001'))).to.be.revertedWithCustomError(
            oracle,
            'OracleOutOfBounds',
        );
        await expect(oracle.updatePrice(ethers.parseEther('1000'))).to.be.revertedWithCustomError(
            oracle,
            'OracleOutOfBounds',
        );
    });

    it('12-13. decimal normalization + correct RACE conversion', async function () {
        const { buyer, engine, race } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        await time.increase(ONE_DAY);
        // $100 * 0.50% = $0.50 USDT → 0.5 RACE at $1/RACE
        const before = await race.balanceOf(buyer.address);
        await engine.connect(buyer).claimReward(0);
        expect((await race.balanceOf(buyer.address)) - before).to.equal(ethers.parseEther('0.5'));
    });

    it('14. manipulated Pancake spot does not change reward mint size', async function () {
        const { buyer, engine, race, router } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        await time.increase(ONE_DAY);

        // Crash / inflate spot — reward must still use oracle $1
        await router.setRate(1000, 1);
        const before = await race.balanceOf(buyer.address);
        await engine.connect(buyer).claimReward(0);
        expect((await race.balanceOf(buyer.address)) - before).to.equal(ethers.parseEther('0.5'));

        await time.increase(ONE_DAY);
        await router.setRate(1, 1000);
        const mid = await race.balanceOf(buyer.address);
        await engine.connect(buyer).claimReward(0);
        expect((await race.balanceOf(buyer.address)) - mid).to.equal(ethers.parseEther('0.5'));
    });

    it('15. claim uses secure oracle price source', async function () {
        const { buyer, engine, race, oracle } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        await time.increase(ONE_DAY);
        // Move price within deviation: $1 → $1.10
        await oracle.updatePrice(ethers.parseEther('1.1'));
        const before = await race.balanceOf(buyer.address);
        await engine.connect(buyer).claimReward(0);
        // rewardUsdt=0.5 → race = 0.5/1.1
        const expected = (ethers.parseEther('0.5') * 10n ** 18n) / ethers.parseEther('1.1');
        expect((await race.balanceOf(buyer.address)) - before).to.equal(expected);
    });

    it('16. compound uses same secure oracle price', async function () {
        const { buyer, engine, race, router } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        await time.increase(ONE_DAY);
        await router.setRate(999, 1); // spot noise
        const beforeWallet = await race.balanceOf(buyer.address);
        const beforeStake = await engine.stakeAt(buyer.address, 0);
        await engine.connect(buyer).compoundReward(0);
        const afterStake = await engine.stakeAt(buyer.address, 0);
        expect(await race.balanceOf(buyer.address)).to.equal(beforeWallet);
        expect(afterStake.principalUsdt - beforeStake.principalUsdt).to.equal(ethers.parseEther('0.5'));
        expect(afterStake.stakedRace - beforeStake.stakedRace).to.equal(ethers.parseEther('0.5'));
    });

    it('17. abnormal update deviation rejected', async function () {
        const { oracle } = await deployFixture();
        // Default max deviation 20% — jump $1 → $2 should fail
        await expect(oracle.updatePrice(ethers.parseEther('2'))).to.be.revertedWithCustomError(
            oracle,
            'OracleDeviation',
        );
    });

    it('D. same withdraw cannot double-mint reward', async function () {
        const { buyer, engine, race } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        await time.increase(ONE_DAY);
        await engine.connect(buyer).withdrawStake(0);
        const bal = await race.balanceOf(buyer.address);
        await expect(engine.connect(buyer).withdrawStake(0)).to.be.revertedWith('engine: withdrawn');
        expect(await race.balanceOf(buyer.address)).to.equal(bal);
    });
});
