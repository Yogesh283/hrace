const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('RaceLendingBorrowing', function () {
    const ONE = ethers.parseEther('1');
    const REF = ethers.id('repay-ref-1');
    const CHARGE_REF = ethers.id('charge-ref-1');

    async function deployCore(icoCompleted) {
        const [owner, user, user2, multisig] = await ethers.getSigners();
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const usdt = await MockERC20.deploy('USDT', 'USDT', 18);
        const race = await MockERC20.deploy('RACE', 'RACE', 18);
        const MockIco = await ethers.getContractFactory('MockIcoCompletion');
        const ico = await MockIco.deploy();
        if (icoCompleted) {
            await ico.setIcoCompleted(true);
        }

        const OpsTreasury = await ethers.getContractFactory('RaceOperationsTreasury');
        const treasury = await OpsTreasury.deploy(
            multisig.address,
            await race.getAddress(),
            await usdt.getAddress(),
        );

        const Lending = await ethers.getContractFactory('RaceLendingBorrowing');
        const lending = await Lending.deploy(
            owner.address,
            await usdt.getAddress(),
            await race.getAddress(),
            await ico.getAddress(),
            await treasury.getAddress(),
        );

        const pool = ethers.parseEther('1000000');
        await usdt.mint(owner.address, pool);
        await usdt.connect(owner).approve(await lending.getAddress(), pool);
        await lending.connect(owner).fundLiquidity(pool);

        return { lending, usdt, race, ico, treasury, owner, user, user2, multisig };
    }

    async function fundUser(usdt, lending, user, amount) {
        await usdt.mint(user.address, amount);
        await usdt.connect(user).approve(await lending.getAddress(), amount);
    }

    it('1 ICO incomplete → lending rejected', async function () {
        const { lending, usdt, user } = await deployCore(false);
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await expect(lending.connect(user).openSmartLending(ethers.parseEther('100'))).to.be.revertedWithCustomError(
            lending,
            'Lending__IcoNotComplete',
        );
    });

    it('2 ICO complete → lending allowed', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await expect(lending.connect(user).openSmartLending(ethers.parseEther('100'))).to.emit(
            lending,
            'LendingCreated',
        );
    });

    it('3 Smart Lending 100 accepted', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await lending.connect(user).openSmartLending(ethers.parseEther('100'));
        const pos = await lending.getPosition(1);
        expect(pos.selectedAmount).to.equal(ethers.parseEther('100'));
    });

    it('4 Smart Lending 499 accepted', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await lending.connect(user).openSmartLending(ethers.parseEther('499'));
        const pos = await lending.getPosition(1);
        expect(pos.selectedAmount).to.equal(ethers.parseEther('499'));
    });

    it('5 Smart Lending below 100 rejected', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await expect(lending.connect(user).openSmartLending(ethers.parseEther('99'))).to.be.revertedWithCustomError(
            lending,
            'Lending__InvalidAmount',
        );
    });

    it('6 Smart Lending above 499 rejected', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('600'));
        await expect(lending.connect(user).openSmartLending(ethers.parseEther('500'))).to.be.revertedWithCustomError(
            lending,
            'Lending__InvalidAmount',
        );
    });

    it('7 20% security calculated correctly', async function () {
        const { lending, usdt, user, treasury } = await deployCore(true);
        const selected = ethers.parseEther('200');
        await fundUser(usdt, lending, user, selected);
        await lending.connect(user).openSmartLending(selected);
        const pos = await lending.getPosition(1);
        expect(pos.securityAmount).to.equal(ethers.parseEther('40'));
        expect(await usdt.balanceOf(await treasury.getAddress())).to.equal(ethers.parseEther('40'));
    });

    it('8 80% repayment calculated correctly', async function () {
        const { lending, usdt, user } = await deployCore(true);
        const selected = ethers.parseEther('250');
        await fundUser(usdt, lending, user, selected);
        await lending.connect(user).openSmartLending(selected);
        const pos = await lending.getPosition(1);
        expect(pos.repaymentAmount).to.equal(ethers.parseEther('200'));
        expect(pos.disbursementAmount).to.equal(ethers.parseEther('200'));
    });

    it('9 7-day deadline', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await lending.connect(user).openSmartLending(ethers.parseEther('100'));
        const remaining = await lending.getRemainingTime(1);
        expect(remaining).to.be.closeTo(7n * 24n * 60n * 60n, 5n);
        const pos = await lending.getPosition(1);
        expect(pos.dueTime - pos.startTime).to.equal(7n * 24n * 60n * 60n);
    });

    it('10 Smart Pro 500 accepted', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('1000'));
        await lending.connect(user).openSmartPro(ethers.parseEther('500'), 1);
        const pos = await lending.getPosition(1);
        expect(pos.selectedAmount).to.equal(ethers.parseEther('500'));
    });

    it('11 Smart Pro 1000 accepted', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('2000'));
        await lending.connect(user).openSmartPro(ethers.parseEther('1000'), 1);
        expect((await lending.getPosition(1)).selectedAmount).to.equal(ethers.parseEther('1000'));
    });

    it('12 Smart Pro invalid amount rejected', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('1000'));
        await expect(lending.connect(user).openSmartPro(ethers.parseEther('600'), 1)).to.be.revertedWithCustomError(
            lending,
            'Lending__InvalidAmount',
        );
    });

    it('13 30% security', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('1000'));
        await lending.connect(user).openSmartPro(ethers.parseEther('500'), 1);
        expect((await lending.getPosition(1)).securityAmount).to.equal(ethers.parseEther('150'));
    });

    it('14 70% disbursement', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('1000'));
        await lending.connect(user).openSmartPro(ethers.parseEther('500'), 1);
        const pos = await lending.getPosition(1);
        expect(pos.disbursementAmount).to.equal(ethers.parseEther('350'));
        expect(pos.repaymentAmount).to.equal(ethers.parseEther('350'));
    });

    it('15 30-day repayment path + 16 50 USDT charge', async function () {
        const { lending, usdt, user, treasury } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('1000'));
        await lending.connect(user).openSmartPro(ethers.parseEther('500'), 1);
        await time.increase(30 * 24 * 60 * 60);
        const balBefore = await usdt.balanceOf(await treasury.getAddress());
        await lending.connect(user).payProScheduleCharge(1, 0, CHARGE_REF);
        expect(await usdt.balanceOf(await treasury.getAddress()) - balBefore).to.equal(ethers.parseEther('50'));
    });

    it('17 90-day repayment + 18 50+50+50 charges', async function () {
        const { lending, usdt, user, treasury } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('2000'));
        await lending.connect(user).openSmartPro(ethers.parseEther('500'), 2);
        await time.increase(30 * 24 * 60 * 60);
        await lending.connect(user).payProScheduleCharge(1, 0, ethers.id('c0'));
        await time.increase(30 * 24 * 60 * 60);
        await lending.connect(user).payProScheduleCharge(1, 1, ethers.id('c1'));
        await time.increase(30 * 24 * 60 * 60);
        const before = await usdt.balanceOf(await treasury.getAddress());
        await lending.connect(user).payProScheduleCharge(1, 2, ethers.id('c2'));
        expect(await usdt.balanceOf(await treasury.getAddress()) - before).to.equal(ethers.parseEther('50'));
        expect(await lending.chargePaid(1, 0)).to.equal(true);
        expect(await lending.chargePaid(1, 2)).to.equal(true);
    });

    it('19 180-day repayment at maturity', async function () {
        const { lending, usdt, user } = await deployCore(true);
        const security = ethers.parseEther('150');
        const principal = ethers.parseEther('350');
        await fundUser(usdt, lending, user, security);
        await lending.connect(user).openSmartPro(ethers.parseEther('500'), 3);
        await fundUser(usdt, lending, user, principal);
        await time.increase(180 * 24 * 60 * 60);
        await lending.connect(user).repaySmartProPrincipal(1, REF);
        expect((await lending.getPosition(1)).status).to.equal(5); // Closed
    });

    it('20 early repayment restrictions on 180-day', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('1000'));
        await lending.connect(user).openSmartPro(ethers.parseEther('500'), 3);
        await fundUser(usdt, lending, user, ethers.parseEther('350'));
        await expect(lending.connect(user).repaySmartProPrincipal(1, REF)).to.be.revertedWithCustomError(
            lending,
            'Lending__RepaymentTooEarly',
        );
    });

    it('21 duplicate repayment', async function () {
        const { lending, usdt, user } = await deployCore(true);
        const selected = ethers.parseEther('100');
        await fundUser(usdt, lending, user, selected);
        await lending.connect(user).openSmartLending(selected);
        const repay = ethers.parseEther('80');
        await fundUser(usdt, lending, user, repay);
        await lending.connect(user).repaySmartLending(1, REF);
        await expect(lending.connect(user).repaySmartLending(1, REF)).to.be.revertedWithCustomError(
            lending,
            'Lending__InvalidPositionState',
        );
    });

    it('22 overpayment prevented (exact pull only)', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await lending.connect(user).openSmartLending(ethers.parseEther('100'));
        await fundUser(usdt, lending, user, ethers.parseEther('200'));
        const balBefore = await usdt.balanceOf(user.address);
        await lending.connect(user).repaySmartLending(1, ethers.id('r2'));
        const balAfter = await usdt.balanceOf(user.address);
        expect(balBefore - balAfter).to.equal(ethers.parseEther('80'));
    });

    it('23 unauthorized repayment by non-owner rejected', async function () {
        const { lending, usdt, owner, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await lending.connect(user).openSmartLending(ethers.parseEther('100'));
        await fundUser(usdt, lending, user, ethers.parseEther('80'));
        await expect(lending.connect(owner).repaySmartLending(1, REF)).to.be.revertedWithCustomError(
            lending,
            'Lending__NotPositionOwner',
        );
    });

    it('24 pause blocks new lending', async function () {
        const { lending, usdt, user, owner } = await deployCore(true);
        await lending.connect(owner).pause();
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await expect(lending.connect(user).openSmartLending(ethers.parseEther('100'))).to.be.revertedWithCustomError(
            lending,
            'EnforcedPause',
        );
    });

    it('25 reentrancy guard on repay (second call reverts)', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await lending.connect(user).openSmartLending(ethers.parseEther('100'));
        await fundUser(usdt, lending, user, ethers.parseEther('160'));
        await lending.connect(user).repaySmartLending(1, REF);
        await expect(lending.connect(user).repaySmartLending(1, ethers.id('ref-2'))).to.be.revertedWithCustomError(
            lending,
            'Lending__InvalidPositionState',
        );
    });

    it('26 invalid treasury rejected at deploy', async function () {
        const [owner, multisig] = await ethers.getSigners();
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const usdt = await MockERC20.deploy('USDT', 'USDT', 18);
        const race = await MockERC20.deploy('RACE', 'RACE', 18);
        const ico = await (await ethers.getContractFactory('MockIcoCompletion')).deploy();
        const OpsTreasury = await ethers.getContractFactory('RaceOperationsTreasury');
        const treasury = await OpsTreasury.deploy(multisig.address, await race.getAddress(), await usdt.getAddress());
        const Lending = await ethers.getContractFactory('RaceLendingBorrowing');
        await expect(
            Lending.deploy(
                owner.address,
                await usdt.getAddress(),
                await race.getAddress(),
                await ico.getAddress(),
                owner.address,
            ),
        ).to.be.revertedWithCustomError(Lending, 'Lending__InvalidTreasury');
        await expect(
            Lending.deploy(
                owner.address,
                await usdt.getAddress(),
                await race.getAddress(),
                await ico.getAddress(),
                await treasury.getAddress(),
            ),
        ).to.not.be.reverted;
    });

    it('27 event correctness on create', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await expect(lending.connect(user).openSmartLending(ethers.parseEther('100')))
            .to.emit(lending, 'SecurityDeposited')
            .and.to.emit(lending, 'LoanDisbursed')
            .and.to.emit(lending, 'TreasuryPayment');
    });

    it('28 position state transitions', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await lending.connect(user).openSmartLending(ethers.parseEther('100'));
        expect((await lending.getPosition(1)).status).to.equal(1); // Active
        await fundUser(usdt, lending, user, ethers.parseEther('80'));
        await lending.connect(user).repaySmartLending(1, ethers.id('st'));
        expect((await lending.getPosition(1)).status).to.equal(5); // Closed
    });

    it('29 multiple users', async function () {
        const { lending, usdt, user, user2 } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await fundUser(usdt, lending, user2, ethers.parseEther('500'));
        await lending.connect(user).openSmartLending(ethers.parseEther('100'));
        await lending.connect(user2).openSmartLending(ethers.parseEther('200'));
        expect((await lending.getUserPositions(user.address)).length).to.equal(1);
        expect((await lending.getUserPositions(user2.address)).length).to.equal(1);
    });

    it('30 multiple positions per user', async function () {
        const { lending, usdt, user } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('2000'));
        await lending.connect(user).openSmartLending(ethers.parseEther('100'));
        await lending.connect(user).openSmartLending(ethers.parseEther('150'));
        const ids = await lending.getUserPositions(user.address);
        expect(ids.length).to.equal(2);
    });

    it('31 treasury accounting increases on security + repayment', async function () {
        const { lending, usdt, user, treasury } = await deployCore(true);
        await fundUser(usdt, lending, user, ethers.parseEther('500'));
        await lending.connect(user).openSmartLending(ethers.parseEther('100'));
        const mid = await usdt.balanceOf(await treasury.getAddress());
        expect(mid).to.equal(ethers.parseEther('20'));
        await fundUser(usdt, lending, user, ethers.parseEther('80'));
        await lending.connect(user).repaySmartLending(1, ethers.id('treasury-repay'));
        expect(await usdt.balanceOf(await treasury.getAddress())).to.equal(ethers.parseEther('100'));
    });

    it('32 isLendingEnabled and product terms views', async function () {
        const { lending } = await deployCore(true);
        expect(await lending.isLendingEnabled()).to.equal(true);
        const terms = await lending.getProductTerms(1);
        expect(terms.minAmount).to.equal(ethers.parseEther('100'));
        const pro = await lending.getProductTerms(2);
        expect(pro.allowedAmountA).to.equal(ethers.parseEther('500'));
    });

    it('91-180 income accrual blocked', async function () {
        const { lending } = await deployCore(true);
        await expect(lending.accrueProIncomeDays91To180(1)).to.be.revertedWithCustomError(
            lending,
            'Lending__BusinessRuleBlocked91To180',
        );
    });
});
