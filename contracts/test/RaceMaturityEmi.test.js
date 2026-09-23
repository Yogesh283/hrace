const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { deployAndWireRewardOracle, refreshOraclePrice } = require('./helpers/rewardOracle');

describe('Fixed maturity EMI — RaceCommunityEngine', function () {
    const USDT_100 = ethers.parseEther('100');
    const LOCK_FLEX = 0n;
    const LOCK_180 = BigInt(180 * 24 * 60 * 60);
    const ONE_DAY = 24 * 60 * 60;
    const EMI_INTERVAL = 30 * ONE_DAY;
    const ORACLE_PRICE = ethers.parseEther('1');

    async function deployFixture() {
        const [owner, buyer, outsider] = await ethers.getSigners();
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

        const RaceMultiSig = await ethers.getContractFactory('RaceMultiSig');
        const signers = await ethers.getSigners();
        const multiSig = await RaceMultiSig.deploy([
            signers[0].address,
            signers[1].address,
            signers[2].address,
            signers[3].address,
            signers[4].address,
        ]);
        const RaceTreasury = await ethers.getContractFactory('RaceTreasury');
        const treasury = await RaceTreasury.deploy(
            owner.address,
            await race.getAddress(),
            await multiSig.getAddress(),
        );
        await engine.setMaturityTreasury(await treasury.getAddress());

        await race.mint(await router.getAddress(), ethers.parseEther('10000000'));
        await usdt.mint(buyer.address, ethers.parseEther('100000'));
        await usdt.connect(buyer).approve(await engine.getAddress(), ethers.MaxUint256);

        return { owner, buyer, outsider, usdt, race, router, vault, engine, oracle, treasury, multiSig };
    }

    async function openFixedAndMature(buyer, engine, oracle) {
        await engine.connect(buyer).participate(USDT_100, LOCK_180);
        await time.increase(LOCK_180 + 1n);
        await refreshOraclePrice(oracle, ORACLE_PRICE);
        await engine.connect(buyer).matureStake(0);
        return engine.maturityEmiAt(buyer.address, 0);
    }

    it('1. Fixed stake cannot mature early', async function () {
        const { buyer, engine } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_180);
        await expect(engine.connect(buyer).matureStake(0)).to.be.revertedWith('engine: locked');
    });

    it('2. Maturity settles pending reward first', async function () {
        const { buyer, engine, race, oracle } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_180);
        await time.increase(LOCK_180 + BigInt(ONE_DAY));
        await refreshOraclePrice(oracle, ORACLE_PRICE);
        const before = await race.balanceOf(buyer.address);
        await expect(engine.connect(buyer).matureStake(0)).to.emit(engine, 'RewardPaid');
        expect(await race.balanceOf(buyer.address)).to.be.gt(before);
    });

    it('3+18. Exactly 10% goes to RaceTreasury', async function () {
        const { buyer, engine, race, oracle, treasury } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_180);
        const stake = await engine.stakeAt(buyer.address, 0);
        await time.increase(LOCK_180 + 1n);
        await refreshOraclePrice(oracle, ORACLE_PRICE);
        const before = await treasury.balance();
        await engine.connect(buyer).matureStake(0);
        const fee = (stake.stakedRace * 1000n) / 10_000n;
        expect((await treasury.balance()) - before).to.equal(fee);
        expect(await race.balanceOf(await treasury.getAddress())).to.equal(fee);
    });

    it('4. 90% remains in Engine escrow', async function () {
        const { buyer, engine, race, oracle } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_180);
        const principal = (await engine.stakeAt(buyer.address, 0)).stakedRace;
        await time.increase(LOCK_180 + 1n);
        await refreshOraclePrice(oracle, ORACLE_PRICE);
        await engine.connect(buyer).matureStake(0);
        const pool = (principal * 9000n) / 10_000n;
        expect(await engine.totalEmiEscrowRace()).to.equal(pool);
        expect(await race.balanceOf(await engine.getAddress())).to.be.gte(pool);
    });

    it('5+6+7. EMI due +30/+60/+90 days', async function () {
        const { buyer, engine, oracle } = await deployFixture();
        const emi = await openFixedAndMature(buyer, engine, oracle);
        const dues = await engine.maturityEmiDueAt(buyer.address, 0);
        expect(dues.due1 - emi.maturityAt).to.equal(BigInt(EMI_INTERVAL));
        expect(dues.due2 - emi.maturityAt).to.equal(BigInt(EMI_INTERVAL * 2));
        expect(dues.due3 - emi.maturityAt).to.equal(BigInt(EMI_INTERVAL * 3));
    });

    it('8. EMI amounts total exactly 90%', async function () {
        const { buyer, engine, oracle } = await deployFixture();
        const emi = await openFixedAndMature(buyer, engine, oracle);
        expect(emi.emi1Race + emi.emi2Race + emi.emi3Race).to.equal(emi.emiPoolRace);
        expect(emi.feeRace + emi.emiPoolRace).to.equal(emi.principalRace);
        expect(emi.emi1Race).to.equal((emi.principalRace * 3000n) / 10_000n);
        expect(emi.emi2Race).to.equal((emi.principalRace * 3000n) / 10_000n);
        expect(emi.emi3Race).to.equal(emi.emiPoolRace - emi.emi1Race - emi.emi2Race);
    });

    it('9. EMI1 cannot be claimed early', async function () {
        const { buyer, engine, oracle } = await deployFixture();
        await openFixedAndMature(buyer, engine, oracle);
        await expect(engine.connect(buyer).claimMaturityEmi(0, 1)).to.be.revertedWith('engine: emi early');
    });

    it('10. EMI2 cannot be claimed early', async function () {
        const { buyer, engine, oracle } = await deployFixture();
        await openFixedAndMature(buyer, engine, oracle);
        await time.increase(EMI_INTERVAL);
        await engine.connect(buyer).claimMaturityEmi(0, 1);
        await expect(engine.connect(buyer).claimMaturityEmi(0, 2)).to.be.revertedWith('engine: emi early');
    });

    it('11. EMI3 cannot be claimed early', async function () {
        const { buyer, engine, oracle } = await deployFixture();
        await openFixedAndMature(buyer, engine, oracle);
        await time.increase(EMI_INTERVAL);
        await engine.connect(buyer).claimMaturityEmi(0, 1);
        await time.increase(EMI_INTERVAL);
        await engine.connect(buyer).claimMaturityEmi(0, 2);
        await expect(engine.connect(buyer).claimMaturityEmi(0, 3)).to.be.revertedWith('engine: emi early');
    });

    it('12. EMI cannot be claimed twice', async function () {
        const { buyer, engine, oracle } = await deployFixture();
        await openFixedAndMature(buyer, engine, oracle);
        await time.increase(EMI_INTERVAL);
        await engine.connect(buyer).claimMaturityEmi(0, 1);
        await expect(engine.connect(buyer).claimMaturityEmi(0, 1)).to.be.revertedWith('engine: emi claimed');
    });

    it('13. Full 90% cannot be withdrawn in one call', async function () {
        const { buyer, engine, oracle } = await deployFixture();
        await openFixedAndMature(buyer, engine, oracle);
        await expect(engine.connect(buyer).withdrawStake(0)).to.be.revertedWith('engine: matured');
        await time.increase(EMI_INTERVAL * 3);
        // Only one EMI per call
        await engine.connect(buyer).claimMaturityEmi(0, 1);
        const emi = await engine.maturityEmiAt(buyer.address, 0);
        expect(emi.claimed1).to.equal(true);
        expect(emi.claimed2).to.equal(false);
        expect(emi.claimed3).to.equal(false);
    });

    it('14. Compound after maturity reverts', async function () {
        const { buyer, engine, oracle } = await deployFixture();
        await openFixedAndMature(buyer, engine, oracle);
        await time.increase(ONE_DAY);
        await refreshOraclePrice(oracle, ORACLE_PRICE);
        await expect(engine.connect(buyer).compoundReward(0)).to.be.revertedWith('engine: matured');
    });

    it('15. Flexible remains anytime-withdrawal and has no EMI', async function () {
        const { buyer, engine, oracle } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_FLEX);
        await expect(engine.connect(buyer).matureStake(0)).to.be.revertedWith('engine: flexible no emi');
        await refreshOraclePrice(oracle, ORACLE_PRICE);
        await engine.connect(buyer).withdrawStake(0);
        expect((await engine.stakeAt(buyer.address, 0)).withdrawn).to.equal(true);
        expect((await engine.maturityEmiAt(buyer.address, 0)).matured).to.equal(false);
    });

    it('16. Maturity cannot execute twice', async function () {
        const { buyer, engine, oracle } = await deployFixture();
        await openFixedAndMature(buyer, engine, oracle);
        await expect(engine.connect(buyer).matureStake(0)).to.be.revertedWith('engine: already matured');
    });

    it('17. Reward is not counted inside EMI pool', async function () {
        const { buyer, engine, race, oracle } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_180);
        const principal = (await engine.stakeAt(buyer.address, 0)).stakedRace;
        await time.increase(LOCK_180 + BigInt(ONE_DAY * 5));
        await refreshOraclePrice(oracle, ORACLE_PRICE);
        const before = await race.balanceOf(buyer.address);
        await engine.connect(buyer).matureStake(0);
        const rewardPaid = (await race.balanceOf(buyer.address)) - before;
        expect(rewardPaid).to.be.gt(0n);
        const emi = await engine.maturityEmiAt(buyer.address, 0);
        expect(emi.principalRace).to.equal(principal);
        expect(emi.emiPoolRace).to.equal((principal * 9000n) / 10_000n);
        // EMI pool excludes reward (reward went to wallet, not principal)
        expect(emi.emiPoolRace + emi.feeRace).to.equal(principal);
    });

    it('19. Principal cannot be redirected by owner', async function () {
        const { buyer, owner, outsider, engine, oracle, race } = await deployFixture();
        await openFixedAndMature(buyer, engine, oracle);
        const pool = await engine.totalEmiEscrowRace();
        // Owner cannot move escrow; no clawback function — attempt transferFrom fails (no allowance).
        await expect(race.connect(owner).transferFrom(await engine.getAddress(), outsider.address, pool)).to.be
            .reverted;
        await time.increase(EMI_INTERVAL);
        await engine.connect(buyer).claimMaturityEmi(0, 1);
        // Only stake owner claims EMI
        await time.increase(EMI_INTERVAL);
        await expect(engine.connect(outsider).claimMaturityEmi(0, 2)).to.be.reverted;
    });

    it('All three EMIs claim closes stake; treasury fee already paid', async function () {
        const { buyer, engine, race, oracle, treasury } = await deployFixture();
        await engine.connect(buyer).participate(USDT_100, LOCK_180);
        const principal = (await engine.stakeAt(buyer.address, 0)).stakedRace;
        await time.increase(LOCK_180 + 1n);
        await refreshOraclePrice(oracle, ORACLE_PRICE);
        const treasuryBefore = await treasury.balance();
        await engine.connect(buyer).matureStake(0);
        const fee = (principal * 1000n) / 10_000n;
        expect((await treasury.balance()) - treasuryBefore).to.equal(fee);

        const emi = await engine.maturityEmiAt(buyer.address, 0);
        const before = await race.balanceOf(buyer.address);
        await time.increase(EMI_INTERVAL);
        await engine.connect(buyer).claimMaturityEmi(0, 1);
        await time.increase(EMI_INTERVAL);
        await engine.connect(buyer).claimMaturityEmi(0, 2);
        await time.increase(EMI_INTERVAL);
        await expect(engine.connect(buyer).claimMaturityEmi(0, 3))
            .to.emit(engine, 'EmiClaimed')
            .and.to.emit(engine, 'StakeCompleted');
        expect(await race.balanceOf(buyer.address)).to.equal(before + emi.emiPoolRace);
        expect((await engine.maturityEmiAt(buyer.address, 0)).closed).to.equal(true);
        expect((await engine.stakeAt(buyer.address, 0)).withdrawn).to.equal(true);
        expect(await engine.totalEmiEscrowRace()).to.equal(0n);
    });
});
