/**
 * Testnet: deploy NEW RaceICO (buy→hold→createStake at ICO-end price).
 * Keeps existing RaceCoin + RaceCommunityEngine. Relinks via MultiSig.
 *
 *   CONFIRM_ICO_HOLD_REDEPLOY=YES DEPLOY_ENV=testnet CONFIRM_TESTNET_DEPLOYMENT=YES \
 *   npx hardhat run scripts/redeploy-ico-hold-testnet.js --network bscTestnet
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
            console.log('RESUME multisig txId', id.toString());
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
                if ((await multiSig.getTransaction(id)).executed) return;
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
            if (!(await multiSig.getTransaction(id)).executed) {
                throw new Error(`${label} resume not executed`);
            }
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
    if (!(await multiSig.getTransaction(txId)).executed) {
        throw new Error(`${label} not executed after confirms`);
    }
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
    if (envFirst('CONFIRM_ICO_HOLD_REDEPLOY') !== 'YES') {
        throw new Error('STOP: CONFIRM_ICO_HOLD_REDEPLOY=YES required');
    }
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        throw new Error('STOP: DEPLOYER_PRIVATE_KEY missing');
    }
    if (!fs.existsSync(OUT_FILE)) throw new Error('STOP: deployment.json missing');

    const manifest = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
    const [deployer] = await hre.ethers.getSigners();
    console.log('DEPLOYER:', deployer.address);
    console.log('OLD RaceICO:', manifest.raceICO);
    console.log('Engine (keep):', manifest.raceCommunityEngine);

    const detected = detectMultisigPrivateKeys();
    const derived = deriveAddressesFromPrivateKeys(detected.keys);
    if (derived.errors.length || derived.addresses.length !== 5) {
        throw new Error('STOP: Multisig private keys unavailable for 3-of-5 execution');
    }
    const signerWallets = detected.keys.map((pk) => new ethers.Wallet(pk, hre.ethers.provider));
    const multiSig = await hre.ethers.getContractAt('RaceMultiSig', manifest.raceMultiSig, deployer);
    const race = await hre.ethers.getContractAt('RaceCoin', manifest.raceCoin, deployer);
    const engine = await hre.ethers.getContractAt(
        'RaceCommunityEngine',
        manifest.raceCommunityEngine,
        deployer,
    );

    const adminWallet =
        envFirst('ICO_ADMIN_WALLET') ||
        manifest.icoAdminWallet ||
        manifest.deployer ||
        deployer.address;

    const log = [];
    const resumeAddr = envFirst('RESUME_NEW_ICO');
    let newIco;
    let newIcoAddress;

    if (resumeAddr) {
        newIcoAddress = hre.ethers.getAddress(resumeAddr);
        newIco = await hre.ethers.getContractAt('RaceICO', newIcoAddress, deployer);
        console.log('RESUME existing NEW ICO:', newIcoAddress);
    } else {
        const RaceICO = await hre.ethers.getContractFactory('RaceICO');
        newIco = await RaceICO.deploy(
            deployer.address,
            manifest.raceCoin,
            manifest.usdt,
            adminWallet,
        );
        await newIco.waitForDeployment();
        newIcoAddress = await newIco.getAddress();
        log.push({ action: 'deploy RaceICO (hold→stake)', address: newIcoAddress });
        console.log('NEW RaceICO:', newIcoAddress);
    }

    if ((await newIco.stakingEngine()) === ethers.ZeroAddress) {
        await sendFn(
            'ico.setStakingEngine',
            () => newIco.setStakingEngine(manifest.raceCommunityEngine),
            log,
        );
    }

    const raceIface = race.interface;
    const engineIface = engine.interface;
    const icoIface = newIco.interface;

    // Enable minter on new ICO
    if (!(await race.isMinter(newIcoAddress))) {
        await executeMultisig(
            multiSig,
            signerWallets,
            manifest.raceCoin,
            0,
            raceIface.encodeFunctionData('setMinter', [newIcoAddress, true]),
            'race.setMinter(newIco,true)',
            log,
        );
    }

    // Point Engine at new ICO
    const currentIco = await engine.icoContract();
    if (currentIco.toLowerCase() !== newIcoAddress.toLowerCase()) {
        await executeMultisig(
            multiSig,
            signerWallets,
            manifest.raceCommunityEngine,
            0,
            engineIface.encodeFunctionData('setIcoContract', [newIcoAddress]),
            'engine.setIcoContract(newIco)',
            log,
        );
    }

    // Start phase 1 if idle
    if (Number(await newIco.currentPhaseId()) === 0 && !(await newIco.icoCompleted())) {
        const p1 = await newIco.getPhase(1);
        if (!p1.started) {
            await sendFn('ico.startPhase(1)', () => newIco.startPhase(1), log);
        }
    }

    // Transfer ICO ownership to MultiSig
    if ((await newIco.owner()).toLowerCase() === deployer.address.toLowerCase()) {
        await sendFn(
            'ico.transferOwnership(MultiSig)',
            () => newIco.transferOwnership(manifest.raceMultiSig),
            log,
        );
    }

    const updated = {
        ...manifest,
        raceICO: newIcoAddress,
        previousRaceICO: manifest.raceICO,
        icoHoldRedeployAt: new Date().toISOString(),
        icoHoldRedeployTxs: log,
        icoAdminWallet: adminWallet,
    };
    fs.writeFileSync(OUT_FILE, JSON.stringify(updated, null, 2));
    console.log('Updated', OUT_FILE);
    console.log('NEXT: set RACE_ICO_CONTRACT=' + newIcoAddress + ' in Laravel .env and rebuild UI.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
