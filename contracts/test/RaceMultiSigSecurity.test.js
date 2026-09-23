const { expect } = require('chai');
const { ethers } = require('hardhat');

/**
 * RaceMultiSig security suite — fixed 3-of-5 (not Gnosis Safe).
 * Covers threshold, approvals, treasury withdraw, ownership hardening targets.
 */
describe('RaceMultiSig security (3-of-5)', function () {
    async function deployAll() {
        const accounts = await ethers.getSigners();
        const [s0, s1, s2, s3, s4, stranger, recipient] = accounts;
        const signers = [s0, s1, s2, s3, s4];

        const RaceMultiSig = await ethers.getContractFactory('RaceMultiSig');
        const multiSig = await RaceMultiSig.deploy([
            s0.address,
            s1.address,
            s2.address,
            s3.address,
            s4.address,
        ]);

        const RaceCoin = await ethers.getContractFactory('RaceCoin');
        const race = await RaceCoin.deploy(
            s0.address,
            s0.address,
            s0.address,
            s0.address,
            s0.address,
        );

        const RaceTreasury = await ethers.getContractFactory('RaceTreasury');
        const treasury = await RaceTreasury.deploy(
            s0.address,
            await race.getAddress(),
            await multiSig.getAddress(),
        );

        const RaceRewardVault = await ethers.getContractFactory('RaceRewardVault');
        const vault = await RaceRewardVault.deploy(s0.address, await race.getAddress());

        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const usdt = await MockERC20.deploy('USDT', 'USDT', 18);
        const MockPancakeRouter = await ethers.getContractFactory('MockPancakeRouter');
        const router = await MockPancakeRouter.deploy(await usdt.getAddress(), await race.getAddress());

        const RaceCommunityEngine = await ethers.getContractFactory('RaceCommunityEngine');
        const engine = await RaceCommunityEngine.deploy(
            s0.address,
            await usdt.getAddress(),
            await race.getAddress(),
            await router.getAddress(),
            await vault.getAddress(),
        );
        await vault.setEngine(await engine.getAddress());

        const RaceRewardPriceOracle = await ethers.getContractFactory('RaceRewardPriceOracle');
        const oracle = await RaceRewardPriceOracle.deploy(
            s0.address,
            ethers.parseEther('1'),
            24 * 60 * 60,
            ethers.parseEther('0.01'),
            ethers.parseEther('100'),
        );
        await engine.setRewardPriceOracle(await oracle.getAddress());

        const RaceICO = await ethers.getContractFactory('RaceICO');
        const ico = await RaceICO.deploy(s0.address, await race.getAddress(), await usdt.getAddress(), s0.address);

        await race.transfer(await treasury.getAddress(), ethers.parseEther('1000'));
        // Treasury holdings must move without 4% transfer fee (production deploy fee-exempts treasury).
        await race.setFeeExempt(await treasury.getAddress(), true);

        return {
            accounts,
            signers,
            s0,
            s1,
            s2,
            s3,
            s4,
            stranger,
            recipient,
            multiSig,
            race,
            treasury,
            vault,
            engine,
            oracle,
            ico,
        };
    }

    async function submitOnly(multiSig, signer, target, data) {
        const txId = await multiSig.connect(signer).submitTransaction.staticCall(target, 0, data);
        await multiSig.connect(signer).submitTransaction(target, 0, data);
        return txId;
    }

    it('1+2. five signers configured and threshold = 3', async function () {
        const { multiSig, signers } = await deployAll();
        expect(await multiSig.REQUIRED()).to.equal(3n);
        expect(await multiSig.threshold()).to.equal(3n);
        expect(await multiSig.SIGNER_COUNT()).to.equal(5n);
        const onChain = await multiSig.getSigners();
        for (let i = 0; i < 5; i++) {
            expect(onChain[i]).to.equal(signers[i].address);
            expect(await multiSig.isSigner(signers[i].address)).to.equal(true);
        }
        expect(await multiSig.isSigner(ethers.ZeroAddress)).to.equal(false);
    });

    it('constructor rejects zero / duplicate signers', async function () {
        const accounts = await ethers.getSigners();
        const RaceMultiSig = await ethers.getContractFactory('RaceMultiSig');
        await expect(
            RaceMultiSig.deploy([
                accounts[0].address,
                accounts[1].address,
                accounts[2].address,
                accounts[3].address,
                ethers.ZeroAddress,
            ]),
        ).to.be.revertedWith('RaceMultiSig: zero signer');
        await expect(
            RaceMultiSig.deploy([
                accounts[0].address,
                accounts[1].address,
                accounts[2].address,
                accounts[3].address,
                accounts[0].address,
            ]),
        ).to.be.revertedWith('RaceMultiSig: duplicate');
    });

    it('3. one approval cannot execute treasury withdraw', async function () {
        const { multiSig, treasury, s0, recipient } = await deployAll();
        const data = treasury.interface.encodeFunctionData('withdraw', [
            recipient.address,
            ethers.parseEther('1'),
            'one',
        ]);
        const txId = await submitOnly(multiSig, s0, await treasury.getAddress(), data);
        await multiSig.connect(s0).confirmTransaction(txId);
        const txn = await multiSig.getTransaction(txId);
        expect(txn.executed).to.equal(false);
        expect(txn.confirmations).to.equal(1n);
        await expect(multiSig.connect(s0).executeTransaction(txId)).to.be.revertedWith(
            'RaceMultiSig: not confirmed',
        );
    });

    it('4. two approvals cannot execute treasury withdraw', async function () {
        const { multiSig, treasury, s0, s1, recipient } = await deployAll();
        const data = treasury.interface.encodeFunctionData('withdraw', [
            recipient.address,
            ethers.parseEther('1'),
            'two',
        ]);
        const txId = await submitOnly(multiSig, s0, await treasury.getAddress(), data);
        await multiSig.connect(s0).confirmTransaction(txId);
        await multiSig.connect(s1).confirmTransaction(txId);
        const txn = await multiSig.getTransaction(txId);
        expect(txn.executed).to.equal(false);
        expect(txn.confirmations).to.equal(2n);
    });

    it('5+9. three approvals execute treasury withdraw', async function () {
        const { multiSig, treasury, race, s0, s1, s2, recipient } = await deployAll();
        const amount = ethers.parseEther('10');
        const before = await race.balanceOf(recipient.address);
        const data = treasury.interface.encodeFunctionData('withdraw', [
            recipient.address,
            amount,
            'ok',
        ]);
        const txId = await submitOnly(multiSig, s0, await treasury.getAddress(), data);
        await multiSig.connect(s0).confirmTransaction(txId);
        await multiSig.connect(s1).confirmTransaction(txId);
        await multiSig.connect(s2).confirmTransaction(txId);
        const txn = await multiSig.getTransaction(txId);
        expect(txn.executed).to.equal(true);
        expect(txn.confirmations).to.equal(3n);
        expect(await race.balanceOf(recipient.address)).to.equal(before + amount);
    });

    it('6. duplicate approval rejected', async function () {
        const { multiSig, treasury, s0, recipient } = await deployAll();
        const data = treasury.interface.encodeFunctionData('withdraw', [
            recipient.address,
            ethers.parseEther('1'),
            'dup',
        ]);
        const txId = await submitOnly(multiSig, s0, await treasury.getAddress(), data);
        await multiSig.connect(s0).confirmTransaction(txId);
        await expect(multiSig.connect(s0).confirmTransaction(txId)).to.be.revertedWith(
            'RaceMultiSig: confirmed',
        );
    });

    it('7. non-signer rejected for submit and confirm', async function () {
        const { multiSig, treasury, stranger, s0, recipient } = await deployAll();
        const data = treasury.interface.encodeFunctionData('withdraw', [
            recipient.address,
            ethers.parseEther('1'),
            'ns',
        ]);
        await expect(
            multiSig.connect(stranger).submitTransaction(await treasury.getAddress(), 0, data),
        ).to.be.revertedWith('RaceMultiSig: not signer');
        const txId = await submitOnly(multiSig, s0, await treasury.getAddress(), data);
        await expect(multiSig.connect(stranger).confirmTransaction(txId)).to.be.revertedWith(
            'RaceMultiSig: not signer',
        );
    });

    it('8. transaction replay / re-execute rejected', async function () {
        const { multiSig, treasury, s0, s1, s2, recipient } = await deployAll();
        const data = treasury.interface.encodeFunctionData('withdraw', [
            recipient.address,
            ethers.parseEther('1'),
            'replay',
        ]);
        const txId = await submitOnly(multiSig, s0, await treasury.getAddress(), data);
        await multiSig.connect(s0).confirmTransaction(txId);
        await multiSig.connect(s1).confirmTransaction(txId);
        await multiSig.connect(s2).confirmTransaction(txId);
        await expect(multiSig.connect(s0).executeTransaction(txId)).to.be.revertedWith(
            'RaceMultiSig: executed',
        );
        await expect(multiSig.connect(s0).confirmTransaction(txId)).to.be.revertedWith(
            'RaceMultiSig: executed',
        );
    });

    it('8b. invalid tx id rejected', async function () {
        const { multiSig, s0 } = await deployAll();
        await expect(multiSig.connect(s0).confirmTransaction(999)).to.be.revertedWith(
            'RaceMultiSig: bad id',
        );
    });

    it('single EOA cannot withdraw treasury', async function () {
        const { treasury, s0, stranger, recipient } = await deployAll();
        await expect(
            treasury.connect(s0).withdraw(recipient.address, ethers.parseEther('1'), 'eoa'),
        ).to.be.revertedWith('RaceTreasury: not multisig');
        await expect(
            treasury.connect(stranger).withdraw(recipient.address, ethers.parseEther('1'), 'eoa'),
        ).to.be.revertedWith('RaceTreasury: not multisig');
    });

    it('10–13. after ownership transfer, deployer loses Engine/Oracle/Coin/ICO/Vault control; MultiSig works', async function () {
        const { multiSig, engine, oracle, race, ico, vault, treasury, s0, s1, s2, stranger, signers } =
            await deployAll();

        await engine.transferOwnership(await multiSig.getAddress());
        await oracle.transferOwnership(await multiSig.getAddress());
        await race.transferOwnership(await multiSig.getAddress());
        await ico.transferOwnership(await multiSig.getAddress());
        await vault.transferOwnership(await multiSig.getAddress());
        await treasury.transferOwnership(await multiSig.getAddress());

        expect(await engine.owner()).to.equal(await multiSig.getAddress());
        expect(await oracle.owner()).to.equal(await multiSig.getAddress());
        expect(await race.owner()).to.equal(await multiSig.getAddress());
        expect(await ico.owner()).to.equal(await multiSig.getAddress());
        expect(await vault.owner()).to.equal(await multiSig.getAddress());
        expect(await treasury.owner()).to.equal(await multiSig.getAddress());

        await expect(engine.connect(s0).pause()).to.be.revertedWithCustomError(
            engine,
            'OwnableUnauthorizedAccount',
        );
        await expect(engine.connect(s0).setIcoContract(stranger.address)).to.be.revertedWithCustomError(
            engine,
            'OwnableUnauthorizedAccount',
        );
        await expect(
            engine.connect(s0).setRewardPriceOracle(stranger.address),
        ).to.be.revertedWithCustomError(engine, 'OwnableUnauthorizedAccount');
        await expect(engine.connect(s0).transferOwnership(stranger.address)).to.be.revertedWithCustomError(
            engine,
            'OwnableUnauthorizedAccount',
        );
        await expect(race.connect(s0).setMinter(stranger.address, true)).to.be.revertedWithCustomError(
            race,
            'OwnableUnauthorizedAccount',
        );
        await expect(ico.connect(s0).startPhase(1)).to.be.revertedWithCustomError(
            ico,
            'OwnableUnauthorizedAccount',
        );
        await expect(vault.connect(s0).setEngine(stranger.address)).to.be.revertedWithCustomError(
            vault,
            'OwnableUnauthorizedAccount',
        );
        await expect(oracle.connect(s0).setUpdater(stranger.address, true)).to.be.revertedWithCustomError(
            oracle,
            'OwnableUnauthorizedAccount',
        );

        // MultiSig can pause Engine
        const pauseData = engine.interface.encodeFunctionData('pause', []);
        const txId = await submitOnly(multiSig, s0, await engine.getAddress(), pauseData);
        await multiSig.connect(s0).confirmTransaction(txId);
        await multiSig.connect(s1).confirmTransaction(txId);
        await multiSig.connect(s2).confirmTransaction(txId);
        expect(await engine.paused()).to.equal(true);
    });

    it('signer management limitation: no add/remove/replace/threshold change selectors', async function () {
        const RaceMultiSig = await ethers.getContractFactory('RaceMultiSig');
        const fragNames = RaceMultiSig.interface.fragments
            .filter((f) => f.type === 'function')
            .map((f) => f.name);
        for (const banned of ['addSigner', 'removeSigner', 'replaceSigner', 'changeThreshold', 'setThreshold']) {
            expect(fragNames).to.not.include(banned);
        }
    });

    it('oracle updater remains operational after ownership → MultiSig', async function () {
        const { oracle, multiSig, s0, stranger } = await deployAll();
        const ops = stranger;
        await oracle.setUpdater(ops.address, true);
        await oracle.setUpdater(s0.address, false);
        await oracle.transferOwnership(await multiSig.getAddress());

        await expect(oracle.connect(s0).updatePrice(ethers.parseEther('1.01'))).to.be.revertedWithCustomError(
            oracle,
            'OracleNotUpdater',
        );
        await oracle.connect(ops).updatePrice(ethers.parseEther('1.01'));
        expect(await oracle.rawPriceUsdtPerRace()).to.equal(ethers.parseEther('1.01'));
    });
});
