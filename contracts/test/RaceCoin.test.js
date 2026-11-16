const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

const POOL_AMOUNT = ethers.parseEther('500000');

describe('Race Coin ecosystem', function () {
    async function deployFixture() {
        const [owner, s1, s2, s3, s4, alice, bob] = await ethers.getSigners();
        const multisigSigners = [owner, s1, s2, s3, s4].map((s) => s.address);

        const RaceMultiSig = await ethers.getContractFactory('RaceMultiSig');
        const multiSig = await RaceMultiSig.deploy(multisigSigners);

        const RaceCoin = await ethers.getContractFactory('RaceCoin');
        const race = await RaceCoin.deploy(
            owner.address,
            owner.address,
            owner.address,
            owner.address,
            owner.address,
        );

        const RaceTreasury = await ethers.getContractFactory('RaceTreasury');
        const treasury = await RaceTreasury.deploy(
            owner.address,
            await race.getAddress(),
            await multiSig.getAddress(),
        );

        const RaceAutoLiquidity = await ethers.getContractFactory('RaceAutoLiquidity');
        const autoLiq = await RaceAutoLiquidity.deploy(
            owner.address,
            await race.getAddress(),
            owner.address,
            owner.address,
        );

        const RaceStaking = await ethers.getContractFactory('RaceStaking');
        const staking = await RaceStaking.deploy(owner.address, await race.getAddress(), ethers.ZeroAddress);

        const RaceRewardPool = await ethers.getContractFactory('RaceRewardPool');
        const rewardPool = await RaceRewardPool.deploy(
            owner.address,
            await race.getAddress(),
            await staking.getAddress(),
        );

        const RaceGovernor = await ethers.getContractFactory('RaceGovernor');
        const governor = await RaceGovernor.deploy(await staking.getAddress());

        await staking.setRewardPool(await rewardPool.getAddress());
        await race.setFeeRecipients(
            await autoLiq.getAddress(),
            await treasury.getAddress(),
            await rewardPool.getAddress(),
            owner.address,
        );
        await race.setFeeExempt(await staking.getAddress(), true);

        await race.transfer(await rewardPool.getAddress(), POOL_AMOUNT);

        const userAmount = ethers.parseEther('100000');
        await race.transfer(alice.address, userAmount);
        await race.transfer(bob.address, userAmount);

        return { race, treasury, autoLiq, staking, rewardPool, governor, multiSig, owner, alice, bob, s1, s2, s3, s4 };
    }

    it('starts with 1,000,000 supply and 150,000,000 max', async function () {
        const { race } = await deployFixture();
        expect(await race.totalSupply()).to.equal(ethers.parseEther('1000000'));
        expect(await race.MAX_SUPPLY()).to.equal(ethers.parseEther('150000000'));
        expect(await race.INITIAL_MINT()).to.equal(ethers.parseEther('1000000'));
        expect(await race.EXPENSE_ALLOCATION()).to.equal(ethers.parseEther('30000000'));
    });

    it('multisig can expenseMint needed amount from 30M bucket', async function () {
        const { race, multiSig, owner, s1, s2, alice } = await deployFixture();
        await race.transferOwnership(await multiSig.getAddress());

        const amount = ethers.parseEther('250000');
        const data = race.interface.encodeFunctionData('expenseMint', [alice.address, amount]);
        await multiSig.connect(owner).submitTransaction(await race.getAddress(), 0, data);
        await multiSig.connect(owner).confirmTransaction(0);
        await multiSig.connect(s1).confirmTransaction(0);
        await multiSig.connect(s2).confirmTransaction(0);

        expect(await race.balanceOf(alice.address)).to.equal(ethers.parseEther('100000') + amount);
        expect(await race.expenseMinted()).to.equal(amount);
    });

    it('authorized minter can mint within max supply', async function () {
        const { race, owner, alice } = await deployFixture();
        await race.connect(owner).setMinter(owner.address, true);
        await expect(race.connect(owner).mint(alice.address, ethers.parseEther('10')))
            .to.emit(race, 'MinterMint')
            .withArgs(owner.address, alice.address, ethers.parseEther('10'));
        expect(await race.totalSupply()).to.equal(ethers.parseEther('1000010'));
    });

    it('registers without referral and with optional referral', async function () {
        const { staking, alice, bob } = await deployFixture();
        await staking.connect(alice).register(ethers.ZeroAddress);
        expect(await staking.registered(alice.address)).to.equal(true);

        await staking.connect(bob).register(alice.address);
        expect(await staking.referrerOf(bob.address)).to.equal(alice.address);
    });

    it('stakes, activates ID, and unstakes after lock', async function () {
        const { race, staking, alice } = await deployFixture();
        await staking.connect(alice).register(ethers.ZeroAddress);

        const amount = ethers.parseEther('1000');
        await race.connect(alice).approve(await staking.getAddress(), amount);
        await staking.connect(alice).stake(amount, 30 * 24 * 60 * 60);

        expect(await staking.idActive(alice.address)).to.equal(true);

        await time.increase(30 * 24 * 60 * 60 + 1);
        await staking.connect(alice).unstake(0);

        expect(await staking.activeStakeAmount(alice.address)).to.equal(0);
    });

    it('flexible stake allows immediate unstake', async function () {
        const { race, staking, alice } = await deployFixture();
        await staking.connect(alice).register(ethers.ZeroAddress);

        const amount = ethers.parseEther('500');
        await race.connect(alice).approve(await staking.getAddress(), amount);
        await staking.connect(alice).stake(amount, 0);
        await staking.connect(alice).unstake(0);

        expect(await staking.activeStakeAmount(alice.address)).to.equal(0);
    });

    it('accumulates missed daily rewards up to backlog', async function () {
        const { race, staking, rewardPool, alice } = await deployFixture();
        await staking.connect(alice).register(ethers.ZeroAddress);

        const amount = ethers.parseEther('10000');
        await race.connect(alice).approve(await staking.getAddress(), amount);
        await staking.connect(alice).stake(amount, 0);

        await time.increase(3 * 24 * 60 * 60);
        const pending = await rewardPool.pendingDailyReward(alice.address);
        expect(pending).to.be.gt(0);

        const before = await race.balanceOf(alice.address);
        await rewardPool.connect(alice).claimDailyReward();
        const after = await race.balanceOf(alice.address);
        expect(after).to.be.gt(before);
    });

    it('treasury withdraw requires multisig', async function () {
        const { race, treasury, multiSig, owner, s1, s2 } = await deployFixture();
        await race.transfer(await treasury.getAddress(), ethers.parseEther('100'));

        await expect(
            treasury.connect(owner).withdraw(owner.address, ethers.parseEther('1'), 'test'),
        ).to.be.revertedWith('RaceTreasury: not multisig');

        const withdrawAmount = ethers.parseEther('1');
        const before = await race.balanceOf(owner.address);
        const data = treasury.interface.encodeFunctionData('withdraw', [
            owner.address,
            withdrawAmount,
            'test',
        ]);
        await multiSig.connect(owner).submitTransaction(await treasury.getAddress(), 0, data);
        await multiSig.connect(owner).confirmTransaction(0);
        await multiSig.connect(s1).confirmTransaction(0);
        await multiSig.connect(s2).confirmTransaction(0);

        expect(await race.balanceOf(owner.address)).to.equal(before + withdrawAmount);
    });

    it('charges 4% fee on wallet transfer', async function () {
        const { race, autoLiq, treasury, rewardPool, alice, bob } = await deployFixture();
        const poolBefore = await race.balanceOf(await rewardPool.getAddress());
        const bobBefore = await race.balanceOf(bob.address);

        const amount = ethers.parseEther('1000');
        const fee = (amount * 400n) / 10000n;
        const net = amount - fee;

        await race.connect(alice).transfer(bob.address, amount);

        expect(await race.balanceOf(bob.address)).to.equal(bobBefore + net);
        expect(await race.balanceOf(await rewardPool.getAddress())).to.equal(poolBefore + fee / 4n);
    });
});
