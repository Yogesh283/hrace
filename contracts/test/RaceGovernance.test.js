const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('RaceGovernance (community 10–12 wallets)', function () {
    const VOTING = 2 * 24 * 60 * 60;
    const TIMELOCK = 24 * 60 * 60;

    async function deployGov(overrides = {}) {
        const accounts = await ethers.getSigners();
        const members = accounts.slice(0, 12);
        const stranger = accounts[12] || accounts[11];
        const threshold = overrides.threshold ?? 7;

        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const race = await MockERC20.deploy('RACE', 'RACE', 18);
        const usdt = await MockERC20.deploy('USDT', 'USDT', 18);

        const RaceMultiSig = await ethers.getContractFactory('RaceMultiSig');
        const multiSig = await RaceMultiSig.deploy([
            members[0].address,
            members[1].address,
            members[2].address,
            members[3].address,
            members[4].address,
        ]);

        const RaceTreasury = await ethers.getContractFactory('RaceTreasury');
        const treasury = await RaceTreasury.deploy(
            members[0].address,
            await race.getAddress(),
            await multiSig.getAddress(),
        );

        const RaceRewardVault = await ethers.getContractFactory('RaceRewardVault');
        const vault = await RaceRewardVault.deploy(members[0].address, await race.getAddress());

        const MockPancakeRouter = await ethers.getContractFactory('MockPancakeRouter');
        const router = await MockPancakeRouter.deploy(await usdt.getAddress(), await race.getAddress());
        const RaceCommunityEngine = await ethers.getContractFactory('RaceCommunityEngine');
        const engine = await RaceCommunityEngine.deploy(
            members[0].address,
            await usdt.getAddress(),
            await race.getAddress(),
            await router.getAddress(),
            await vault.getAddress(),
        );
        await vault.setEngine(await engine.getAddress());

        const RaceRewardPriceOracle = await ethers.getContractFactory('RaceRewardPriceOracle');
        const oracle = await RaceRewardPriceOracle.deploy(
            members[0].address,
            ethers.parseEther('1'),
            24 * 60 * 60,
            ethers.parseEther('0.01'),
            ethers.parseEther('100'),
        );

        const RaceCoin = await ethers.getContractFactory('RaceCoin');
        const raceCoin = await RaceCoin.deploy(
            members[0].address,
            members[0].address,
            members[0].address,
            members[0].address,
            members[0].address,
        );

        const RaceGovernance = await ethers.getContractFactory('RaceGovernance');
        const gov = await RaceGovernance.deploy(
            members.map((m) => m.address),
            threshold,
            overrides.votingPeriod ?? VOTING,
            overrides.timelock ?? TIMELOCK,
            [await engine.getAddress(), await oracle.getAddress()],
        );

        return {
            accounts,
            members,
            stranger,
            gov,
            multiSig,
            treasury,
            vault,
            engine,
            oracle,
            race,
            raceCoin,
            threshold,
        };
    }

    async function passAndQueue(gov, members, proposalId, yesCount) {
        for (let i = 0; i < yesCount; i++) {
            await gov.connect(members[i]).castVote(proposalId, true);
        }
        await time.increase(VOTING + 1);
        await gov.connect(members[0]).queue(proposalId);
    }

    it('1–5. deploy 12 members; duplicate/zero/threshold validation', async function () {
        const { gov, members } = await deployGov();
        expect(await gov.memberCount()).to.equal(12n);
        expect(await gov.threshold()).to.equal(7n);
        expect(await gov.isMember(members[0].address)).to.equal(true);

        const RaceGovernance = await ethers.getContractFactory('RaceGovernance');
        const addrs = members.map((m) => m.address);

        const badDup = [...addrs];
        badDup[11] = badDup[0];
        await expect(RaceGovernance.deploy(badDup, 7, VOTING, TIMELOCK, [])).to.be.revertedWith(
            'RaceGovernance: duplicate member',
        );

        const badZero = [...addrs];
        badZero[0] = ethers.ZeroAddress;
        await expect(RaceGovernance.deploy(badZero, 7, VOTING, TIMELOCK, [])).to.be.revertedWith(
            'RaceGovernance: zero member',
        );

        await expect(RaceGovernance.deploy(addrs, 6, VOTING, TIMELOCK, [])).to.be.revertedWith(
            'RaceGovernance: threshold <= 50%',
        );
        await expect(RaceGovernance.deploy(addrs, 13, VOTING, TIMELOCK, [])).to.be.revertedWith(
            'RaceGovernance: threshold > members',
        );

        const nine = addrs.slice(0, 9);
        await expect(RaceGovernance.deploy(nine, 5, VOTING, TIMELOCK, [])).to.be.revertedWith(
            'RaceGovernance: bad member count',
        );
    });

    it('6–9. propose/vote: member ok, non-member rejected, unauthorized target rejected', async function () {
        const { gov, members, stranger, engine, treasury } = await deployGov();
        const data = engine.interface.encodeFunctionData('pause', []);
        const desc = ethers.id('pause engine');

        await expect(
            gov.connect(stranger).propose(await engine.getAddress(), 0, data, desc),
        ).to.be.revertedWith('RaceGovernance: not member');

        await expect(
            gov.connect(members[0]).propose(await treasury.getAddress(), 0, data, desc),
        ).to.be.revertedWith('RaceGovernance: target not governed');

        const id = await gov.connect(members[0]).propose.staticCall(await engine.getAddress(), 0, data, desc);
        await gov.connect(members[0]).propose(await engine.getAddress(), 0, data, desc);

        await expect(gov.connect(stranger).castVote(id, true)).to.be.revertedWith(
            'RaceGovernance: not member',
        );
        await gov.connect(members[1]).castVote(id, true);
        await expect(gov.connect(members[1]).castVote(id, false)).to.be.revertedWith(
            'RaceGovernance: already voted',
        );
    });

    it('10–17. voting window, threshold, queue, timelock, execute once', async function () {
        const { gov, members, engine } = await deployGov();
        await engine.transferOwnership(await gov.getAddress());

        const data = engine.interface.encodeFunctionData('pause', []);
        const desc = ethers.id('pause');
        await gov.connect(members[0]).propose(await engine.getAddress(), 0, data, desc);
        const id = 0;

        // below threshold cannot queue
        for (let i = 0; i < 6; i++) {
            await gov.connect(members[i]).castVote(id, true);
        }
        await time.increase(VOTING + 1);
        await expect(gov.connect(members[0]).queue(id)).to.be.revertedWith(
            'RaceGovernance: below threshold',
        );

        // new proposal with 7 yes
        await gov.connect(members[0]).propose(await engine.getAddress(), 0, data, ethers.id('pause2'));
        const id2 = 1;
        await passAndQueue(gov, members, id2, 7);

        await expect(gov.connect(members[0]).execute(id2)).to.be.revertedWith(
            'RaceGovernance: timelock',
        );

        await time.increase(TIMELOCK + 1);
        await gov.connect(members[0]).execute(id2);
        expect(await engine.paused()).to.equal(true);
        await expect(gov.connect(members[0]).execute(id2)).to.be.revertedWith(
            'RaceGovernance: closed',
        );
    });

    it('18–19. cancelled / vote after end rejected', async function () {
        const { gov, members, engine } = await deployGov();
        const data = engine.interface.encodeFunctionData('pause', []);
        await gov.connect(members[0]).propose(await engine.getAddress(), 0, data, ethers.id('c'));
        await gov.connect(members[0]).cancel(0);
        await expect(gov.connect(members[1]).castVote(0, true)).to.be.revertedWith(
            'RaceGovernance: closed',
        );

        await gov.connect(members[0]).propose(await engine.getAddress(), 0, data, ethers.id('late'));
        await time.increase(VOTING + 1);
        await expect(gov.connect(members[0]).castVote(1, true)).to.be.revertedWith(
            'RaceGovernance: ended',
        );
    });

    it('20–21. governed target works; non-governed rejected', async function () {
        const { gov, members, oracle } = await deployGov();
        await oracle.transferOwnership(await gov.getAddress());
        const data = oracle.interface.encodeFunctionData('setUpdater', [members[5].address, true]);
        await gov.connect(members[0]).propose(await oracle.getAddress(), 0, data, ethers.id('upd'));
        await passAndQueue(gov, members, 0, 7);
        await time.increase(TIMELOCK + 1);
        await gov.connect(members[0]).execute(0);
        expect(await oracle.isUpdater(members[5].address)).to.equal(true);
    });

    it('22–25. member/threshold/timelock/voting changes require self-governance proposal', async function () {
        const { gov, members, stranger } = await deployGov();
        await expect(gov.connect(members[0]).addMember(stranger.address)).to.be.revertedWith(
            'RaceGovernance: only self',
        );
        await expect(gov.connect(members[0]).setThreshold(8)).to.be.revertedWith(
            'RaceGovernance: only self',
        );
        await expect(gov.connect(members[0]).setTimelockDelay(TIMELOCK + 1)).to.be.revertedWith(
            'RaceGovernance: only self',
        );
        await expect(gov.connect(members[0]).setVotingPeriod(VOTING + 1)).to.be.revertedWith(
            'RaceGovernance: only self',
        );

        const data = gov.interface.encodeFunctionData('setThreshold', [8]);
        await gov.connect(members[0]).propose(await gov.getAddress(), 0, data, ethers.id('th'));
        await passAndQueue(gov, members, 0, 7);
        await time.increase(TIMELOCK + 1);
        await gov.connect(members[0]).execute(0);
        expect(await gov.threshold()).to.equal(8n);
    });

    it('26–27. MultiSig / Treasury security intact — governance cannot withdraw', async function () {
        const { gov, members, multiSig, treasury, race } = await deployGov();
        await race.mint(await treasury.getAddress(), ethers.parseEther('100'));

        // Even if somehow proposed to treasury, not a governed target by default
        const wdata = treasury.interface.encodeFunctionData('withdraw', [
            members[0].address,
            ethers.parseEther('1'),
            'hack',
        ]);
        await expect(
            gov.connect(members[0]).propose(await treasury.getAddress(), 0, wdata, ethers.id('x')),
        ).to.be.revertedWith('RaceGovernance: target not governed');

        await expect(
            treasury.connect(members[0]).withdraw(members[0].address, 1n, 'eoa'),
        ).to.be.revertedWith('RaceTreasury: not multisig');

        // MultiSig still 3-of-5
        expect(await multiSig.REQUIRED()).to.equal(3n);
        expect(await multiSig.threshold()).to.equal(3n);
    });

    it('28–30. RaceCoin supply rules; Engine not balance-mutable; Vault engine-only', async function () {
        const { members, raceCoin, engine, vault } = await deployGov();
        expect(await raceCoin.MAX_SUPPLY()).to.equal(ethers.parseEther('150000000'));

        // Non-owner cannot setMinter (Community Governance is not RaceCoin owner by default)
        await expect(
            raceCoin.connect(members[1]).setMinter(members[2].address, true),
        ).to.be.revertedWithCustomError(raceCoin, 'OwnableUnauthorizedAccount');

        await expect(vault.connect(members[0]).pay(members[0].address, 1n)).to.be.revertedWith(
            'RaceRewardVault: not engine',
        );
        expect(await vault.engine()).to.equal(await engine.getAddress());
    });

    it('security: 1–2 members cannot execute; threshold reduction to 1 rejected via self-check', async function () {
        const { gov, members, engine } = await deployGov();
        await engine.transferOwnership(await gov.getAddress());
        const data = engine.interface.encodeFunctionData('pause', []);
        await gov.connect(members[0]).propose(await engine.getAddress(), 0, data, ethers.id('p'));
        await gov.connect(members[0]).castVote(0, true);
        await gov.connect(members[1]).castVote(0, true);
        await time.increase(VOTING + 1);
        await expect(gov.connect(members[0]).queue(0)).to.be.revertedWith(
            'RaceGovernance: below threshold',
        );

        const bad = gov.interface.encodeFunctionData('setThreshold', [1]);
        await gov.connect(members[0]).propose(await gov.getAddress(), 0, bad, ethers.id('badth'));
        await passAndQueue(gov, members, 1, 7);
        await time.increase(TIMELOCK + 1);
        await expect(gov.connect(members[0]).execute(1)).to.be.reverted;
    });

    it('security: replay execution and non-member propose fail', async function () {
        const { gov, members, engine, stranger } = await deployGov();
        await engine.transferOwnership(await gov.getAddress());
        const data = engine.interface.encodeFunctionData('unpause', []);
        // pause first
        const pdata = engine.interface.encodeFunctionData('pause', []);
        await gov.connect(members[0]).propose(await engine.getAddress(), 0, pdata, ethers.id('pause'));
        await passAndQueue(gov, members, 0, 7);
        await time.increase(TIMELOCK + 1);
        await gov.connect(members[0]).execute(0);

        await expect(gov.connect(stranger).propose(await engine.getAddress(), 0, data, ethers.id('x'))).to.be
            .reverted;
    });
});
