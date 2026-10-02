const { expect } = require('chai');
const { ethers } = require('hardhat');

/**
 * Invariant: totalSupply <= MAX_SUPPLY; only minters may mint.
 */
describe('Security: RaceCoin mint paths', function () {
    it('rejects unauthorized mint', async function () {
        const [owner, attacker] = await ethers.getSigners();
        const RaceCoin = await ethers.getContractFactory('RaceCoin');
        const race = await RaceCoin.deploy(
            owner.address,
            owner.address,
            owner.address,
            owner.address,
            owner.address,
        );
        await expect(race.connect(attacker).mint(attacker.address, 1n)).to.be.revertedWith(
            'RaceCoin: not minter',
        );
    });

    it('minter cannot exceed MAX_SUPPLY', async function () {
        const [owner] = await ethers.getSigners();
        const RaceCoin = await ethers.getContractFactory('RaceCoin');
        const race = await RaceCoin.deploy(
            owner.address,
            owner.address,
            owner.address,
            owner.address,
            owner.address,
        );
        const max = await race.MAX_SUPPLY();
        const remaining = max - (await race.totalSupply());
        await race.setMinter(owner.address, true);
        await expect(race.mint(owner.address, remaining + 1n)).to.be.revertedWith('RaceCoin: max supply');
    });

    it('expense mint is owner-only and capped at 30M', async function () {
        const [owner, attacker, dest] = await ethers.getSigners();
        const RaceCoin = await ethers.getContractFactory('RaceCoin');
        const race = await RaceCoin.deploy(
            owner.address,
            owner.address,
            owner.address,
            owner.address,
            owner.address,
        );

        expect(await race.EXPENSE_ALLOCATION()).to.equal(ethers.parseEther('30000000'));
        expect(await race.remainingExpense()).to.equal(ethers.parseEther('30000000'));

        await expect(race.connect(attacker).expenseMint(dest.address, 1n)).to.be.revertedWithCustomError(
            race,
            'OwnableUnauthorizedAccount',
        );

        const need = ethers.parseEther('600000');
        await expect(race.expenseMint(dest.address, need))
            .to.emit(race, 'ExpenseMinted')
            .withArgs(dest.address, need, need);
        expect(await race.expenseMinted()).to.equal(need);
        expect(await race.remainingExpense()).to.equal(ethers.parseEther('29400000'));
        expect(await race.balanceOf(dest.address)).to.equal(need);

        await expect(race.expenseMint(dest.address, ethers.parseEther('30000001'))).to.be.revertedWith(
            'RaceCoin: expense cap',
        );
    });

    it('incomeMint only for the six kinds and only minter or owner', async function () {
        const [owner, attacker, dest] = await ethers.getSigners();
        const RaceCoin = await ethers.getContractFactory('RaceCoin');
        const race = await RaceCoin.deploy(
            owner.address,
            owner.address,
            owner.address,
            owner.address,
            owner.address,
        );

        await expect(race.connect(attacker).incomeMint(dest.address, 1n, 1)).to.be.revertedWith(
            'RaceCoin: not income minter',
        );
        await expect(race.incomeMint(dest.address, 1n, 0)).to.be.revertedWith('RaceCoin: bad income');
        await expect(race.incomeMint(dest.address, 1n, 7)).to.be.revertedWith('RaceCoin: bad income');

        const amount = ethers.parseEther('10');
        await expect(race.incomeMint(dest.address, amount, 5))
            .to.emit(race, 'IncomeMinted')
            .withArgs(dest.address, amount, 5, owner.address);
        expect(await race.incomeMintedByKind(5)).to.equal(amount);
        expect(await race.balanceOf(dest.address)).to.equal(amount);

        const minter = attacker;
        await race.setMinter(minter.address, true);
        await race.connect(minter).incomeMint(dest.address, amount, 3);
        expect(await race.incomeMintedByKind(3)).to.equal(amount);
    });

    it('vault pay rejects non-engine caller', async function () {
        const [owner, attacker] = await ethers.getSigners();
        const RaceCoin = await ethers.getContractFactory('RaceCoin');
        const race = await RaceCoin.deploy(
            owner.address,
            owner.address,
            owner.address,
            owner.address,
            owner.address,
        );
        const RaceRewardVault = await ethers.getContractFactory('RaceRewardVault');
        const vault = await RaceRewardVault.deploy(owner.address, await race.getAddress());
        await race.setMinter(await vault.getAddress(), true);
        await expect(vault.connect(attacker).pay(attacker.address, 1n)).to.be.revertedWith(
            'RaceRewardVault: not engine',
        );
    });
});
