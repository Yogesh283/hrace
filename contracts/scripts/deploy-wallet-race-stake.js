/**
 * Deploy RaceWalletRaceStake (no proxy) — BSC mainnet / testnet.
 *
 *   npx hardhat run scripts/deploy-wallet-race-stake.js --network bsc
 *
 * Flow: deploy (deployer owner) → setMaturityTreasury + setIcoContract → transferOwnership(Multisig)
 * After: Multisig vault.setPayer(stake, true) → setClaimEnabled(true)
 */
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
    const { ethers, network } = hre;
    const [deployer] = await ethers.getSigners();

    const multisig = (process.env.RACE_MULTISIG_CONTRACT || process.env.MULTISIG || '').trim();
    const usdt = (
        process.env.USDT_CONTRACT ||
        process.env.USDT_CONTRACT_BEP20 ||
        process.env.USDT ||
        ''
    ).trim();
    const race = (process.env.RACE_TOKEN_CONTRACT || process.env.RACE_TOKEN || '').trim();
    const router = (process.env.PANCAKE_ROUTER || '').trim();
    const vault = (process.env.RACE_REWARD_VAULT_CONTRACT || process.env.REWARD_VAULT || '').trim();
    const treasury = (process.env.RACE_TREASURY_CONTRACT || '').trim();
    const ico = (process.env.RACE_ICO_CONTRACT || '').trim();

    if (![multisig, usdt, race, router, vault].every((a) => /^0x[a-fA-F0-9]{40}$/.test(a))) {
        throw new Error(
            'Set RACE_MULTISIG_CONTRACT, USDT_CONTRACT_BEP20, RACE_TOKEN_CONTRACT, PANCAKE_ROUTER, RACE_REWARD_VAULT_CONTRACT',
        );
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(treasury)) {
        throw new Error('Set RACE_TREASURY_CONTRACT (maturity 10% fee destination)');
    }

    console.log('network', network.name, network.config.chainId);
    console.log('deployer', deployer.address);
    console.log('owner→Multisig', multisig);
    console.log('usdt', usdt);
    console.log('race', race);
    console.log('router', router);
    console.log('vault', vault);
    console.log('treasury', treasury);
    if (ico) console.log('ico', ico);

    const Factory = await ethers.getContractFactory('RaceWalletRaceStake');
    const stake = await Factory.deploy(deployer.address, usdt, race, router, vault);
    await stake.waitForDeployment();
    const addr = await stake.getAddress();
    console.log('\nRaceWalletRaceStake', addr);

    let tx = await stake.setMaturityTreasury(treasury);
    await tx.wait();
    console.log('setMaturityTreasury OK');

    if (/^0x[a-fA-F0-9]{40}$/.test(ico)) {
        tx = await stake.setIcoContract(ico);
        await tx.wait();
        console.log('setIcoContract OK');
    }

    // claimEnabled stays false until Multisig enables after vault.setPayer
    tx = await stake.transferOwnership(multisig);
    await tx.wait();
    console.log('transferOwnership → Multisig OK');
    console.log('owner', await stake.owner());

    const outDir = path.join(__dirname, '..', 'deployments', network.name === 'bsc' ? 'mainnet' : network.name);
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'RaceWalletRaceStake.json');
    const payload = {
        network: network.name,
        chainId: network.config.chainId,
        address: addr,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        owner: multisig,
        usdt,
        raceToken: race,
        pancakeRouter: router,
        rewardVault: vault,
        maturityTreasury: treasury,
        icoContract: ico || null,
        claimEnabled: false,
    };
    fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
    console.log('wrote', outFile);

    console.log(`\nRACE_WALLET_STAKE_CONTRACT=${addr}`);
    console.log('\nNext (Multisig 3-of-5):');
    console.log('  1) RaceRewardVault.setPayer(' + addr + ', true)');
    console.log('  2) RaceWalletRaceStake.setClaimEnabled(true)');
    console.log('  3) optional: lockMaturityTreasury / lockIcoContract');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
