const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { deployAndWireRewardOracle, refreshOraclePrice } = require('./helpers/rewardOracle');

describe('RaceICO → staking', function () {
    const PHASE_ALLOC = ethers.parseEther('200000');
    const TOTAL_ALLOC = ethers.parseEther('600000');
    const LOCK_FLEX = 0n;
    const LOCK_180 = BigInt(180 * 24 * 60 * 60);
    const LOCK_365 = BigInt(365 * 24 * 60 * 60);
    const LOCK_730 = BigInt(730 * 24 * 60 * 60);
    const LOCK_1095 = BigInt(1095 * 24 * 60 * 60);

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

        await usdt.mint(buyer.address, ethers.parseEther('1000000'));
        await usdt.mint(buyer2.address, ethers.parseEther('1000000'));
        await usdt.connect(buyer).approve(await ico.getAddress(), ethers.MaxUint256);
        await usdt.connect(buyer2).approve(await ico.getAddress(), ethers.MaxUint256);

        return { owner, buyer, buyer2, stranger, admin, usdt, race, ico, engine };
    }

    async function startPhase(ico, owner, phaseId) {
        await ico.connect(owner).startPhase(phaseId);
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

    it('mints RACE to staking engine not buyer wallet', async function () {
        const { owner, buyer, admin, ico, race, usdt, engine } = await deployFixture();
        await startPhase(ico, owner, 1);
        const usdtIn = ethers.parseEther('100');
        const adminBefore = await usdt.balanceOf(admin.address);

        await expect(ico.connect(buyer).purchase(usdtIn, LOCK_180))
            .to.emit(ico, 'RaceMintedToStaking')
            .and.to.emit(ico, 'ICOPurchased');

        expect(await race.balanceOf(buyer.address)).to.equal(0n);
        expect(await race.balanceOf(await engine.getAddress())).to.equal(ethers.parseEther('400'));
        expect(await usdt.balanceOf(admin.address)).to.equal(adminBefore + usdtIn);
        expect(await engine.lastBuyer()).to.equal(buyer.address);
        expect(await engine.lastLock()).to.equal(LOCK_180);
        expect(await engine.lastRace()).to.equal(ethers.parseEther('400'));
    });

    it('reverts entire purchase if staking creation fails', async function () {
        const { owner, buyer, admin, ico, race, usdt, engine } = await deployFixture();
        await startPhase(ico, owner, 1);
        await engine.setRevertNext(true);
        const adminBefore = await usdt.balanceOf(admin.address);
        await expect(ico.connect(buyer).purchase(ethers.parseEther('100'), LOCK_180)).to.be.revertedWith(
            'mock: stake fail',
        );
        expect(await usdt.balanceOf(admin.address)).to.equal(adminBefore);
        expect(await race.balanceOf(await engine.getAddress())).to.equal(0n);
        expect(await ico.totalSoldRace()).to.equal(0n);
    });

    it('rejects invalid stake plan', async function () {
        const { owner, buyer, ico } = await deployFixture();
        await startPhase(ico, owner, 1);
        await expect(ico.connect(buyer).purchase(ethers.parseEther('10'), 123n)).to.be.revertedWith(
            'RaceICO: bad plan',
        );
    });

    it('180D ICO purchase works', async function () {
        const { owner, buyer, ico, engine } = await deployFixture();
        await startPhase(ico, owner, 1);
        await ico.connect(buyer).purchase(ethers.parseEther('10'), LOCK_180);
        expect(await engine.lastLock()).to.equal(LOCK_180);
    });

    it('365D ICO purchase works', async function () {
        const { owner, buyer, ico, engine } = await deployFixture();
        await startPhase(ico, owner, 1);
        await ico.connect(buyer).purchase(ethers.parseEther('10'), LOCK_365);
        expect(await engine.lastLock()).to.equal(LOCK_365);
    });

    it('730D ICO purchase works', async function () {
        const { owner, buyer, ico, engine } = await deployFixture();
        await startPhase(ico, owner, 1);
        await ico.connect(buyer).purchase(ethers.parseEther('10'), LOCK_730);
        expect(await engine.lastLock()).to.equal(LOCK_730);
    });

    it('1095D ICO purchase works', async function () {
        const { owner, buyer, ico, engine } = await deployFixture();
        await startPhase(ico, owner, 1);
        await ico.connect(buyer).purchase(ethers.parseEther('10'), LOCK_1095);
        expect(await engine.lastLock()).to.equal(LOCK_1095);
    });

    it('accepts all four fixed ICO plans', async function () {
        const { owner, buyer, ico, engine } = await deployFixture();
        await startPhase(ico, owner, 1);
        for (const lock of [LOCK_180, LOCK_365, LOCK_730, LOCK_1095]) {
            await ico.connect(buyer).purchase(ethers.parseEther('10'), lock);
            expect(await engine.lastLock()).to.equal(lock);
        }
    });

    it('requires staking engine', async function () {
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

    it('claim helper reverts to engine path', async function () {
        const { ico } = await deployFixture();
        await expect(ico.claim(0)).to.be.revertedWith('RaceICO: staked - use engine claim/withdraw');
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

    it('final daily rates fixed ICO plans + Flexible post-ICO participate', async function () {
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

        const MockIcoCompletion = await ethers.getContractFactory('MockIcoCompletion');
        const icoStatus = await MockIcoCompletion.deploy();
        await engine.setIcoContract(await icoStatus.getAddress());

        await expect(engine.connect(buyer).participate(USDT_50, LOCK_FLEX)).to.be.revertedWith(
            'engine: flexible after ico only',
        );
        await icoStatus.setIcoCompleted(true);
        await engine.connect(buyer).participate(USDT_50, LOCK_FLEX);
        const flexStake = await engine.stakeAt(buyer.address, (await engine.stakeCount(buyer.address)) - 1n);
        expect(flexStake.dailyRateBps).to.equal(50n);
        expect(flexStake.lockPeriod).to.equal(LOCK_FLEX);
    });

    it('ICO principal stays in engine not buyer wallet', async function () {
        const { buyer, icoGate, engine, race } = await deployEngineFixture();
        await race.mint(await engine.getAddress(), ethers.parseEther('400'));
        await openTestIcoStake(icoGate, engine, buyer.address, USDT_100, ethers.parseEther('400'), LOCK_180, 7);
        expect(await race.balanceOf(buyer.address)).to.equal(0n);
        const stake = await engine.stakeAt(buyer.address, 0);
        expect(stake.stakedRace).to.equal(ethers.parseEther('400'));
        expect(await engine.totalLockedRace()).to.equal(ethers.parseEther('400'));
    });

    it('after ICO completion Flexible + Fixed normal staking work', async function () {
        const { buyer, engine, icoStatus } = await deployWithIcoStatus();
        await icoStatus.setIcoCompleted(true);
        await engine.connect(buyer).participate(USDT_50, LOCK_FLEX);
        await engine.connect(buyer).participate(USDT_50, LOCK_180);
        expect((await engine.stakeAt(buyer.address, 0)).lockPeriod).to.equal(LOCK_FLEX);
        expect((await engine.stakeAt(buyer.address, 1)).lockPeriod).to.equal(LOCK_180);
    });

    it('Flexible allows withdrawal; Fixed uses matureStake (not withdrawStake)', async function () {
        const { buyer, engine, icoStatus, oracle, owner } = await deployWithIcoStatus();
        await icoStatus.setIcoCompleted(true);
        const treasury = (await ethers.getSigners())[5];
        await engine.connect(owner).setMaturityTreasury(treasury.address);

        await engine.connect(buyer).participate(USDT_50, LOCK_FLEX);
        await engine.connect(buyer).participate(USDT_50, LOCK_180);

        await engine.connect(buyer).withdrawStake(0);
        expect((await engine.stakeAt(buyer.address, 0)).withdrawn).to.equal(true);

        await expect(engine.connect(buyer).withdrawStake(1)).to.be.revertedWith('engine: use matureStake');
        await time.increase(LOCK_180 + 1n);
        await refreshOraclePrice(oracle);
        await expect(engine.connect(buyer).withdrawStake(1)).to.be.revertedWith('engine: use matureStake');
        await engine.connect(buyer).matureStake(1);
        expect((await engine.maturityEmiAt(buyer.address, 1)).matured).to.equal(true);
    });

    it('fixed plans early withdraw/mature revert for 365/730/1095', async function () {
        const { buyer, icoGate, engine, race, owner } = await deployEngineFixture();
        const treasury = (await ethers.getSigners())[5];
        await engine.connect(owner).setMaturityTreasury(treasury.address);
        await race.mint(await engine.getAddress(), ethers.parseEther('1200'));
        await openTestIcoStake(icoGate, engine, buyer.address, USDT_100, ethers.parseEther('400'), LOCK_365, 1);
        await openTestIcoStake(icoGate, engine, buyer.address, USDT_100, ethers.parseEther('400'), LOCK_730, 2);
        await openTestIcoStake(icoGate, engine, buyer.address, USDT_100, ethers.parseEther('400'), LOCK_1095, 3);
        await expect(engine.connect(buyer).withdrawStake(0)).to.be.revertedWith('engine: use matureStake');
        await expect(engine.connect(buyer).withdrawStake(1)).to.be.revertedWith('engine: use matureStake');
        await expect(engine.connect(buyer).withdrawStake(2)).to.be.revertedWith('engine: use matureStake');
        await expect(engine.connect(buyer).matureStake(0)).to.be.revertedWith('engine: locked');
        await expect(engine.connect(buyer).matureStake(1)).to.be.revertedWith('engine: locked');
        await expect(engine.connect(buyer).matureStake(2)).to.be.revertedWith('engine: locked');
    });

    it('claim pays RACE to wallet; second claim within 24h reverts', async function () {
        const { buyer, icoGate, engine, race } = await deployEngineFixture();
        await race.mint(await engine.getAddress(), ethers.parseEther('400'));
        await openTestIcoStake(icoGate, engine, buyer.address, USDT_100, ethers.parseEther('400'), LOCK_180, 1);
        await time.increase(ONE_DAY);
        const before = await race.balanceOf(buyer.address);
        await engine.connect(buyer).claimReward(0);
        const after = await race.balanceOf(buyer.address);
        expect(after).to.be.gt(before);
        await expect(engine.connect(buyer).claimReward(0)).to.be.revertedWith('engine: claim cooldown');
    });

    it('compound increases principal without paying wallet', async function () {
        const { buyer, icoGate, engine, race } = await deployEngineFixture();
        await race.mint(await engine.getAddress(), ethers.parseEther('400'));
        await openTestIcoStake(icoGate, engine, buyer.address, USDT_100, ethers.parseEther('400'), LOCK_180, 1);
        await time.increase(ONE_DAY);
        const walletBefore = await race.balanceOf(buyer.address);
        const stakeBefore = await engine.stakeAt(buyer.address, 0);
        await expect(engine.connect(buyer).compoundReward(0)).to.emit(engine, 'RewardCompounded');
        const stakeAfter = await engine.stakeAt(buyer.address, 0);
        expect(stakeAfter.principalUsdt).to.be.gt(stakeBefore.principalUsdt);
        expect(stakeAfter.stakedRace).to.be.gt(stakeBefore.stakedRace);
        expect(stakeAfter.unlockAt).to.equal(stakeBefore.unlockAt);
        expect(await race.balanceOf(buyer.address)).to.equal(walletBefore);
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
        const MockIcoStakeReceiver = await ethers.getContractFactory('MockIcoStakeReceiver');
        const icoEngine = await MockIcoStakeReceiver.deploy();
        const RaceICO = await ethers.getContractFactory('RaceICO');
        const ico = await RaceICO.deploy(owner.address, await race.getAddress(), await usdt.getAddress(), admin.address);
        await ico.setStakingEngine(await icoEngine.getAddress());
        await engine.setIcoContract(await ico.getAddress());
        await deployAndWireRewardOracle(ethers, owner, engine);

        await race.mint(await router.getAddress(), ethers.parseEther('1000000'));
        await usdt.mint(buyer.address, ethers.parseEther('100000'));
        await usdt.connect(buyer).approve(await engine.getAddress(), ethers.MaxUint256);

        expect(await ico.icoCompleted()).to.equal(false);
        await expect(engine.connect(buyer).participate(USDT_50, LOCK_FLEX)).to.be.revertedWith(
            'engine: flexible after ico only',
        );

        // Complete all three phases via owner completeCurrentPhase (authoritative on-chain).
        await ico.connect(owner).startPhase(1);
        await ico.connect(owner).completeCurrentPhase();
        await ico.connect(owner).startPhase(2);
        await ico.connect(owner).completeCurrentPhase();
        await ico.connect(owner).startPhase(3);
        await ico.connect(owner).completeCurrentPhase();
        expect(await ico.icoCompleted()).to.equal(true);

        await engine.connect(buyer).participate(USDT_50, LOCK_FLEX);
        expect((await engine.stakeAt(buyer.address, 0)).lockPeriod).to.equal(LOCK_FLEX);
        await engine.connect(buyer).participate(USDT_50, LOCK_365);
        expect((await engine.stakeAt(buyer.address, 1)).lockPeriod).to.equal(LOCK_365);
    });
});

describe('RaceCoin MAX_SUPPLY 150M', function () {
    it('starts with 10L and max 150M', async function () {
        const [owner] = await ethers.getSigners();
        const RaceCoin = await ethers.getContractFactory('RaceCoin');
        const race = await RaceCoin.deploy(owner.address, owner.address, owner.address, owner.address, owner.address);
        expect(await race.MAX_SUPPLY()).to.equal(ethers.parseEther('150000000'));
        expect(await race.totalSupply()).to.equal(ethers.parseEther('1000000'));
        await race.setMinter(owner.address, true);
        await expect(race.mint(owner.address, ethers.parseEther('149000001'))).to.be.revertedWith(
            'RaceCoin: max supply',
        );
    });
});
