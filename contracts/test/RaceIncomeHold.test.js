const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { deployAndWireRewardOracle } = require('./helpers/rewardOracle');

describe('RaceIncomeHold', function () {
    const ONE_DAY = 24 * 60 * 60;
    const USDT_50 = ethers.parseEther('50');
    const TEAM_WEIGHTS = [25n, 15n, 12n, 10n, 9n, 8n, 6n, 5n, 5n, 5n];

    async function deployHoldFixture(usdtDecimals = 18) {
        const [owner, admin, user, stranger] = await ethers.getSigners();

        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const usdt = await MockERC20.deploy('USDT', 'USDT', usdtDecimals);
        const race = await MockERC20.deploy('RACE', 'RACE', 18);

        const RaceRewardPriceOracle = await ethers.getContractFactory('RaceRewardPriceOracle');
        const oracle = await RaceRewardPriceOracle.deploy(
            owner.address,
            ethers.parseEther('1'),
            7 * 24 * 60 * 60,
            ethers.parseEther('0.01'),
            ethers.parseEther('100'),
        );

        const RaceIncomeHold = await ethers.getContractFactory('RaceIncomeHold');
        const hold = await RaceIncomeHold.deploy(
            owner.address,
            await race.getAddress(),
            await usdt.getAddress(),
            admin.address,
            await oracle.getAddress(),
        );
        await hold.setVault(owner.address);

        return { owner, admin, user, stranger, usdt, race, oracle, hold, usdtDecimals };
    }

    async function credit(hold, race, user, amount) {
        await race.mint(await hold.getAddress(), amount);
        await hold.credit(user.address, amount);
    }

    async function approveAndWithdraw(hold, usdt, user, fee) {
        await usdt.mint(user.address, fee);
        await usdt.connect(user).approve(await hold.getAddress(), fee);
        return hold.connect(user).withdraw();
    }

    async function deployEngineHold() {
        const [owner, admin, sponsor, user, extra, other] = await ethers.getSigners();
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
        const oracle = await deployAndWireRewardOracle(ethers, owner, engine);
        const RaceIncomeHold = await ethers.getContractFactory('RaceIncomeHold');
        const hold = await RaceIncomeHold.deploy(
            owner.address,
            await race.getAddress(),
            await usdt.getAddress(),
            admin.address,
            await oracle.getAddress(),
        );
        await hold.setVault(owner.address);
        await hold.setEngine(await engine.getAddress());
        await engine.setIncomeHold(await hold.getAddress());
        await race.mint(await router.getAddress(), ethers.parseEther('1000000'));
        return { owner, admin, sponsor, user, extra, other, usdt, race, router, vault, engine, oracle, hold };
    }

    async function stake50(engine, usdt, member, referrer) {
        await usdt.mint(member.address, ethers.parseEther('1000'));
        await usdt.connect(member).approve(await engine.getAddress(), ethers.parseEther('1000'));
        if (referrer) {
            await engine.connect(member).register(referrer.address);
        } else {
            await engine.connect(member).register(ethers.ZeroAddress);
        }
        await engine.connect(member).participate(USDT_50, 0);
    }

    function teamShare(pool, weight) {
        return (pool * weight) / 100n;
    }

    describe('quote: 10% RACE team + USDT admin fee on GROSS value', function () {
        it('quotes $1 fee when USDT value is $1–$99 and 90/10 RACE split', async function () {
            const { hold, race, user } = await deployHoldFixture();
            await credit(hold, race, user, ethers.parseEther('50'));

            const q = await hold.quoteWithdraw(user.address);
            expect(q.raceAmount).to.equal(ethers.parseEther('50'));
            expect(q.valueUsdt).to.equal(ethers.parseEther('50'));
            expect(q.feeUsdt).to.equal(ethers.parseEther('1'));
            expect(q.teamRace).to.equal(ethers.parseEther('5'));
            expect(q.netRace).to.equal(ethers.parseEther('45'));
        });

        it('quotes $1 fee at $99 and 1% at exactly $100', async function () {
            const { hold, race, user } = await deployHoldFixture();
            await credit(hold, race, user, ethers.parseEther('99'));
            let q = await hold.quoteWithdraw(user.address);
            expect(q.feeUsdt).to.equal(ethers.parseEther('1'));
            expect(q.netRace).to.equal(ethers.parseEther('89.1'));
            expect(q.teamRace).to.equal(ethers.parseEther('9.9'));

            await credit(hold, race, user, ethers.parseEther('1'));
            q = await hold.quoteWithdraw(user.address);
            expect(q.valueUsdt).to.equal(ethers.parseEther('100'));
            expect(q.feeUsdt).to.equal(ethers.parseEther('1'));
            expect(q.teamRace).to.equal(ethers.parseEther('10'));
            expect(q.netRace).to.equal(ethers.parseEther('90'));
        });

        it('quotes 1% fee when USDT value is $100+', async function () {
            const { hold, race, user } = await deployHoldFixture();
            await credit(hold, race, user, ethers.parseEther('200'));

            const q = await hold.quoteWithdraw(user.address);
            expect(q.valueUsdt).to.equal(ethers.parseEther('200'));
            expect(q.feeUsdt).to.equal(ethers.parseEther('2'));
            expect(q.teamRace).to.equal(ethers.parseEther('20'));
            expect(q.netRace).to.equal(ethers.parseEther('180'));
        });

        it('uses GROSS RACE value for USDT fee (not the 90% net)', async function () {
            const { hold, race, user } = await deployHoldFixture();
            await credit(hold, race, user, ethers.parseEther('100'));
            const q = await hold.quoteWithdraw(user.address);
            expect(q.valueUsdt).to.equal(ethers.parseEther('100'));
            expect(q.feeUsdt).to.equal(ethers.parseEther('1'));
            expect(q.netRace + q.teamRace).to.equal(q.raceAmount);
        });

        it('scales admin USDT fee to 6-decimal USDT (BSC)', async function () {
            const { hold, race, user } = await deployHoldFixture(6);
            await credit(hold, race, user, ethers.parseEther('100'));

            const q = await hold.quoteWithdraw(user.address);
            expect(q.valueUsdt).to.equal(100_000000n);
            expect(q.feeUsdt).to.equal(1_000000n);
            expect(q.teamRace).to.equal(ethers.parseEther('10'));
            expect(q.netRace).to.equal(ethers.parseEther('90'));
        });

        it('quotes $1 fee on 6-decimal USDT when value is $50', async function () {
            const { hold, race, user } = await deployHoldFixture(6);
            await credit(hold, race, user, ethers.parseEther('50'));
            const q = await hold.quoteWithdraw(user.address);
            expect(q.valueUsdt).to.equal(50_000000n);
            expect(q.feeUsdt).to.equal(1_000000n);
        });

        it('quotes 1% when price is $2 and hold is 50 RACE ($100)', async function () {
            const { hold, race, oracle, user } = await deployHoldFixture();
            await oracle.setBounds(ethers.parseEther('0.01'), ethers.parseEther('100'), 5_000);
            await oracle.updatePrice(ethers.parseEther('1.5'));
            await oracle.updatePrice(ethers.parseEther('2'));
            await credit(hold, race, user, ethers.parseEther('50'));
            const q = await hold.quoteWithdraw(user.address);
            expect(q.valueUsdt).to.equal(ethers.parseEther('100'));
            expect(q.feeUsdt).to.equal(ethers.parseEther('1'));
            expect(q.netRace).to.equal(ethers.parseEther('45'));
            expect(q.teamRace).to.equal(ethers.parseEther('5'));
        });
    });

    describe('withdraw guards', function () {
        it('reverts withdraw when value is under $1', async function () {
            const { hold, race, user } = await deployHoldFixture();
            await credit(hold, race, user, ethers.parseEther('0.5'));
            await expect(hold.connect(user).withdraw()).to.be.revertedWith('IncomeHold: min $1');
        });

        it('reverts withdraw when hold is empty', async function () {
            const { hold, user } = await deployHoldFixture();
            await expect(hold.connect(user).withdraw()).to.be.revertedWith('IncomeHold: empty');
        });

        it('rejects credit from stranger', async function () {
            const { hold, stranger, user } = await deployHoldFixture();
            await expect(hold.connect(stranger).credit(user.address, 1)).to.be.revertedWith(
                'IncomeHold: not creditor',
            );
        });

        it('second withdraw reverts after hold is cleared', async function () {
            const { hold, race, usdt, user } = await deployHoldFixture();
            await credit(hold, race, user, ethers.parseEther('50'));
            await approveAndWithdraw(hold, usdt, user, ethers.parseEther('1'));
            await expect(hold.connect(user).withdraw()).to.be.revertedWith('IncomeHold: empty');
        });
    });

    describe('example: 100 RACE ≈ $100', function () {
        it('user 90 RACE, team pool 10 RACE, admin $1 USDT — leftover 10% to admin if no team', async function () {
            const { hold, race, usdt, admin, user } = await deployHoldFixture();
            const raceAmt = ethers.parseEther('100');
            await credit(hold, race, user, raceAmt);

            const userUsdtBefore = await usdt.balanceOf(user.address);
            await approveAndWithdraw(hold, usdt, user, ethers.parseEther('1'));

            expect(await hold.holdOf(user.address)).to.equal(0n);
            expect(await race.balanceOf(user.address)).to.equal(ethers.parseEther('90'));
            expect(await race.balanceOf(admin.address)).to.equal(ethers.parseEther('10'));
            expect(await usdt.balanceOf(admin.address)).to.equal(ethers.parseEther('1'));
            expect(await usdt.balanceOf(user.address)).to.equal(userUsdtBefore);
            expect(await race.balanceOf(await hold.getAddress())).to.equal(0n);
        });

        it('does not cut a second RACE fee — user always receives exactly 90%', async function () {
            const { hold, race, usdt, user } = await deployHoldFixture();
            await credit(hold, race, user, ethers.parseEther('100'));
            await approveAndWithdraw(hold, usdt, user, ethers.parseEther('1'));
            expect(await race.balanceOf(user.address)).to.equal(ethers.parseEther('90'));
        });
    });

    describe('withdraw accounting', function () {
        it('withdraws 90% RACE after $1 USDT admin fee; 10% leftover to admin RACE wallet', async function () {
            const { hold, race, usdt, admin, user } = await deployHoldFixture();
            const raceAmt = ethers.parseEther('50');
            const teamRace = ethers.parseEther('5');
            const netRace = ethers.parseEther('45');
            await credit(hold, race, user, raceAmt);
            await usdt.mint(user.address, ethers.parseEther('10'));
            await usdt.connect(user).approve(await hold.getAddress(), ethers.parseEther('1'));

            await expect(hold.connect(user).withdraw())
                .to.emit(hold, 'IncomeWithdrawn')
                .withArgs(
                    user.address,
                    raceAmt,
                    netRace,
                    teamRace,
                    ethers.parseEther('50'),
                    ethers.parseEther('1'),
                );

            expect(await hold.holdOf(user.address)).to.equal(0n);
            expect(await race.balanceOf(user.address)).to.equal(netRace);
            expect(await race.balanceOf(admin.address)).to.equal(teamRace);
            expect(await usdt.balanceOf(admin.address)).to.equal(ethers.parseEther('1'));
        });

        it('withdraws 90% RACE after 1% USDT admin fee on $200', async function () {
            const { hold, race, usdt, admin, user } = await deployHoldFixture();
            await credit(hold, race, user, ethers.parseEther('200'));
            await approveAndWithdraw(hold, usdt, user, ethers.parseEther('2'));

            expect(await race.balanceOf(user.address)).to.equal(ethers.parseEther('180'));
            expect(await race.balanceOf(admin.address)).to.equal(ethers.parseEther('20'));
            expect(await usdt.balanceOf(admin.address)).to.equal(ethers.parseEther('2'));
            expect(await hold.holdOf(user.address)).to.equal(0n);
        });

        it('pulls 6-decimal USDT $1 fee and sends 90 RACE to user', async function () {
            const { hold, race, usdt, admin, user } = await deployHoldFixture(6);
            await credit(hold, race, user, ethers.parseEther('100'));
            await approveAndWithdraw(hold, usdt, user, 1_000000n);

            expect(await race.balanceOf(user.address)).to.equal(ethers.parseEther('90'));
            expect(await race.balanceOf(admin.address)).to.equal(ethers.parseEther('10'));
            expect(await usdt.balanceOf(admin.address)).to.equal(1_000000n);
        });
    });

    describe('team L1–L10 split and leftover', function () {
        it('pays full L1–L10 weights of the 10% pool; user still gets 90%', async function () {
            const { owner, admin, user, usdt, race, hold } = await deployHoldFixture();
            const signers = await ethers.getSigners();
            const uplines = signers.slice(4, 14);
            expect(uplines).to.have.length(10);

            const MockEngine = await ethers.getContractFactory('MockIncomeHoldTeamEngine');
            const mock = await MockEngine.deploy();
            await hold.setEngine(await mock.getAddress());
            await mock.configure(
                await hold.getAddress(),
                uplines.map((s) => s.address),
                TEAM_WEIGHTS.map((w) => Number(w)),
            );

            const raceAmt = ethers.parseEther('100');
            const pool = ethers.parseEther('10');
            await credit(hold, race, user, raceAmt);
            await approveAndWithdraw(hold, usdt, user, ethers.parseEther('1'));

            expect(await race.balanceOf(user.address)).to.equal(ethers.parseEther('90'));
            expect(await usdt.balanceOf(admin.address)).to.equal(ethers.parseEther('1'));

            let credited = 0n;
            for (let i = 0; i < 10; i++) {
                const share = teamShare(pool, TEAM_WEIGHTS[i]);
                expect(await hold.holdOf(uplines[i].address), `L${i + 1}`).to.equal(share);
                credited += share;
            }
            expect(credited).to.equal(pool);
            expect(await race.balanceOf(admin.address)).to.equal(0n);
            expect(await race.balanceOf(await hold.getAddress())).to.equal(pool);
        });

        it('example L1 2.5 + L2 1.5; unpaid 6 RACE goes to admin RACE wallet', async function () {
            const { owner, admin, user, usdt, race, hold } = await deployHoldFixture();
            const [, , , , l1, l2] = await ethers.getSigners();
            const MockEngine = await ethers.getContractFactory('MockIncomeHoldTeamEngine');
            const mock = await MockEngine.deploy();
            await hold.setEngine(await mock.getAddress());
            await mock.configure(
                await hold.getAddress(),
                [l1.address, l2.address],
                [25, 15],
            );

            await credit(hold, race, user, ethers.parseEther('100'));
            await approveAndWithdraw(hold, usdt, user, ethers.parseEther('1'));

            expect(await hold.holdOf(l1.address)).to.equal(ethers.parseEther('2.5'));
            expect(await hold.holdOf(l2.address)).to.equal(ethers.parseEther('1.5'));
            expect(await race.balanceOf(user.address)).to.equal(ethers.parseEther('90'));
            expect(await race.balanceOf(admin.address)).to.equal(ethers.parseEther('6'));
            expect(await usdt.balanceOf(admin.address)).to.equal(ethers.parseEther('1'));
            expect(await race.balanceOf(await hold.getAddress())).to.equal(ethers.parseEther('4'));
        });

        it('pays L1 25% of the 10% team pool into sponsor hold when only L1 qualifies', async function () {
            const { hold, race, usdt, admin, sponsor, user, engine } = await deployEngineHold();
            await stake50(engine, usdt, sponsor, null);
            await stake50(engine, usdt, user, sponsor);

            const raceAmt = ethers.parseEther('100');
            await credit(hold, race, user, raceAmt);
            await usdt.mint(user.address, ethers.parseEther('10'));
            await usdt.connect(user).approve(await hold.getAddress(), ethers.parseEther('1'));

            const sponsorHoldBefore = await hold.holdOf(sponsor.address);
            await hold.connect(user).withdraw();

            expect(await hold.holdOf(sponsor.address)).to.equal(sponsorHoldBefore + ethers.parseEther('2.5'));
            expect(await race.balanceOf(user.address)).to.equal(ethers.parseEther('90'));
            expect(await race.balanceOf(admin.address)).to.equal(ethers.parseEther('7.5'));
            expect(await usdt.balanceOf(admin.address)).to.equal(ethers.parseEther('1'));
        });

        it('pays L1 2.5 and L2 1.5 when L2 has two $50+ directs', async function () {
            const { hold, race, usdt, admin, sponsor, user, extra, other, engine } = await deployEngineHold();
            await stake50(engine, usdt, sponsor, null);
            await stake50(engine, usdt, extra, sponsor);
            await stake50(engine, usdt, other, sponsor);
            await stake50(engine, usdt, user, extra);

            await credit(hold, race, user, ethers.parseEther('100'));
            await usdt.mint(user.address, ethers.parseEther('10'));
            await usdt.connect(user).approve(await hold.getAddress(), ethers.parseEther('1'));

            const l1Before = await hold.holdOf(extra.address);
            const l2Before = await hold.holdOf(sponsor.address);
            await hold.connect(user).withdraw();

            expect(await hold.holdOf(extra.address)).to.equal(l1Before + ethers.parseEther('2.5'));
            expect(await hold.holdOf(sponsor.address)).to.equal(l2Before + ethers.parseEther('1.5'));
            expect(await race.balanceOf(user.address)).to.equal(ethers.parseEther('90'));
            expect(await race.balanceOf(admin.address)).to.equal(ethers.parseEther('6'));
            expect(await usdt.balanceOf(admin.address)).to.equal(ethers.parseEther('1'));
        });

        it('conserves RACE: user + admin leftover + remaining hold == original credit', async function () {
            const { hold, race, usdt, admin, sponsor, user, extra, other, engine } = await deployEngineHold();
            await stake50(engine, usdt, sponsor, null);
            await stake50(engine, usdt, extra, sponsor);
            await stake50(engine, usdt, other, sponsor);
            await stake50(engine, usdt, user, extra);

            const raceAmt = ethers.parseEther('100');
            await credit(hold, race, user, raceAmt);
            const holdBefore = await race.balanceOf(await hold.getAddress());
            await usdt.mint(user.address, ethers.parseEther('10'));
            await usdt.connect(user).approve(await hold.getAddress(), ethers.parseEther('1'));
            await hold.connect(user).withdraw();

            const userRace = await race.balanceOf(user.address);
            const adminRace = await race.balanceOf(admin.address);
            const holdLeft = await race.balanceOf(await hold.getAddress());
            expect(userRace + adminRace + holdLeft).to.equal(holdBefore);
            expect(userRace).to.equal(ethers.parseEther('90'));
        });
    });

    describe('vault claim still credits hold, not wallet', function () {
        it('vault claim credits user hold, not wallet', async function () {
            const { hold, race, usdt, sponsor, user, engine, vault } = await deployEngineHold();
            await hold.setVault(await vault.getAddress());
            await vault.setIncomeHold(await hold.getAddress());
            await stake50(engine, usdt, sponsor, null);
            await stake50(engine, usdt, user, sponsor);
            await engine.setClaimEnabled(true);
            await time.increase(ONE_DAY);

            const walletBefore = await race.balanceOf(user.address);
            await engine.connect(user).claimReward(0);

            const userHold = await hold.holdOf(user.address);
            expect(await race.balanceOf(user.address)).to.equal(walletBefore);
            expect(userHold).to.be.gt(0);
            expect(await race.balanceOf(await hold.getAddress())).to.be.gte(userHold);
            expect(await hold.holdOf(sponsor.address)).to.be.gt(0);
        });
    });
});
