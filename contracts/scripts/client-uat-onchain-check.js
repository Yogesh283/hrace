/**
 * Read-only on-chain reconciliation for client UAT (chain 97).
 * Uses deployment.json — no redeploy, no transactions.
 */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const MANIFEST = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'deployment.json');
const RPC = process.env.BSC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545';
const KNOWN_ICO_TX = '0xd6a8025c1bafcf5e627c5d632e5cf8376f834a15c15778de2da3a1e2ea4cf9f8';
const TEST_WALLET = '0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984';

async function main() {
    const d = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const provider = new ethers.JsonRpcProvider(RPC, 97);
    const chainId = (await provider.getNetwork()).chainId;
    const ico = new ethers.Contract(
        d.raceICO,
        [
            'function getCurrentPhase() view returns (uint256)',
            'function totalICOSold() view returns (uint256)',
            'function icoCompleted() view returns (bool)',
        ],
        provider,
    );
    const usdt = new ethers.Contract(
        d.usdt,
        ['function symbol() view returns (string)', 'function balanceOf(address) view returns (uint256)'],
        provider,
    );
    const engine = new ethers.Contract(
        d.raceCommunityEngine,
        [
            'function stakeCount(address) view returns (uint256)',
            'function stakeAt(address user, uint256 index) view returns (tuple(uint256 principalUsdt, uint256 stakedRace, uint256 lockPeriod, uint256 startedAt, uint256 unlockAt, uint256 lastRewardAt, uint256 dailyRateBps, bool withdrawn))',
        ],
        provider,
    );

    const receipt = await provider.getTransactionReceipt(KNOWN_ICO_TX);
    const stakeCount = await engine.stakeCount(TEST_WALLET);
    const stake = stakeCount > 0n ? await engine.stakeAt(TEST_WALLET, 0n) : null;

    const out = {
        chainId: Number(chainId),
        rpc: RPC.replace(/\/\/.*@/, '//***@'),
        contracts: {
            raceICO: d.raceICO,
            raceCommunityEngine: d.raceCommunityEngine,
            usdt: d.usdt,
            raceCoin: d.raceCoin,
        },
        testWallet: TEST_WALLET,
        knownIcoPurchaseTx: KNOWN_ICO_TX,
        txReceipt: receipt
            ? { status: receipt.status, block: receipt.blockNumber, to: receipt.to }
            : null,
        usdt: {
            symbol: await usdt.symbol(),
            balance: ethers.formatEther(await usdt.balanceOf(TEST_WALLET)),
        },
        ico: {
            currentPhase: (await ico.getCurrentPhase()).toString(),
            totalSold: ethers.formatEther(await ico.totalICOSold()),
            completed: await ico.icoCompleted(),
        },
        engineStake: stake
            ? {
                  principalUsdt: stake.principalUsdt.toString(),
                  stakedRace: stake.stakedRace.toString(),
                  lockPeriod: stake.lockPeriod.toString(),
                  dailyRateBps: stake.dailyRateBps.toString(),
              }
            : null,
        stakeCount: stakeCount.toString(),
    };

    console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
});
