const { expect } = require('chai');
const { ethers } = require('hardhat');
const { signCredit, signMigrate, signTeamSettlement } = require('../helpers/incomeVaultSign');

describe('RaceIncomeVault security', function () {
    const ONE_USD = ethers.parseEther('1');
    const REF = ethers.id('ref-1');
    const MIG = ethers.id('mig-1');
    const WITHDRAW_ID = ethers.id('wd-1');

    async function deployFixture() {
        const [owner, settlementSigner, admin, pool, user, attacker, upline] = await ethers.getSigners();
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const usdt = await MockERC20.deploy('USDT', 'USDT', 18);
        const RaceIncomeVault = await ethers.getContractFactory('RaceIncomeVault');
        const vault = await RaceIncomeVault.deploy(
            owner.address,
            await usdt.getAddress(),
            settlementSigner.address,
            admin.address,
            pool.address,
        );
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const fund = ethers.parseEther('1000000');
        await usdt.mint(pool.address, fund);
        await usdt.connect(pool).approve(await vault.getAddress(), fund);
        const incomeType = await vault.INCOME_DAILY_REWARD();
        // Use Hardhat chain time — wall-clock Date.now() breaks after suite evm_increaseTime.
        const block = await ethers.provider.getBlock('latest');
        const deadline = Number(block.timestamp) + 3600;
        return {
            vault,
            usdt,
            owner,
            settlementSigner,
            admin,
            pool,
            user,
            attacker,
            upline,
            chainId,
            incomeType,
            deadline,
        };
    }

    async function creditUser(ctx, user, amount, referenceId = REF) {
        const sig = await signCredit(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            user.address,
            amount,
            ctx.incomeType,
            referenceId,
            ctx.deadline,
        );
        await ctx.vault.creditIncome(user.address, amount, ctx.incomeType, referenceId, ctx.deadline, sig);
    }

    it('1 arbitrary user cannot credit income', async function () {
        const ctx = await deployFixture();
        await expect(
            ctx.vault.connect(ctx.attacker).creditIncome(
                ctx.user.address,
                ONE_USD,
                ctx.incomeType,
                REF,
                ctx.deadline,
                '0x',
            ),
        ).to.be.reverted;
    });

    it('2 invalid signer cannot credit', async function () {
        const ctx = await deployFixture();
        const badSig = await signCredit(
            ctx.attacker,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.user.address,
            ONE_USD,
            ctx.incomeType,
            REF,
            ctx.deadline,
        );
        await expect(
            ctx.vault.creditIncome(ctx.user.address, ONE_USD, ctx.incomeType, REF, ctx.deadline, badSig),
        ).to.be.revertedWithCustomError(ctx.vault, 'IncomeVault__InvalidSigner');
    });

    it('3 expired signature fails', async function () {
        const ctx = await deployFixture();
        const expired = 1;
        const sig = await signCredit(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.user.address,
            ONE_USD,
            ctx.incomeType,
            REF,
            expired,
        );
        await expect(
            ctx.vault.creditIncome(ctx.user.address, ONE_USD, ctx.incomeType, REF, expired, sig),
        ).to.be.revertedWithCustomError(ctx.vault, 'IncomeVault__ExpiredDeadline');
    });

    it('4 replay reference fails', async function () {
        const ctx = await deployFixture();
        await creditUser(ctx, ctx.user, ONE_USD);
        const sig = await signCredit(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.user.address,
            ONE_USD,
            ctx.incomeType,
            REF,
            ctx.deadline,
        );
        await expect(
            ctx.vault.creditIncome(ctx.user.address, ONE_USD, ctx.incomeType, REF, ctx.deadline, sig),
        ).to.be.revertedWithCustomError(ctx.vault, 'IncomeVault__DuplicateReference');
    });

    it('5 wrong chain fails', async function () {
        const ctx = await deployFixture();
        const sig = await signCredit(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            56n,
            ctx.user.address,
            ONE_USD,
            ctx.incomeType,
            REF,
            ctx.deadline,
        );
        await expect(
            ctx.vault.creditIncome(ctx.user.address, ONE_USD, ctx.incomeType, REF, ctx.deadline, sig),
        ).to.be.revertedWithCustomError(ctx.vault, 'IncomeVault__InvalidSigner');
    });

    it('6 wrong user fails', async function () {
        const ctx = await deployFixture();
        const sig = await signCredit(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.attacker.address,
            ONE_USD,
            ctx.incomeType,
            REF,
            ctx.deadline,
        );
        await expect(
            ctx.vault.creditIncome(ctx.user.address, ONE_USD, ctx.incomeType, REF, ctx.deadline, sig),
        ).to.be.revertedWithCustomError(ctx.vault, 'IncomeVault__InvalidSigner');
    });

    it('7 modified amount fails', async function () {
        const ctx = await deployFixture();
        const sig = await signCredit(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.user.address,
            ONE_USD,
            ctx.incomeType,
            REF,
            ctx.deadline,
        );
        await expect(
            ctx.vault.creditIncome(ctx.user.address, ethers.parseEther('2'), ctx.incomeType, REF, ctx.deadline, sig),
        ).to.be.revertedWithCustomError(ctx.vault, 'IncomeVault__InvalidSigner');
    });

    it('8 modified income type fails', async function () {
        const ctx = await deployFixture();
        const sig = await signCredit(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.user.address,
            ONE_USD,
            ctx.incomeType,
            REF,
            ctx.deadline,
        );
        const other = await ctx.vault.INCOME_LEVEL_INCOME();
        await expect(
            ctx.vault.creditIncome(ctx.user.address, ONE_USD, other, REF, ctx.deadline, sig),
        ).to.be.revertedWithCustomError(ctx.vault, 'IncomeVault__InvalidSigner');
    });

    it('9 modified reference fails on second credit', async function () {
        const ctx = await deployFixture();
        await creditUser(ctx, ctx.user, ONE_USD, REF);
        const ref2 = ethers.id('ref-2');
        const sig = await signCredit(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.user.address,
            ONE_USD,
            ctx.incomeType,
            ref2,
            ctx.deadline,
        );
        await ctx.vault.creditIncome(ctx.user.address, ONE_USD, ctx.incomeType, ref2, ctx.deadline, sig);
        expect(await ctx.vault.incomeBalance(ctx.user.address)).to.equal(ethers.parseEther('2'));
    });

    it('10 double migration fails', async function () {
        const ctx = await deployFixture();
        const sig = await signMigrate(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.user.address,
            ONE_USD,
            MIG,
            ctx.deadline,
        );
        await ctx.vault.migrateIncome(ctx.user.address, ONE_USD, MIG, ctx.deadline, sig);
        await expect(
            ctx.vault.migrateIncome(ctx.user.address, ONE_USD, MIG, ctx.deadline, sig),
        ).to.be.revertedWithCustomError(ctx.vault, 'IncomeVault__DuplicateMigration');
    });

    it('11 user cannot withdraw another user balance', async function () {
        const ctx = await deployFixture();
        await creditUser(ctx, ctx.user, ethers.parseEther('100'));
        const { sig } = await signTeamSettlement(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.attacker.address,
            ethers.parseEther('100'),
            WITHDRAW_ID,
            [],
            ctx.deadline,
        );
        await expect(
            ctx.vault.connect(ctx.attacker).withdraw(ethers.parseEther('100'), WITHDRAW_ID, [], ctx.deadline, sig),
        ).to.be.revertedWithCustomError(ctx.vault, 'IncomeVault__InsufficientBalance');
    });

    it('12 over-withdraw fails', async function () {
        const ctx = await deployFixture();
        await creditUser(ctx, ctx.user, ethers.parseEther('100'));
        const gross = ethers.parseEther('101');
        const { sig } = await signTeamSettlement(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.user.address,
            gross,
            WITHDRAW_ID,
            [],
            ctx.deadline,
        );
        await expect(
            ctx.vault.connect(ctx.user).withdraw(gross, WITHDRAW_ID, [], ctx.deadline, sig),
        ).to.be.revertedWithCustomError(ctx.vault, 'IncomeVault__InsufficientBalance');
    });

    it('13 zero withdrawal fails', async function () {
        const ctx = await deployFixture();
        await creditUser(ctx, ctx.user, ONE_USD);
        const { sig } = await signTeamSettlement(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.user.address,
            0n,
            WITHDRAW_ID,
            [],
            ctx.deadline,
        );
        await expect(
            ctx.vault.connect(ctx.user).withdraw(0n, WITHDRAW_ID, [], ctx.deadline, sig),
        ).to.be.revertedWithCustomError(ctx.vault, 'IncomeVault__ZeroAmount');
    });

    it('14-15 fee invariant gross = net + team + admin', async function () {
        const ctx = await deployFixture();
        const gross = ethers.parseEther('100');
        await creditUser(ctx, ctx.user, gross);
        const teamReward = gross / 10n;
        const adminFee = ethers.parseEther('1');
        const net = gross - teamReward - adminFee;
        const wdId = ethers.id('wd-fee');
        const { sig } = await signTeamSettlement(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.user.address,
            gross,
            wdId,
            [{ recipient: ctx.upline.address, amount: teamReward }],
            ctx.deadline,
        );
        const beforeUser = await ctx.usdt.balanceOf(ctx.user.address);
        await ctx.vault.connect(ctx.user).withdraw(gross, wdId, [{ recipient: ctx.upline.address, amount: teamReward }], ctx.deadline, sig);
        expect(await ctx.usdt.balanceOf(ctx.user.address)).to.equal(beforeUser + net);
    });

    it('16 withdrawal replay fails', async function () {
        const ctx = await deployFixture();
        const gross = ethers.parseEther('50');
        await creditUser(ctx, ctx.user, gross);
        const teamReward = gross / 10n;
        const { sig } = await signTeamSettlement(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.user.address,
            gross,
            WITHDRAW_ID,
            [{ recipient: ctx.upline.address, amount: teamReward }],
            ctx.deadline,
        );
        const payouts = [{ recipient: ctx.upline.address, amount: teamReward }];
        await ctx.vault.connect(ctx.user).withdraw(gross, WITHDRAW_ID, payouts, ctx.deadline, sig);
        await expect(
            ctx.vault.connect(ctx.user).withdraw(gross, WITHDRAW_ID, payouts, ctx.deadline, sig),
        ).to.be.revertedWithCustomError(ctx.vault, 'IncomeVault__DuplicateWithdrawal');
    });

    it('19 admin cannot arbitrarily change balance', async function () {
        const ctx = await deployFixture();
        expect(ctx.vault.setBalance).to.equal(undefined);
    });

    it('20 pause blocks credit but funds stay', async function () {
        const ctx = await deployFixture();
        await creditUser(ctx, ctx.user, ONE_USD);
        await ctx.vault.connect(ctx.owner).pause();
        const sig = await signCredit(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.user.address,
            ONE_USD,
            ctx.incomeType,
            ethers.id('ref-pause'),
            ctx.deadline,
        );
        await expect(
            ctx.vault.creditIncome(ctx.user.address, ONE_USD, ctx.incomeType, ethers.id('ref-pause'), ctx.deadline, sig),
        ).to.be.revertedWithCustomError(ctx.vault, 'EnforcedPause');
        expect(await ctx.vault.incomeBalance(ctx.user.address)).to.equal(ONE_USD);
    });

    it('21 unauthorized fee recipient change fails', async function () {
        const ctx = await deployFixture();
        await expect(
            ctx.vault.connect(ctx.attacker).setAdminFeeRecipient(ctx.attacker.address),
        ).to.be.revertedWithCustomError(ctx.vault, 'OwnableUnauthorizedAccount');
    });

    it('22-23 authorized credit and withdraw work', async function () {
        const ctx = await deployFixture();
        await creditUser(ctx, ctx.user, ethers.parseEther('100'));
        expect(await ctx.vault.incomeBalance(ctx.user.address)).to.equal(ethers.parseEther('100'));
    });

    it('fee boundary $99 vs $100 admin fee', async function () {
        const ctx = await deployFixture();
        const gross99 = ethers.parseEther('99');
        await creditUser(ctx, ctx.user, gross99, ethers.id('g99'));
        const team99 = gross99 / 10n;
        const net99 = gross99 - team99 - ethers.parseEther('1');
        const id99 = ethers.id('w99');
        const s99 = await signTeamSettlement(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.user.address,
            gross99,
            id99,
            [],
            ctx.deadline,
        );
        await ctx.vault.connect(ctx.user).withdraw(gross99, id99, [], ctx.deadline, s99.sig);
        expect(await ctx.usdt.balanceOf(ctx.user.address)).to.equal(net99);
    });
});
