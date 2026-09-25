/**
 * C-1 Testnet: deploy NEW RaceCommunityEngine + MultiSig relink (vault + ICO).
 * Does NOT redeploy RaceCoin. Preserves old engine stakes (read-only check).
 *
 *   CONFIRM_ENGINE_REDEPLOY=YES DEPLOY_ENV=testnet CONFIRM_TESTNET_DEPLOYMENT=YES \
 *   npx hardhat run scripts/redeploy-engine-c1-testnet.js --network bscTestnet
 */
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const {
    loadContractsEnv,
    envFirst,
    looksLikePlaceholderKey,
} = require('./lib/loadContractsEnv');
const { detectMultisigPrivateKeys, deriveAddressesFromPrivateKeys } = require('./lib/deriveMultisigSigners');

const OUT_FILE = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'deployment.json');
const LEGACY_ENGINE = '0x04a510c5A8B8204C234c0582FBC0ac8e171c7d77';

async function send(label, txPromise, log) {
    console.log('ACTION:', label);
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            const tx = await txPromise;
            const receipt = await tx.wait();
            const row = {
                action: label,
                txHash: receipt.hash,
                status: receipt.status === 1 ? 'SUCCESS' : 'FAIL',
                block: receipt.blockNumber,
            };
            log.push(row);
            console.log('TX:', row.txHash, row.status, 'block', row.block);
            if (row.status !== 'SUCCESS') throw new Error(`${label} failed`);
            return receipt;
        } catch (e) {
            lastErr = e;
            const msg = e.message || String(e);
            if (!/timeout|TIMEOUT|ECONNRESET|Connect Timeout|network/i.test(msg) || attempt === 3) {
                throw e;
            }
            console.warn(`RETRY ${label} (${attempt + 1}/4):`, msg.slice(0, 80));
            await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
            if (typeof txPromise === 'function') {
                txPromise = txPromise();
            }
        }
    }
    throw lastErr;
}

async function sendFn(label, fn, log) {
    console.log('ACTION:', label);
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            const tx = await fn();
            const receipt = await tx.wait();
            const row = {
                action: label,
                txHash: receipt.hash,
                status: receipt.status === 1 ? 'SUCCESS' : 'FAIL',
                block: receipt.blockNumber,
            };
            log.push(row);
            console.log('TX:', row.txHash, row.status, 'block', row.block);
            if (row.status !== 'SUCCESS') throw new Error(`${label} failed`);
            return receipt;
        } catch (e) {
            lastErr = e;
            const msg = e.message || String(e);
            if (!/timeout|TIMEOUT|ECONNRESET|Connect Timeout|network|nonce/i.test(msg) || attempt === 3) {
                throw e;
            }
            console.warn(`RETRY ${label} (${attempt + 1}/4):`, msg.slice(0, 80));
            await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        }
    }
    throw lastErr;
}

async function executeMultisig(multiSig, signerWallets, to, value, data, label, log) {
    const countBefore = await multiSig.transactionCount();
    for (let id = countBefore - 1n; id >= 0n && id >= countBefore - 10n; id--) {
        const t = await multiSig.getTransaction(id);
        if (
            !t.executed &&
            t.to.toLowerCase() === to.toLowerCase() &&
            t.data.toLowerCase() === data.toLowerCase()
        ) {
            console.log('RESUME multisig txId', id.toString(), 'conf', t.confirmations.toString());
            for (let i = 0; i < signerWallets.length; i++) {
                const fresh = await multiSig.getTransaction(id);
                if (fresh.executed) return;
                const already = await multiSig.isConfirmed(id, signerWallets[i].address);
                if (already) continue;
                await sendFn(
                    `${label} confirm ${i + 1}`,
                    () => multiSig.connect(signerWallets[i]).confirmTransaction(id),
                    log,
                );
                const after = await multiSig.getTransaction(id);
                if (after.executed) return;
            }
            const pending = await multiSig.getTransaction(id);
            if (pending.executed) return;
            if (pending.confirmations >= 3n) {
                await sendFn(
                    `${label} execute`,
                    () => multiSig.connect(signerWallets[0]).executeTransaction(id),
                    log,
                );
            }
            const done = await multiSig.getTransaction(id);
            if (!done.executed) throw new Error(`${label} resume not executed`);
            return;
        }
    }

    await sendFn(
        `${label} submit`,
        () => multiSig.connect(signerWallets[0]).submitTransaction(to, value, data),
        log,
    );
    const txId = (await multiSig.transactionCount()) - 1n;
    for (let i = 0; i < signerWallets.length; i++) {
        const t = await multiSig.getTransaction(txId);
        if (t.executed) break;
        const already = await multiSig.isConfirmed(txId, signerWallets[i].address);
        if (already) continue;
        await sendFn(
            `${label} confirm ${i + 1}`,
            () => multiSig.connect(signerWallets[i]).confirmTransaction(txId),
            log,
        );
    }
    const done = await multiSig.getTransaction(txId);
    if (!done.executed) throw new Error(`${label} not executed after 3 confirms`);
}

async function main() {
    loadContractsEnv();
    const net = await hre.ethers.provider.getNetwork();
    const chainId = Number(net.chainId);
    if (chainId === 56) throw new Error('STOP: Mainnet forbidden');
    if (chainId !== 97) throw new Error(`STOP: chainId must be 97 (got ${chainId})`);
    if (envFirst('DEPLOY_ENV') !== 'testnet') throw new Error('STOP: DEPLOY_ENV=testnet required');
    if (envFirst('CONFIRM_TESTNET_DEPLOYMENT') !== 'YES') {
        throw new Error('STOP: CONFIRM_TESTNET_DEPLOYMENT=YES required');
    }
    if (envFirst('CONFIRM_ENGINE_REDEPLOY') !== 'YES') {
        throw new Error('STOP: CONFIRM_ENGINE_REDEPLOY=YES required');
    }
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        throw new Error('STOP: DEPLOYER_PRIVATE_KEY missing');
    }

    if (!fs.existsSync(OUT_FILE)) throw new Error('STOP: deployment.json missing');

    const manifest = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
    const [deployer] = await hre.ethers.getSigners();
    console.log('DEPLOYER:', deployer.address);
    console.log('LEGACY ENGINE (unchanged):', LEGACY_ENGINE);

    const detected = detectMultisigPrivateKeys();
    const derived = deriveAddressesFromPrivateKeys(detected.keys);
    if (derived.errors.length || derived.addresses.length !== 5) {
        throw new Error('STOP: Multisig private keys unavailable for 3-of-5 execution');
    }
    const provider = hre.ethers.provider;
    const signerWallets = detected.keys.map((pk) => new ethers.Wallet(pk, provider));

    const oldEngine = await hre.ethers.getContractAt('RaceCommunityEngine', LEGACY_ENGINE, deployer);
    const probeWallet = manifest.deployer || deployer.address;
    const oldStakeCount = await oldEngine.stakeCount(probeWallet);
    console.log('OLD engine stakeCount(probe):', oldStakeCount.toString());

    const vault = await hre.ethers.getContractAt('RaceRewardVault', manifest.raceRewardVault, deployer);
    const ico = await hre.ethers.getContractAt('RaceICO', manifest.raceICO, deployer);
    const multiSig = await hre.ethers.getContractAt('RaceMultiSig', manifest.raceMultiSig, deployer);

    const ms = manifest.raceMultiSig.toLowerCase();
    if ((await vault.owner()).toLowerCase() !== ms) throw new Error('ASSERT FAIL: vault.owner != MultiSig');
    if ((await ico.owner()).toLowerCase() !== ms) throw new Error('ASSERT FAIL: ico.owner != MultiSig');

    const cTxs = [];

    const resumeAddr = envFirst('C1_RESUME_NEW_ENGINE');
    let newEngine;
    let newEngineAddress;
    if (resumeAddr) {
        newEngineAddress = hre.ethers.getAddress(resumeAddr);
        newEngine = await hre.ethers.getContractAt('RaceCommunityEngine', newEngineAddress, deployer);
        console.log('RESUME existing NEW engine:', newEngineAddress);
    } else {
        const RaceCommunityEngine = await hre.ethers.getContractFactory('RaceCommunityEngine');
        newEngine = await RaceCommunityEngine.deploy(
            deployer.address,
            manifest.usdt,
            manifest.raceCoin,
            manifest.pancakeRouter,
            manifest.raceRewardVault,
        );
        await newEngine.waitForDeployment();
        newEngineAddress = await newEngine.getAddress();
        console.log('NEW RaceCommunityEngine:', newEngineAddress);

        await send('newEngine.setIcoContract', newEngine.setIcoContract(manifest.raceICO), cTxs);
        await send(
            'newEngine.setRewardPriceOracle',
            newEngine.setRewardPriceOracle(manifest.raceRewardPriceOracle),
            cTxs,
        );
        await send('newEngine.setMaturityTreasury', newEngine.setMaturityTreasury(manifest.raceTreasury), cTxs);
        await send('newEngine.lockMaturityTreasury', newEngine.lockMaturityTreasury(), cTxs);
    }

    const vaultEngine = (await vault.engine()).toLowerCase();
    const icoEngine = (await ico.stakingEngine()).toLowerCase();
    const newLower = newEngineAddress.toLowerCase();
    const vaultIface = vault.interface;
    const icoIface = ico.interface;
    const engineIface = newEngine.interface;

    if (vaultEngine !== newLower) {
        await executeMultisig(
            multiSig,
            signerWallets,
            manifest.raceRewardVault,
            0,
            vaultIface.encodeFunctionData('setEngine', [newEngineAddress]),
            'vault.setEngine(new)',
            cTxs,
        );
    } else {
        console.log('SKIP vault.setEngine — already linked');
    }
    if (icoEngine !== newLower) {
        await executeMultisig(
            multiSig,
            signerWallets,
            manifest.raceICO,
            0,
            icoIface.encodeFunctionData('setStakingEngine', [newEngineAddress]),
            'ico.setStakingEngine(new)',
            cTxs,
        );
    } else {
        console.log('SKIP ico.setStakingEngine — already linked');
    }
    const newOwner = (await newEngine.owner()).toLowerCase();
    if (newOwner !== ms) {
        if (newOwner === deployer.address.toLowerCase()) {
            await send(
                'newEngine.transferOwnership(MultiSig) direct from deployer',
                newEngine.transferOwnership(manifest.raceMultiSig),
                cTxs,
            );
        } else {
            await executeMultisig(
                multiSig,
                signerWallets,
                newEngineAddress,
                0,
                engineIface.encodeFunctionData('transferOwnership', [manifest.raceMultiSig]),
                'newEngine.transferOwnership(MultiSig)',
                cTxs,
            );
        }
    } else {
        console.log('SKIP transferOwnership — already MultiSig');
    }

    const claimEnabled = await newEngine.claimEnabled();
    console.log('claimEnabled:', claimEnabled);
    const canClaim = await newEngine.canClaimRewards(probeWallet);
    console.log('canClaimRewards(probe):', canClaim);
    const lastClaim = await newEngine.lastSuccessfulClaimAt(probeWallet);
    console.log('lastSuccessfulClaimAt(probe):', lastClaim.toString());

    if ((await vault.engine()).toLowerCase() !== newEngineAddress.toLowerCase()) {
        throw new Error('ASSERT FAIL: vault.engine != newEngine');
    }
    if ((await ico.stakingEngine()).toLowerCase() !== newEngineAddress.toLowerCase()) {
        throw new Error('ASSERT FAIL: ico.stakingEngine != newEngine');
    }
    if ((await newEngine.owner()).toLowerCase() !== ms) {
        throw new Error('ASSERT FAIL: newEngine.owner != MultiSig');
    }
    if ((await newEngine.rewardPriceOracle()).toLowerCase() !== manifest.raceRewardPriceOracle.toLowerCase()) {
        throw new Error('ASSERT FAIL: engine oracle link');
    }
    if ((await newEngine.icoContract()).toLowerCase() !== manifest.raceICO.toLowerCase()) {
        throw new Error('ASSERT FAIL: engine ico link');
    }

    const oldStakeAfter = await oldEngine.stakeCount(probeWallet);
    if (oldStakeAfter !== oldStakeCount) {
        throw new Error('ASSERT FAIL: old engine stakeCount changed');
    }
    console.log('PASS: old engine stakes untouched');

    const adminWallet = await ico.adminWallet();
    console.log('ICO adminWallet preserved:', adminWallet);

    const updated = {
        ...manifest,
        raceCommunityEngine: newEngineAddress,
        raceCommunityEngineDeprecated: LEGACY_ENGINE,
        chainId: 97,
        network: 'bscTestnet',
        c1EngineRedeployAt: new Date().toISOString(),
        c1EngineRedeployBlock: await provider.getBlockNumber(),
        linkages: {
            vaultEngine: await vault.engine(),
            icoStakingEngine: await ico.stakingEngine(),
            engineOracle: await newEngine.rewardPriceOracle(),
            raceCoinMinterIco: true,
            raceCoinMinterVault: true,
        },
        postDeployTxs: [...(manifest.postDeployTxs || []), ...cTxs],
        note: 'C-1 engine redeploy — claim policy bytecode live. Legacy engine deprecated. TESTNET ONLY.',
    };
    fs.writeFileSync(OUT_FILE, JSON.stringify(updated, null, 2));
    console.log('Updated', OUT_FILE);
    console.log('C-1 DEPLOY: PASS');
}

main().catch((e) => {
    console.error('C-1 DEPLOY: FAIL', e.message || e);
    process.exitCode = 1;
});
