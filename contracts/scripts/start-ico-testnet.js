/**
 * Start RaceICO Phase 1 on BSC Testnet only.
 *
 *   npx hardhat run scripts/start-ico-testnet.js --network bscTestnet
 *
 * If RaceICO.owner is an EOA (deployer), calls startPhase(1) directly.
 * If owner is RaceMultiSig, submits + 3 confirms.
 */
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const {
    loadContractsEnv,
    envFirst,
} = require('./lib/loadContractsEnv');
const { detectMultisigPrivateKeys, deriveAddressesFromPrivateKeys } = require('./lib/deriveMultisigSigners');

const MANIFEST = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'deployment.json');

async function sendFn(label, fn) {
    console.log('ACTION:', label);
    const tx = await fn();
    const receipt = await tx.wait();
    console.log('TX:', receipt.hash, receipt.status === 1 ? 'SUCCESS' : 'FAIL', 'block', receipt.blockNumber);
    if (receipt.status !== 1) throw new Error(`${label} failed`);
    return receipt;
}

async function executeMultisig(multiSig, signerWallets, to, value, data, label) {
    const countBefore = await multiSig.transactionCount();
    for (let id = countBefore - 1n; id >= 0n && id >= countBefore - 10n; id--) {
        const t = await multiSig.getTransaction(id);
        if (!t.executed && t.to.toLowerCase() === to.toLowerCase() && t.data.toLowerCase() === data.toLowerCase()) {
            console.log('RESUME multisig txId', id.toString());
            for (let i = 0; i < signerWallets.length; i++) {
                const fresh = await multiSig.getTransaction(id);
                if (fresh.executed) return;
                if (await multiSig.isConfirmed(id, signerWallets[i].address)) continue;
                await sendFn(`${label} confirm ${i + 1}`, () =>
                    multiSig.connect(signerWallets[i]).confirmTransaction(id),
                );
            }
            if (!(await multiSig.getTransaction(id)).executed) {
                throw new Error(`${label} resume not executed`);
            }
            return;
        }
    }

    await sendFn(`${label} submit`, () =>
        multiSig.connect(signerWallets[0]).submitTransaction(to, value, data),
    );
    const txId = (await multiSig.transactionCount()) - 1n;
    for (let i = 0; i < signerWallets.length; i++) {
        const t = await multiSig.getTransaction(txId);
        if (t.executed) break;
        if (await multiSig.isConfirmed(txId, signerWallets[i].address)) continue;
        await sendFn(`${label} confirm ${i + 1}`, () =>
            multiSig.connect(signerWallets[i]).confirmTransaction(txId),
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

    const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
    const icoAddress = envFirst('RACE_ICO_CONTRACT', 'RACE_ICO_ADDRESS') || manifest.raceICO;
    if (!icoAddress) throw new Error('Set RACE_ICO_CONTRACT or use deployments/bscTestnet/deployment.json');

    const [deployer] = await hre.ethers.getSigners();
    const ico = await hre.ethers.getContractAt('RaceICO', icoAddress);
    const owner = await ico.owner();
    const completed = await ico.icoCompleted();
    const phase = Number(await ico.currentPhaseId());
    const reserve = await ico.icoReserve().catch(() => ethers.ZeroAddress);

    console.log('RaceICO:', icoAddress);
    console.log('Owner:', owner);
    console.log('Phase:', phase);
    console.log('Completed:', completed);
    console.log('Reserve:', reserve);
    console.log('Caller:', deployer.address);

    if (completed) {
        console.log('ICO already completed. Nothing to start.');
        return;
    }
    if (phase >= 1) {
        console.log('ICO already started (phase', phase, '). Buy is open.');
        return;
    }

    const data = ico.interface.encodeFunctionData('startPhase', [1]);

    if (owner.toLowerCase() === deployer.address.toLowerCase()) {
        await sendFn('ico.startPhase(1)', () => ico.startPhase(1));
    } else {
        const multiSigAddress = envFirst('RACE_MULTISIG_CONTRACT') || manifest.raceMultiSig;
        if (!multiSigAddress || owner.toLowerCase() !== multiSigAddress.toLowerCase()) {
            throw new Error(`Owner ${owner} is not deployer and not MultiSig ${multiSigAddress || '(unset)'}`);
        }
        const detected = detectMultisigPrivateKeys();
        const derived = deriveAddressesFromPrivateKeys(detected.keys || []);
        if (!detected.keys || derived.addresses.length < 3) {
            throw new Error('Need 3 Multisig signer keys to start ICO (owner is RaceMultiSig).');
        }
        const signerWallets = detected.keys.slice(0, 3).map((pk) => new ethers.Wallet(pk, hre.ethers.provider));
        const multiSig = await hre.ethers.getContractAt('RaceMultiSig', multiSigAddress);
        await executeMultisig(multiSig, signerWallets, icoAddress, 0, data, 'startPhase(1)');
    }

    const next = Number(await ico.currentPhaseId());
    if (next !== 1) throw new Error(`ASSERT FAIL: phase is ${next}, expected 1`);
    console.log('ICO started: Phase 1 is live.');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
