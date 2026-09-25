const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Security: RaceICO allocation caps', function () {
    it('rejects purchase exceeding TOTAL_ALLOCATION', async function () {
        const [owner, buyer] = await ethers.getSigners();
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const usdt = await MockERC20.deploy('USDT', 'USDT', 18);
        const RaceCoin = await ethers.getContractFactory('RaceCoin');
        const race = await RaceCoin.deploy(
            owner.address,
            owner.address,
            owner.address,
            owner.address,
            owner.address,
        );
        const RaceICO = await ethers.getContractFactory('RaceICO');
        const ico = await RaceICO.deploy(owner.address, await race.getAddress(), await usdt.getAddress(), owner.address);
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
        await ico.setStakingEngine(await engine.getAddress());
        await engine.setIcoContract(await ico.getAddress());
        await race.setMinter(owner.address, true);
        await race.mint(await ico.getAddress(), ethers.parseEther('600000'));
        await race.setMinter(owner.address, false);
        await ico.startPhase(1);

        const phaseCap = await ico.phaseUsdtCap(1);
        const huge = phaseCap + ethers.parseEther('1');
        await usdt.mint(buyer.address, huge);
        await usdt.connect(buyer).approve(await ico.getAddress(), ethers.MaxUint256);
        await expect(
            ico.connect(buyer).purchase(huge, 180n * 24n * 60n * 60n),
        ).to.be.revertedWith('RaceICO: phase usdt cap');
    });
});
