const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Multisig fund separation (Company + Dev + Marketing + Ops)', function () {
    async function deployFixture() {
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
        const race = await RaceCoin.deploy(s0.address, s0.address, s0.address, s0.address, s0.address);

        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const usdt = await MockERC20.deploy('USDT', 'USDT', 18);

        const RaceTreasury = await ethers.getContractFactory('RaceTreasury');
        const company = await RaceTreasury.deploy(
            s0.address,
            await race.getAddress(),
            await multiSig.getAddress(),
        );

        const RaceDevelopmentTreasury = await ethers.getContractFactory('RaceDevelopmentTreasury');
        const development = await RaceDevelopmentTreasury.deploy(
            await multiSig.getAddress(),
            await race.getAddress(),
            await usdt.getAddress(),
        );

        const RaceMarketingTreasury = await ethers.getContractFactory('RaceMarketingTreasury');
        const marketing = await RaceMarketingTreasury.deploy(
            await multiSig.getAddress(),
            await race.getAddress(),
            await usdt.getAddress(),
        );

        const RaceOperationsTreasury = await ethers.getContractFactory('RaceOperationsTreasury');
        const operations = await RaceOperationsTreasury.deploy(
            await multiSig.getAddress(),
            await race.getAddress(),
            await usdt.getAddress(),
        );

        await race.setFeeExempt(await company.getAddress(), true);
        await race.setFeeExempt(await development.getAddress(), true);
        await race.setFeeExempt(await marketing.getAddress(), true);
        await race.setFeeExempt(await operations.getAddress(), true);

        await race.transfer(await company.getAddress(), ethers.parseEther('1000'));
        await race.transfer(await development.getAddress(), ethers.parseEther('500'));
        await race.transfer(await marketing.getAddress(), ethers.parseEther('500'));
        await race.transfer(await operations.getAddress(), ethers.parseEther('500'));

        await usdt.mint(s0.address, ethers.parseEther('10000'));
        await usdt.approve(await development.getAddress(), ethers.MaxUint256);
        await development.deposit(await usdt.getAddress(), ethers.parseEther('200'));

        return {
            signers,
            s0,
            s1,
            s2,
            s3,
            stranger,
            recipient,
            multiSig,
            race,
            usdt,
            company,
            development,
            marketing,
            operations,
        };
    }

    async function submitOnly(multiSig, signer, target, data) {
        const txId = await multiSig.connect(signer).submitTransaction.staticCall(target, 0, data);
        await multiSig.connect(signer).submitTransaction(target, 0, data);
        return txId;
    }

    async function confirmN(multiSig, signers, txId, n) {
        for (let i = 0; i < n; i++) {
            await multiSig.connect(signers[i]).confirmTransaction(txId);
        }
    }

    function withdrawData(fund, token, to, amount, purpose) {
        return fund.interface.encodeFunctionData('withdraw', [token, to, amount, purpose]);
    }

    it('controllers are Multisig; funds are separated by address and name', async function () {
        const { multiSig, company, development, marketing, operations } = await deployFixture();
        const ms = await multiSig.getAddress();
        expect(await company.multisig()).to.equal(ms);
        expect(await development.multisig()).to.equal(ms);
        expect(await marketing.multisig()).to.equal(ms);
        expect(await operations.multisig()).to.equal(ms);
        expect(await development.fundName()).to.equal('DEVELOPMENT');
        expect(await marketing.fundName()).to.equal('MARKETING');
        expect(await operations.fundName()).to.equal('OPERATIONS');
        expect(await development.getAddress()).to.not.equal(await marketing.getAddress());
        expect(await marketing.getAddress()).to.not.equal(await operations.getAddress());
        expect(await company.getAddress()).to.not.equal(await development.getAddress());
    });

    it('Company: 1 and 2 approvals fail; 3 succeed', async function () {
        const { multiSig, company, race, signers, s0, recipient } = await deployFixture();
        const amount = ethers.parseEther('10');
        const data = company.interface.encodeFunctionData('withdraw', [
            recipient.address,
            amount,
            'Company reserve expense',
        ]);

        const tx1 = await submitOnly(multiSig, s0, await company.getAddress(), data);
        await confirmN(multiSig, signers, tx1, 1);
        expect((await multiSig.getTransaction(tx1)).executed).to.equal(false);

        const tx2 = await submitOnly(multiSig, s0, await company.getAddress(), data);
        await confirmN(multiSig, signers, tx2, 2);
        expect((await multiSig.getTransaction(tx2)).executed).to.equal(false);

        const before = await race.balanceOf(recipient.address);
        const tx3 = await submitOnly(multiSig, s0, await company.getAddress(), data);
        await confirmN(multiSig, signers, tx3, 3);
        expect((await multiSig.getTransaction(tx3)).executed).to.equal(true);
        expect(await race.balanceOf(recipient.address)).to.equal(before + amount);
    });

    for (const key of ['development', 'marketing', 'operations']) {
        it(`${key}: 1/2 fail, 3 succeed with purpose event`, async function () {
            const ctx = await deployFixture();
            const fund = ctx[key];
            const { multiSig, race, signers, s0, recipient } = ctx;
            const amount = ethers.parseEther('5');
            const purpose = `${key} approved expense`;
            const data = withdrawData(fund, await race.getAddress(), recipient.address, amount, purpose);

            const tx1 = await submitOnly(multiSig, s0, await fund.getAddress(), data);
            await confirmN(multiSig, signers, tx1, 1);
            expect((await multiSig.getTransaction(tx1)).executed).to.equal(false);

            const tx2 = await submitOnly(multiSig, s0, await fund.getAddress(), data);
            await confirmN(multiSig, signers, tx2, 2);
            expect((await multiSig.getTransaction(tx2)).executed).to.equal(false);

            const before = await race.balanceOf(recipient.address);
            const tx3 = await submitOnly(multiSig, s0, await fund.getAddress(), data);
            await multiSig.connect(signers[0]).confirmTransaction(tx3);
            await multiSig.connect(signers[1]).confirmTransaction(tx3);
            await expect(multiSig.connect(signers[2]).confirmTransaction(tx3))
                .to.emit(fund, 'Withdrawn')
                .withArgs(await fund.fundName(), await race.getAddress(), recipient.address, amount, purpose);
            expect(await race.balanceOf(recipient.address)).to.equal(before + amount);
        });
    }

    it('unauthorized EOA cannot withdraw any expense fund', async function () {
        const { development, marketing, operations, race, s0, stranger, recipient } = await deployFixture();
        const amount = ethers.parseEther('1');
        for (const fund of [development, marketing, operations]) {
            await expect(
                fund.connect(s0).withdraw(await race.getAddress(), recipient.address, amount, 'hack'),
            ).to.be.revertedWith('RaceMultisigFund: not multisig');
            await expect(
                fund.connect(stranger).withdraw(await race.getAddress(), recipient.address, amount, 'hack'),
            ).to.be.revertedWith('RaceMultisigFund: not multisig');
        }
    });

    it('rejects zero recipient, zero amount, empty purpose, unknown token', async function () {
        const { multiSig, development, race, usdt, signers, s0, recipient } = await deployFixture();
        const raceAddr = await race.getAddress();

        const badTo = withdrawData(development, raceAddr, ethers.ZeroAddress, 1n, 'x');
        const txA = await submitOnly(multiSig, s0, await development.getAddress(), badTo);
        await expect(confirmN(multiSig, signers, txA, 3)).to.be.reverted;

        const badAmt = withdrawData(development, raceAddr, recipient.address, 0n, 'x');
        const txB = await submitOnly(multiSig, s0, await development.getAddress(), badAmt);
        await expect(confirmN(multiSig, signers, txB, 3)).to.be.reverted;

        const badPurpose = withdrawData(development, raceAddr, recipient.address, 1n, '');
        const txC = await submitOnly(multiSig, s0, await development.getAddress(), badPurpose);
        await expect(confirmN(multiSig, signers, txC, 3)).to.be.reverted;

        const other = await (await ethers.getContractFactory('MockERC20')).deploy('X', 'X', 18);
        const badToken = withdrawData(development, await other.getAddress(), recipient.address, 1n, 'x');
        const txD = await submitOnly(multiSig, s0, await development.getAddress(), badToken);
        await expect(confirmN(multiSig, signers, txD, 3)).to.be.reverted;

        // USDT path works for expense funds
        const usdtAmt = ethers.parseEther('10');
        const usdtData = withdrawData(
            development,
            await usdt.getAddress(),
            recipient.address,
            usdtAmt,
            'Development server expense',
        );
        const txU = await submitOnly(multiSig, s0, await development.getAddress(), usdtData);
        await confirmN(multiSig, signers, txU, 3);
        expect(await usdt.balanceOf(recipient.address)).to.equal(usdtAmt);
    });

    it('duplicate approval and replay rejected; company EOA withdraw blocked', async function () {
        const { multiSig, company, race, s0, s1, recipient } = await deployFixture();
        const data = company.interface.encodeFunctionData('withdraw', [
            recipient.address,
            ethers.parseEther('1'),
            'replay',
        ]);
        const txId = await submitOnly(multiSig, s0, await company.getAddress(), data);
        await multiSig.connect(s0).confirmTransaction(txId);
        await expect(multiSig.connect(s0).confirmTransaction(txId)).to.be.revertedWith(
            'RaceMultiSig: confirmed',
        );
        await multiSig.connect(s1).confirmTransaction(txId);
        await multiSig.connect((await ethers.getSigners())[2]).confirmTransaction(txId);
        await expect(multiSig.connect(s0).executeTransaction(txId)).to.be.revertedWith(
            'RaceMultiSig: executed',
        );

        await expect(
            company.connect(s0).withdraw(recipient.address, ethers.parseEther('1'), 'eoa'),
        ).to.be.revertedWith('RaceTreasury: not multisig');
    });

    it('expense funds have no Ownable / no EOA setMultisig', async function () {
        const { development } = await deployFixture();
        const names = development.interface.fragments
            .filter((f) => f.type === 'function')
            .map((f) => f.name);
        expect(names).to.not.include('owner');
        expect(names).to.not.include('transferOwnership');
        expect(names).to.not.include('setMultisig');
    });

    it('deposit emits Funded; balances readable', async function () {
        const { development, race, s0 } = await deployFixture();
        const amt = ethers.parseEther('3');
        await race.approve(await development.getAddress(), amt);
        await expect(development.deposit(await race.getAddress(), amt))
            .to.emit(development, 'Funded')
            .withArgs('DEVELOPMENT', await race.getAddress(), s0.address, amt);
        expect(await development.raceBalance()).to.be.gte(ethers.parseEther('503'));
    });
});
