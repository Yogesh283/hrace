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
