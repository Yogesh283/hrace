const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { deployAndWireRewardOracle, refreshOraclePrice } = require('./helpers/rewardOracle');

describe('Mainnet ownership & treasury hardening', function () {
    const USDT_100 = ethers.parseEther('100');
    const LOCK_180 = BigInt(180 * 24 * 60 * 60);
    const EMI_INTERVAL = 30 * 24 * 60 * 60;
    const ORACLE_PRICE = ethers.parseEther('1');

    async function deployFixture() {
        const signers = await ethers.getSigners();
        const [owner, buyer, stranger, ops] = signers;
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

        await race.mint(await router.getAddress(), ethers.parseEther('10000000'));
        await usdt.mint(buyer.address, ethers.parseEther('100000'));
        await usdt.connect(buyer).approve(await engine.getAddress(), ethers.MaxUint256);

        return { owner, buyer, stranger, ops, usdt, race, engine, oracle, treasury, multiSig, signers };
    }

    async function multisigCall(multiSig, signers, target, data) {
        const txId = await multiSig.connect(signers[0]).submitTransaction.staticCall(target, 0, data);
        await multiSig.connect(signers[0]).submitTransaction(target, 0, data);
        await multiSig.connect(signers[0]).confirmTransaction(txId);
        await multiSig.connect(signers[1]).confirmTransaction(txId);
        // 3rd confirmation auto-executes
        await multiSig.connect(signers[2]).confirmTransaction(txId);
        return txId;
    }

    it('1. Unauthorized EOA cannot change maturity treasury', async function () {
        const { engine, treasury, stranger, owner } = await deployFixture();
        await engine.connect(owner).setMaturityTreasury(await treasury.getAddress());
        await expect(
            engine.connect(stranger).setMaturityTreasury(stranger.address),
        ).to.be.revertedWithCustomError(engine, 'OwnableUnauthorizedAccount');
    });

    it('2+3. After lock, even owner/governance cannot retarget maturity treasury', async function () {
        const { engine, treasury, owner, stranger, multiSig, signers } = await deployFixture();
        await engine.connect(owner).setMaturityTreasury(await treasury.getAddress());
        await engine.connect(owner).lockMaturityTreasury();
        expect(await engine.maturityTreasuryLocked()).to.equal(true);

        await expect(engine.connect(owner).setMaturityTreasury(stranger.address)).to.be.revertedWith(
            'engine: treasury locked',
        );

        await engine.connect(owner).transferOwnership(await multiSig.getAddress());
        const data = engine.interface.encodeFunctionData('setMaturityTreasury', [stranger.address]);
        await expect(multisigCall(multiSig, signers, await engine.getAddress(), data)).to.be.reverted;
        expect(await engine.maturityTreasury()).to.equal(await treasury.getAddress());
    });

    it('4+5. Engine ownership transfer to MultiSig; deployer loses privileged control', async function () {
        const { engine, treasury, owner, stranger, multiSig } = await deployFixture();
        await engine.connect(owner).setMaturityTreasury(await treasury.getAddress());
        await engine.connect(owner).lockMaturityTreasury();
        await engine.connect(owner).transferOwnership(await multiSig.getAddress());

        expect(await engine.owner()).to.equal(await multiSig.getAddress());
        await expect(engine.connect(owner).pause()).to.be.revertedWithCustomError(
            engine,
            'OwnableUnauthorizedAccount',
        );
        await expect(engine.connect(owner).setIcoContract(stranger.address)).to.be.revertedWithCustomError(
            engine,
            'OwnableUnauthorizedAccount',
        );
        await expect(
            engine.connect(owner).setRewardPriceOracle(stranger.address),
        ).to.be.revertedWithCustomError(engine, 'OwnableUnauthorizedAccount');
        await expect(engine.connect(owner).transferOwnership(stranger.address)).to.be.revertedWithCustomError(
            engine,
            'OwnableUnauthorizedAccount',
        );
    });

    it('6. RaceTreasury withdraw remains under 3-of-5 MultiSig', async function () {
        const { treasury, owner, stranger, race } = await deployFixture();
        await race.mint(await treasury.getAddress(), ethers.parseEther('100'));
        await expect(
            treasury.connect(owner).withdraw(stranger.address, ethers.parseEther('1'), 'test'),
        ).to.be.revertedWith('RaceTreasury: not multisig');
        await expect(
            treasury.connect(stranger).withdraw(stranger.address, ethers.parseEther('1'), 'test'),
        ).to.be.revertedWith('RaceTreasury: not multisig');
    });

    it('7+8. Locked treasury still receives 10% fee; EMI unchanged', async function () {
        const { engine, treasury, owner, buyer, race, oracle } = await deployFixture();
        await engine.connect(owner).setMaturityTreasury(await treasury.getAddress());
        await engine.connect(owner).lockMaturityTreasury();

        await engine.connect(buyer).participate(USDT_100, LOCK_180);
        const principal = (await engine.stakeAt(buyer.address, 0)).stakedRace;
        await time.increase(LOCK_180 + 1n);
        await refreshOraclePrice(oracle, ORACLE_PRICE);

        const before = await treasury.balance();
        await engine.connect(buyer).matureStake(0);
        const fee = (principal * 1000n) / 10_000n;
        expect((await treasury.balance()) - before).to.equal(fee);

        const emi = await engine.maturityEmiAt(buyer.address, 0);
        expect(emi.emi1Race + emi.emi2Race + emi.emi3Race).to.equal(emi.emiPoolRace);
        expect(emi.emiPoolRace).to.equal(principal - fee);

        await time.increase(EMI_INTERVAL);
        const userBefore = await race.balanceOf(buyer.address);
        await engine.connect(buyer).claimMaturityEmi(0, 1);
        expect(await race.balanceOf(buyer.address)).to.equal(userBefore + emi.emi1Race);
    });

    it('Oracle ownership transfer + deployer loses updater when revoked', async function () {
        const { oracle, owner, ops, multiSig, stranger } = await deployFixture();
        await oracle.connect(owner).setUpdater(ops.address, true);
        await oracle.connect(owner).setUpdater(owner.address, false);
        await oracle.connect(owner).transferOwnership(await multiSig.getAddress());

        expect(await oracle.owner()).to.equal(await multiSig.getAddress());
        expect(await oracle.isUpdater(ops.address)).to.equal(true);
        expect(await oracle.isUpdater(owner.address)).to.equal(false);

        await expect(oracle.connect(owner).setUpdater(stranger.address, true)).to.be.revertedWithCustomError(
            oracle,
            'OwnableUnauthorizedAccount',
        );
        await expect(oracle.connect(stranger).updatePrice(ORACLE_PRICE)).to.be.revertedWithCustomError(
            oracle,
            'OracleNotUpdater',
        );
        await oracle.connect(ops).updatePrice(ethers.parseEther('1.01'));
    });

    it('lockMaturityTreasury requires treasury set; double lock reverts', async function () {
        const { engine, treasury, owner } = await deployFixture();
        await expect(engine.connect(owner).lockMaturityTreasury()).to.be.revertedWith('engine: no treasury');
        await engine.connect(owner).setMaturityTreasury(await treasury.getAddress());
        await engine.connect(owner).lockMaturityTreasury();
        await expect(engine.connect(owner).lockMaturityTreasury()).to.be.revertedWith('engine: already locked');
    });
});
