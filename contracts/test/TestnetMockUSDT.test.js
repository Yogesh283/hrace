const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('TestnetMockUSDT', function () {
    async function deploy() {
        const [admin, user, stranger] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory('TestnetMockUSDT');
        const token = await Factory.deploy(admin.address);
        await token.waitForDeployment();
        return { token, admin, user, stranger };
    }

    it('decimals is 18', async function () {
        const { token } = await deploy();
        expect(await token.decimals()).to.equal(18);
    });

    it('name and symbol are clearly TESTNET / not official USDT', async function () {
        const { token } = await deploy();
        expect(await token.name()).to.equal('RACE Test USDT');
        expect(await token.symbol()).to.equal('TEST-USDT');
    });

    it('admin can mint', async function () {
        const { token, admin, user } = await deploy();
        const amount = ethers.parseEther('1000');
        await expect(token.connect(admin).mint(user.address, amount))
            .to.emit(token, 'Transfer')
            .withArgs(ethers.ZeroAddress, user.address, amount);
        expect(await token.balanceOf(user.address)).to.equal(amount);
    });

    it('unauthorized mint fails', async function () {
        const { token, user, stranger } = await deploy();
        await expect(token.connect(stranger).mint(user.address, 1n)).to.be.revertedWithCustomError(
            token,
            'OwnableUnauthorizedAccount',
        );
    });

    it('transfer works', async function () {
        const { token, admin, user, stranger } = await deploy();
        await token.connect(admin).mint(user.address, ethers.parseEther('10'));
        await token.connect(user).transfer(stranger.address, ethers.parseEther('3'));
        expect(await token.balanceOf(stranger.address)).to.equal(ethers.parseEther('3'));
        expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther('7'));
    });

    it('approve + transferFrom works', async function () {
        const { token, admin, user, stranger } = await deploy();
        await token.connect(admin).mint(user.address, ethers.parseEther('50'));
        await token.connect(user).approve(stranger.address, ethers.parseEther('20'));
        expect(await token.allowance(user.address, stranger.address)).to.equal(ethers.parseEther('20'));
        await token.connect(stranger).transferFrom(user.address, stranger.address, ethers.parseEther('15'));
        expect(await token.balanceOf(stranger.address)).to.equal(ethers.parseEther('15'));
        expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther('35'));
    });
});
