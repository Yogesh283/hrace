const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { deployAndWireRewardOracle, refreshOraclePrice } = require('./helpers/rewardOracle');

describe('RaceICO → hold → createStake', function () {
    const PHASE_ALLOC = ethers.parseEther('200000');
    const TOTAL_ALLOC = ethers.parseEther('600000');
    const LOCK_FLEX = 0n;
    const LOCK_180 = BigInt(180 * 24 * 60 * 60);
    const LOCK_365 = BigInt(365 * 24 * 60 * 60);
    const LOCK_730 = BigInt(730 * 24 * 60 * 60);
    const LOCK_1095 = BigInt(1095 * 24 * 60 * 60);
    const STAKE_NOT_CREATED = 2n ** 256n - 1n;

    async function deployFixture() {
        const [owner, buyer, buyer2, stranger, admin] = await ethers.getSigners();

        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const usdt = await MockERC20.deploy('USDT', 'USDT', 18);
        const race = await MockERC20.deploy('RACE', 'RACE', 18);

        const MockIcoStakeReceiver = await ethers.getContractFactory('MockIcoStakeReceiver');
        const engine = await MockIcoStakeReceiver.deploy();

        const RaceICO = await ethers.getContractFactory('RaceICO');
        const ico = await RaceICO.deploy(
            owner.address,
            await race.getAddress(),
            await usdt.getAddress(),
            admin.address,
        );
        await ico.connect(owner).setStakingEngine(await engine.getAddress());

        const ICOContract = await ethers.getContractFactory('ICOContract');
        const icoReserve = await ICOContract.deploy(owner.address, await race.getAddress(), admin.address);
        await icoReserve.setRaceIco(await ico.getAddress());
        await ico.setIcoReserve(await icoReserve.getAddress());
        await race.mint(admin.address, TOTAL_ALLOC);
        await race.connect(admin).approve(await icoReserve.getAddress(), TOTAL_ALLOC);
        await icoReserve.connect(admin).depositReserve(TOTAL_ALLOC);
        await usdt.mint(buyer.address, ethers.parseEther('1000000'));
        await usdt.mint(buyer2.address, ethers.parseEther('1000000'));
        await usdt.connect(buyer).approve(await ico.getAddress(), ethers.MaxUint256);
        await usdt.connect(buyer2).approve(await ico.getAddress(), ethers.MaxUint256);

        return { owner, buyer, buyer2, stranger, admin, usdt, race, ico, icoReserve, engine };
    }

    async function startPhase(ico, owner, phaseId) {
        await ico.connect(owner).startPhase(phaseId);
    }

    async function completeIco(ico, owner) {
        for (let phase = 1; phase <= 3; phase++) {
            const p = await ico.getPhase(phase);
            if (p.completed) continue;
            if (!p.started) {
                await ico.connect(owner).startPhase(phase);
            }
            await ico.connect(owner).completeCurrentPhase();
        }
    }

    it('has fixed prices and 600k cap', async function () {
        const { ico } = await deployFixture();
        expect(await ico.phase1PriceUsdt()).to.equal(ethers.parseEther('0.25'));
        expect(await ico.TOTAL_ALLOCATION()).to.equal(TOTAL_ALLOC);
        expect(await ico.PHASE_ALLOCATION()).to.equal(PHASE_ALLOC);
    });

    it('Flexible ICO purchase reverts', async function () {
        const { owner, buyer, ico } = await deployFixture();
        await startPhase(ico, owner, 1);
        await expect(ico.connect(buyer).purchase(ethers.parseEther('10'), LOCK_FLEX)).to.be.revertedWith(
            'RaceICO: bad plan',
        );
        expect(await ico.isValidStakePlan(LOCK_FLEX)).to.equal(false);
    });

    it('allocates RACE from reserve to ICO hold not buyer wallet or engine', async function () {
        const { owner, buyer, admin, ico, icoReserve, race, usdt, engine } = await deployFixture();
        await startPhase(ico, owner, 1);
        const usdtIn = ethers.parseEther('100');
        const adminBefore = await usdt.balanceOf(admin.address);

        await expect(ico.connect(buyer).purchase(usdtIn, LOCK_180))
            .to.emit(ico, 'RaceMintedToHold')
            .and.to.emit(ico, 'ICOPurchased');

        expect(await race.balanceOf(buyer.address)).to.equal(0n);
        expect(await race.balanceOf(await engine.getAddress())).to.equal(0n);
        expect(await race.balanceOf(await ico.getAddress())).to.equal(ethers.parseEther('400'));
        expect(await race.balanceOf(await icoReserve.getAddress())).to.equal(TOTAL_ALLOC - ethers.parseEther('400'));
        expect(await ico.icoReserveAvailable()).to.equal(TOTAL_ALLOC - ethers.parseEther('400'));
        expect(await ico.userHeldRace(buyer.address)).to.equal(ethers.parseEther('400'));
        expect(await ico.totalHeldRace()).to.equal(ethers.parseEther('400'));
        expect(await usdt.balanceOf(admin.address)).to.equal(adminBefore + usdtIn);
        expect(await engine.holdProcessed()).to.equal(false);
        expect(await engine.stakeCount()).to.equal(0n);

        const purchase = await ico.getPurchase(0);
        expect(purchase.claimed).to.equal(0n);
        expect(purchase.stakeIndex).to.equal(STAKE_NOT_CREATED);
    });

    it('createStake before icoCompleted reverts', async function () {
        const { owner, buyer, ico } = await deployFixture();
        await startPhase(ico, owner, 1);
        await ico.connect(buyer).purchase(ethers.parseEther('100'), LOCK_180);
        await expect(ico.connect(buyer).createStake(0)).to.be.revertedWith('RaceICO: ico active');
    });

    it('after ICO complete createStake opens engine stake at live Pancake price', async function () {
        const { owner, buyer, ico, race, engine } = await deployFixture();
        await startPhase(ico, owner, 1);
        await ico.connect(buyer).purchase(ethers.parseEther('100'), LOCK_180); // 400 RACE @ $0.25
        await completeIco(ico, owner);

        expect(await ico.icoCompleted()).to.equal(true);
        expect(await ico.icoEndPriceUsdt()).to.equal(ethers.parseEther('0.45'));

        const principal = await ico.quoteStakePrincipal(ethers.parseEther('400'));
        // Mock live price $0.10 → 400 * 0.10 = 40 USDT notional
        expect(principal).to.equal(ethers.parseEther('40'));

        await expect(ico.connect(buyer).createStake(0))
            .to.emit(ico, 'ICOHoldStakeCreated')
            .and.to.emit(ico, 'RaceMintedToStaking');

        expect(await race.balanceOf(await ico.getAddress())).to.equal(0n);
        expect(await race.balanceOf(await engine.getAddress())).to.equal(ethers.parseEther('400'));
        expect(await ico.userHeldRace(buyer.address)).to.equal(0n);
        expect(await engine.lastBuyer()).to.equal(buyer.address);
        expect(await engine.lastLock()).to.equal(LOCK_180);
        expect(await engine.lastRace()).to.equal(ethers.parseEther('400'));
        expect(await engine.lastUsdt()).to.equal(ethers.parseEther('40'));
        expect(await engine.holdProcessed()).to.equal(true);
        expect(await engine.lastHoldUsdt()).to.equal(ethers.parseEther('100'));

        const purchase = await ico.getPurchase(0);
        expect(purchase.claimed).to.equal(ethers.parseEther('400'));
        expect(purchase.stakeIndex).to.equal(0n);

        await expect(ico.connect(buyer).createStake(0)).to.be.revertedWith('RaceICO: already staked');
    });

    it('rejects invalid stake plan', async function () {
        const { owner, buyer, ico } = await deployFixture();
        await startPhase(ico, owner, 1);
        await expect(ico.connect(buyer).purchase(ethers.parseEther('10'), 123n)).to.be.revertedWith(
            'RaceICO: bad plan',
        );
    });

    it('180D ICO purchase holds then createStake works', async function () {
        const { owner, buyer, ico, engine } = await deployFixture();
        await startPhase(ico, owner, 1);
        await ico.connect(buyer).purchase(ethers.parseEther('10'), LOCK_180);
        await completeIco(ico, owner);
        await ico.connect(buyer).createStake(0);
        expect(await engine.lastLock()).to.equal(LOCK_180);
    });

    it('365D / 730D / 1095D createStake after hold', async function () {
        const { owner, buyer, ico, engine } = await deployFixture();
        await startPhase(ico, owner, 1);
        await ico.connect(buyer).purchase(ethers.parseEther('10'), LOCK_365);
        await ico.connect(buyer).purchase(ethers.parseEther('10'), LOCK_730);
        await ico.connect(buyer).purchase(ethers.parseEther('10'), LOCK_1095);
        await completeIco(ico, owner);
        await ico.connect(buyer).createAllStakes();
        expect(await engine.lastLock()).to.equal(LOCK_1095);
        expect(await ico.pendingStakeCount(buyer.address)).to.equal(0n);
    });

    it('requires engine on purchase (needed later for createStake)', async function () {
        const [owner, buyer, admin] = await ethers.getSigners();
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const usdt = await MockERC20.deploy('USDT', 'USDT', 18);
        const race = await MockERC20.deploy('RACE', 'RACE', 18);
        const RaceICO = await ethers.getContractFactory('RaceICO');
        const ico = await RaceICO.deploy(owner.address, await race.getAddress(), await usdt.getAddress(), admin.address);
        await usdt.mint(buyer.address, ethers.parseEther('100'));
        await usdt.connect(buyer).approve(await ico.getAddress(), ethers.MaxUint256);
        await ico.connect(owner).startPhase(1);
        await expect(ico.connect(buyer).purchase(ethers.parseEther('10'), LOCK_180)).to.be.revertedWith(
            'RaceICO: no engine',
        );
    });

    it('purchase succeeds even if level-income would fail; createStake pays income', async function () {
        const { owner, buyer, admin, ico, race, usdt, engine } = await deployFixture();
        await startPhase(ico, owner, 1);
        await engine.setRevertHold(true);
        const adminBefore = await usdt.balanceOf(admin.address);
        await ico.connect(buyer).purchase(ethers.parseEther('100'), LOCK_180);
        expect(await usdt.balanceOf(admin.address)).to.equal(adminBefore + ethers.parseEther('100'));
        expect(await race.balanceOf(await ico.getAddress())).to.equal(ethers.parseEther('400'));
        expect(await engine.holdProcessed()).to.equal(false);
        await completeIco(ico, owner);
        await expect(ico.connect(buyer).createStake(0)).to.be.revertedWith('mock: hold fail');
        await engine.setRevertHold(false);
        await ico.connect(buyer).createStake(0);
        expect(await engine.holdProcessed()).to.equal(true);
        expect(await engine.lastHoldUsdt()).to.equal(ethers.parseEther('100'));
    });

    it('purchase reverts when ICO reserve is empty', async function () {
        const [owner, buyer, admin] = await ethers.getSigners();
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const usdt = await MockERC20.deploy('USDT', 'USDT', 18);
        const race = await MockERC20.deploy('RACE', 'RACE', 18);
        const MockIcoStakeReceiver = await ethers.getContractFactory('MockIcoStakeReceiver');
        const engine = await MockIcoStakeReceiver.deploy();
        const RaceICO = await ethers.getContractFactory('RaceICO');
        const ico = await RaceICO.deploy(owner.address, await race.getAddress(), await usdt.getAddress(), admin.address);
        await ico.connect(owner).setStakingEngine(await engine.getAddress());
        const ICOContract = await ethers.getContractFactory('ICOContract');
        const icoReserve = await ICOContract.deploy(owner.address, await race.getAddress(), admin.address);
        await icoReserve.setRaceIco(await ico.getAddress());
        await ico.setIcoReserve(await icoReserve.getAddress());
        await usdt.mint(buyer.address, ethers.parseEther('100'));
        await usdt.connect(buyer).approve(await ico.getAddress(), ethers.MaxUint256);
        await ico.connect(owner).startPhase(1);
        await expect(ico.connect(buyer).purchase(ethers.parseEther('10'), LOCK_180)).to.be.revertedWith(
            'RaceICO: reserve empty',
        );
    });

    it('protects 600k ICO inventory on the ICO contract', async function () {
        const { owner, buyer, ico, icoReserve, race } = await deployFixture();
        expect(await ico.withdrawableUnsoldRace()).to.equal(0n);
        expect(await ico.icoReserveAvailable()).to.equal(TOTAL_ALLOC);
        await startPhase(ico, owner, 1);
        await ico.connect(buyer).purchase(ethers.parseEther('100'), LOCK_180);
        expect(await ico.withdrawableUnsoldRace()).to.equal(0n);
        expect(await race.balanceOf(await icoReserve.getAddress())).to.equal(TOTAL_ALLOC - ethers.parseEther('400'));
        await race.mint(await ico.getAddress(), ethers.parseEther('100'));
        expect(await ico.withdrawableUnsoldRace()).to.equal(ethers.parseEther('100'));
        await completeIco(ico, owner);
        expect(await ico.withdrawableUnsoldRace()).to.equal(ethers.parseEther('100'));
        await expect(icoReserve.withdrawLeftover(owner.address, TOTAL_ALLOC - ethers.parseEther('400')))
            .to.emit(icoReserve, 'LeftoverWithdrawn');
    });

    it('claim helper reverts to hold/stake path', async function () {
        const { ico } = await deployFixture();
        await expect(ico.claim(0)).to.be.revertedWith('RaceICO: hold/stake - use createStake then engine claim');
    });
});

describe('RaceCommunityEngine ICO stake + final rates', function () {
    const USDT_100 = ethers.parseEther('100');
    const USDT_50 = ethers.parseEther('50');
    const LOCK_FLEX = 0n;
    const LOCK_180 = BigInt(180 * 24 * 60 * 60);
    const LOCK_365 = BigInt(365 * 24 * 60 * 60);
    const LOCK_730 = BigInt(730 * 24 * 60 * 60);
    const LOCK_1095 = BigInt(1095 * 24 * 60 * 60);
    const ONE_DAY = 24 * 60 * 60;

    async function deployEngineFixture() {
        const [owner, buyer, icoSigner, funder] = await ethers.getSigners();
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
        const MockIcoCompletion = await ethers.getContractFactory('MockIcoCompletion');
        const icoGate = await MockIcoCompletion.deploy();
        await engine.setIcoContract(await icoGate.getAddress());
        await icoGate.setIcoCompleted(true);
        await engine.setClaimEnabled(true);
        const oracle = await deployAndWireRewardOracle(ethers, owner, engine);
        await race.mint(await router.getAddress(), ethers.parseEther('1000000'));
        await race.mint(funder.address, ethers.parseEther('1000000'));
        await usdt.mint(buyer.address, ethers.parseEther('100000'));
        await usdt.connect(buyer).approve(await engine.getAddress(), ethers.MaxUint256);
        return { owner, buyer, icoSigner: icoGate, icoGate, usdt, race, router, vault, engine, oracle };
    }

    async function openTestIcoStake(icoGate, engine, buyer, usdtPaid, raceAmount, lock, purchaseId) {
        return icoGate.openIcoStakeFor(await engine.getAddress(), buyer, usdtPaid, raceAmount, lock, purchaseId);
    }

    async function deployWithIcoStatus() {
        const base = await deployEngineFixture();
        const MockIcoCompletion = await ethers.getContractFactory('MockIcoCompletion');
        const icoStatus = await MockIcoCompletion.deploy();
        await base.engine.setIcoContract(await icoStatus.getAddress());
        await icoStatus.setIcoCompleted(false);
        await base.engine.setClaimEnabled(true);
        return { ...base, icoStatus, icoGate: icoStatus, icoSigner: icoStatus, oracle: base.oracle };
    }

    it('openIcoStake rejects Flexible', async function () {
        const { buyer, icoGate, engine, race } = await deployEngineFixture();
        await race.mint(await engine.getAddress(), ethers.parseEther('400'));
        await expect(
            openTestIcoStake(icoGate, engine, buyer.address, USDT_100, ethers.parseEther('400'), LOCK_FLEX, 1),
        ).to.be.revertedWith('engine: ico no flexible');
    });

    it('openIcoStake rejects if race not funded', async function () {
        const { buyer, icoGate, engine } = await deployEngineFixture();
        await expect(
            openTestIcoStake(icoGate, engine, buyer.address, USDT_100, ethers.parseEther('400'), LOCK_180, 1),
        ).to.be.revertedWith('engine: race not funded');
    });

    it('processIcoHold then openIcoStake does not double level income', async function () {
        const { buyer, engine, race } = await deployEngineFixture();
        const MockIcoCompletion = await ethers.getContractFactory('MockIcoCompletion');
        const ico = await MockIcoCompletion.deploy();
        await engine.setIcoContract(await ico.getAddress());
        await ico.setIcoCompleted(true);

        await ico.processIcoHoldFor(await engine.getAddress(), buyer.address, USDT_100, 7);
        expect(await engine.icoHoldLevelIncomePaid(7)).to.equal(true);
        expect(await engine.isParticipationActive(buyer.address)).to.equal(true);

        await race.mint(await engine.getAddress(), ethers.parseEther('400'));
        await ico.openIcoStakeFor(
            await engine.getAddress(),
            buyer.address,
            ethers.parseEther('180'),
            ethers.parseEther('400'),
            LOCK_180,
            7,
        );
        const stats = await engine.memberStats(buyer.address);
        // selfParticipation only counted once at hold (100), not again at createStake (180)
        expect(stats.selfParticipationUsdt).to.equal(USDT_100);
    });


    it('final daily rates fixed ICO plans', async function () {
        const { buyer, icoGate, engine, race } = await deployEngineFixture();
        const fixed = [
            [LOCK_180, 50n],
            [LOCK_365, 70n],
            [LOCK_730, 90n],
            [LOCK_1095, 100n],
        ];
        for (let i = 0; i < fixed.length; i++) {
            const [lock, bps] = fixed[i];
            await race.mint(await engine.getAddress(), ethers.parseEther('400'));
            await icoGate.openIcoStakeFor(
                await engine.getAddress(),
                buyer.address,
                USDT_100,
                ethers.parseEther('400'),
                lock,
                i + 1,
            );
            const stake = await engine.stakeAt(buyer.address, i);
            expect(stake.dailyRateBps).to.equal(bps);
            expect(stake.lockPeriod).to.equal(lock);
        }
    });

    it('authoritative RaceICO.icoCompleted unlocks Flexible participate', async function () {
        const [owner, buyer, admin] = await ethers.getSigners();
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
        await race.mint(await router.getAddress(), ethers.parseEther('1000000'));

        const RaceICO = await ethers.getContractFactory('RaceICO');
        const ico = await RaceICO.deploy(owner.address, await race.getAddress(), await usdt.getAddress(), admin.address);
        await ico.setStakingEngine(await engine.getAddress());
        await engine.setIcoContract(await ico.getAddress());

        await usdt.mint(buyer.address, USDT_50);
        await usdt.connect(buyer).approve(await engine.getAddress(), ethers.MaxUint256);
        await expect(engine.connect(buyer).participate(USDT_50, LOCK_FLEX)).to.be.revertedWith(
            'engine: flexible after ico only',
        );

        await ico.connect(owner).startPhase(1);
        await ico.connect(owner).completeCurrentPhase();
        await ico.connect(owner).startPhase(2);
        await ico.connect(owner).completeCurrentPhase();
        await ico.connect(owner).startPhase(3);
        await ico.connect(owner).completeCurrentPhase();
        expect(await ico.icoCompleted()).to.equal(true);
        expect(await ico.icoEndPriceUsdt()).to.equal(ethers.parseEther('0.45'));

        await engine.connect(buyer).participate(USDT_50, LOCK_FLEX);
        const stake = await engine.stakeAt(buyer.address, 0);
        expect(stake.lockPeriod).to.equal(LOCK_FLEX);
    });
});
