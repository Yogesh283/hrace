const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('ICO Contract + admin deposit', function () {
    const TOTAL = ethers.parseEther('600000');

    async function deployFixture() {
        const [owner, admin, stranger] = await ethers.getSigners();
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const race = await MockERC20.deploy('RACE', 'RACE', 18);
        const ICOContract = await ethers.getContractFactory('ICOContract');
        const icoContract = await ICOContract.deploy(owner.address, await race.getAddress(), admin.address);
        return { owner, admin, stranger, race, icoContract };
    }

    it('names ICO Contract admin and starts empty until admin deposits', async function () {
        const { admin, icoContract } = await deployFixture();
        expect(await icoContract.admin()).to.equal(admin.address);
        expect(await icoContract.TOTAL_ALLOCATION()).to.equal(TOTAL);
        expect(await icoContract.available()).to.equal(0n);
        expect(await icoContract.totalDeposited()).to.equal(0n);
    });

    it('admin deposits 600k from their wallet; stranger cannot', async function () {
        const { admin, stranger, race, icoContract } = await deployFixture();
        await race.mint(admin.address, TOTAL);
        await race.connect(admin).approve(await icoContract.getAddress(), TOTAL);
        await expect(icoContract.connect(stranger).depositReserve(ethers.parseEther('1'))).to.be.revertedWith(
            'ICOContract: not admin',
        );
        await expect(icoContract.connect(admin).depositReserve(TOTAL))
            .to.emit(icoContract, 'ReserveDeposited')
            .withArgs(admin.address, TOTAL);
        expect(await icoContract.available()).to.equal(TOTAL);
        expect(await icoContract.totalDeposited()).to.equal(TOTAL);
        expect(await race.balanceOf(admin.address)).to.equal(0n);
        await race.mint(admin.address, 1n);
        await race.connect(admin).approve(await icoContract.getAddress(), 1n);
        await expect(icoContract.connect(admin).depositReserve(1n)).to.be.revertedWith('ICOContract: allocation');
    });

    it('only RaceICO can release, and cannot exceed 600k', async function () {
        const { owner, admin, stranger, race, icoContract } = await deployFixture();
        await race.mint(admin.address, TOTAL);
        await race.connect(admin).approve(await icoContract.getAddress(), TOTAL);
        await icoContract.connect(admin).depositReserve(TOTAL);
        await expect(icoContract.connect(stranger).releaseToHold(ethers.parseEther('1'))).to.be.revertedWith(
            'ICOContract: not RaceICO',
        );
        await icoContract.setRaceIco(owner.address);
        await icoContract.connect(owner).releaseToHold(ethers.parseEther('100'));
        expect(await icoContract.totalReleased()).to.equal(ethers.parseEther('100'));
        expect(await race.balanceOf(owner.address)).to.equal(ethers.parseEther('100'));
        await expect(icoContract.connect(owner).releaseToHold(TOTAL)).to.be.revertedWith('ICOContract: allocation');
    });

    it('admin cannot withdraw unsold coins while sale active; can after icoCompleted', async function () {
        const { owner, admin, stranger, race, icoContract } = await deployFixture();
        await race.mint(admin.address, TOTAL);
        await race.connect(admin).approve(await icoContract.getAddress(), TOTAL);
        await icoContract.connect(admin).depositReserve(TOTAL);

        await expect(icoContract.connect(stranger).withdrawReserve(ethers.parseEther('100'))).to.be.revertedWith(
            'ICOContract: not admin',
        );
        await expect(icoContract.connect(admin).withdrawReserve(ethers.parseEther('100'))).to.be.revertedWith(
            'ICOContract: no RaceICO',
        );

        const MockIco = await ethers.getContractFactory('MockIcoCompletion');
        const mockIco = await MockIco.deploy();
        await icoContract.setRaceIco(await mockIco.getAddress());
        await expect(icoContract.connect(admin).withdrawReserve(ethers.parseEther('100'))).to.be.revertedWith(
            'ICOContract: sale active',
        );

        await mockIco.setIcoCompleted(true);
        await expect(icoContract.connect(admin).withdrawReserve(ethers.parseEther('100')))
            .to.emit(icoContract, 'ReserveWithdrawn')
            .withArgs(admin.address, ethers.parseEther('100'));
        expect(await race.balanceOf(admin.address)).to.equal(ethers.parseEther('100'));
        expect(await icoContract.available()).to.equal(TOTAL - ethers.parseEther('100'));
        expect(await icoContract.totalDeposited()).to.equal(TOTAL - ethers.parseEther('100'));
    });

    it('stranger cannot change ICO Contract admin', async function () {
        const { admin, stranger, icoContract } = await deployFixture();
        await expect(icoContract.connect(stranger).setAdmin(stranger.address)).to.be.revertedWithCustomError(
            icoContract,
            'OwnableUnauthorizedAccount',
        );
        expect(await icoContract.admin()).to.equal(admin.address);
    });
});
