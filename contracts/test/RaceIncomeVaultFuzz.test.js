const { expect } = require('chai');
const { ethers } = require('hardhat');
const { signCredit, signTeamSettlement } = require('./helpers/incomeVaultSign');

describe('RaceIncomeVault fuzz / invariants', function () {
    async function deployFixture() {
        const [owner, settlementSigner, admin, pool, userA, userB] = await ethers.getSigners();
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
        await usdt.mint(pool.address, ethers.parseEther('100000000'));
        await usdt.connect(pool).approve(await vault.getAddress(), ethers.MaxUint256);
        const incomeType = await vault.INCOME_DAILY_REWARD();
        const deadline = Math.floor(Date.now() / 1000) + 86400;
        return { vault, usdt, settlementSigner, userA, userB, chainId, incomeType, deadline };
    }

    it('random credits and withdrawals preserve totals', async function () {
        const ctx = await deployFixture();
        let refIndex = 0;
        const credit = async (user, wholeUsd) => {
            const amount = ethers.parseEther(String(wholeUsd));
            const ref = ethers.id(`ref-${refIndex++}`);
            const sig = await signCredit(
                ctx.settlementSigner,
                await ctx.vault.getAddress(),
                ctx.chainId,
                user.address,
                amount,
                ctx.incomeType,
                ref,
                ctx.deadline,
            );
            await ctx.vault.creditIncome(user.address, amount, ctx.incomeType, ref, ctx.deadline, sig);
        };

        await credit(ctx.userA, 500);
        await credit(ctx.userB, 300);
        await credit(ctx.userA, 50);

        expect(await ctx.vault.incomeBalance(ctx.userA.address)).to.equal(ethers.parseEther('550'));
        expect(await ctx.vault.incomeBalance(ctx.userB.address)).to.equal(ethers.parseEther('300'));

        const gross = ethers.parseEther('100');
        const wd = ethers.id('fuzz-wd');
        const team = gross / 10n;
        const { sig } = await signTeamSettlement(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.userA.address,
            gross,
            wd,
            [],
            ctx.deadline,
        );
        await ctx.vault.connect(ctx.userA).withdraw(gross, wd, [], ctx.deadline, sig);
        expect(await ctx.vault.incomeBalance(ctx.userA.address)).to.equal(ethers.parseEther('450'));
        expect(await ctx.vault.totalCredited()).to.be.gte(await ctx.vault.totalWithdrawnGross());
    });

    it('same reference cannot be processed twice across users', async function () {
        const ctx = await deployFixture();
        const ref = ethers.id('shared-ref');
        const amount = ethers.parseEther('10');
        const sigA = await signCredit(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.userA.address,
            amount,
            ctx.incomeType,
            ref,
            ctx.deadline,
        );
        await ctx.vault.creditIncome(ctx.userA.address, amount, ctx.incomeType, ref, ctx.deadline, sigA);
        const sigB = await signCredit(
            ctx.settlementSigner,
            await ctx.vault.getAddress(),
            ctx.chainId,
            ctx.userB.address,
            amount,
            ctx.incomeType,
            ref,
            ctx.deadline,
        );
        await expect(
            ctx.vault.creditIncome(ctx.userB.address, amount, ctx.incomeType, ref, ctx.deadline, sigB),
        ).to.be.revertedWithCustomError(ctx.vault, 'IncomeVault__DuplicateReference');
    });
});
