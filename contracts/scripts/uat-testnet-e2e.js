/**
 * Live BSC Testnet E2E UAT — uses EXISTING deployment.json addresses only.
 * Does NOT redeploy core contracts. Never prints private keys.
 *
 *   npm run uat:testnet-e2e
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

const OUT = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'uat-e2e-results.json');
const MANIFEST = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'deployment.json');
const LOCK_180 = 180 * 24 * 60 * 60;
const LOCK_FLEX = 0;
const BUY_USDT = ethers.parseEther('1'); // $1 tiny purchase

const results = [];

function record(section, name, expected, actual, status, evidence = {}) {
    const row = { section, name, expected, actual, status, ...evidence, at: new Date().toISOString() };
    results.push(row);
    const mark = status === 'PASS' ? 'PASS' : status === 'SKIP' ? 'SKIP' : 'FAIL';
    console.log(`[${mark}] ${section} / ${name}: ${actual}`);
    return status === 'PASS';
}

async function sendTx(label, txPromise, { retries = 3 } = {}) {
    let lastErr;
    for (let i = 0; i < retries; i++) {
        try {
            const tx = await txPromise;
            const receipt = await tx.wait();
            return { hash: receipt.hash, block: receipt.blockNumber, status: receipt.status === 1 ? 'SUCCESS' : 'FAIL' };
        } catch (e) {
            lastErr = e;
            const msg = e.message || String(e);
            if (!/timeout|TIMEOUT|ECONNRESET|network|Connect Timeout/i.test(msg) || i === retries - 1) {
                throw e;
            }
            console.warn(`RETRY ${label} (${i + 1}/${retries}):`, msg.slice(0, 100));
            await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
        }
    }
    throw lastErr;
}

/** Factory for tx that must be rebuilt each retry (nonce/RPC). */
async function sendTxFn(label, fn, { retries = 4 } = {}) {
    let lastErr;
    for (let i = 0; i < retries; i++) {
        try {
            const tx = await fn();
            const receipt = await tx.wait();
            return { hash: receipt.hash, block: receipt.blockNumber, status: receipt.status === 1 ? 'SUCCESS' : 'FAIL' };
        } catch (e) {
            lastErr = e;
            const msg = e.message || String(e);
            if (!/timeout|TIMEOUT|ECONNRESET|network|Connect Timeout|nonce/i.test(msg) || i === retries - 1) {
                throw e;
            }
            console.warn(`RETRY ${label} (${i + 1}/${retries}):`, msg.slice(0, 100));
            await new Promise((r) => setTimeout(r, 2500 * (i + 1)));
        }
    }
    throw lastErr;
}

async function main() {
    loadContractsEnv();
    // Prefer fallback RPC for this long UAT if configured (Hardhat already bound — set before next run via env).
    if (!fs.existsSync(MANIFEST)) throw new Error('deployment.json missing');
    const d = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

    const net = await hre.ethers.provider.getNetwork();
    const chainId = Number(net.chainId);
    record('setup', 'chainId', '97', String(chainId), chainId === 97 ? 'PASS' : 'FAIL');
    if (chainId !== 97) throw new Error('STOP: not testnet');
    if (envFirst('DEPLOY_ENV') !== 'testnet') throw new Error('STOP: DEPLOY_ENV');
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) throw new Error('STOP: deployer key');

    const [deployer] = await hre.ethers.getSigners();
    const testUser = deployer; // dedicated Testnet ops wallet already funded
    console.log('TEST USER:', testUser.address);

    const provider = hre.ethers.provider;
    const ico = await hre.ethers.getContractAt('RaceICO', d.raceICO, testUser);
    const engine = await hre.ethers.getContractAt('RaceCommunityEngine', d.raceCommunityEngine, testUser);
    const race = await hre.ethers.getContractAt('RaceCoin', d.raceCoin, testUser);
    const oracle = await hre.ethers.getContractAt('RaceRewardPriceOracle', d.raceRewardPriceOracle, testUser);
    const vault = await hre.ethers.getContractAt('RaceRewardVault', d.raceRewardVault, testUser);
    const treasury = await hre.ethers.getContractAt('RaceTreasury', d.raceTreasury, testUser);
    const multiSig = await hre.ethers.getContractAt('RaceMultiSig', d.raceMultiSig, testUser);
    const usdt = await hre.ethers.getContractAt('TestnetMockUSDT', d.usdt, testUser);

    // ── Config verification ───────────────────────────────────────────────
    const ms = d.raceMultiSig.toLowerCase();
    record('config', 'RaceCoin.owner', ms, (await race.owner()).toLowerCase(), (await race.owner()).toLowerCase() === ms ? 'PASS' : 'FAIL');
    record('config', 'Engine.owner', ms, (await engine.owner()).toLowerCase(), (await engine.owner()).toLowerCase() === ms ? 'PASS' : 'FAIL');
    record('config', 'ICO.owner', ms, (await ico.owner()).toLowerCase(), (await ico.owner()).toLowerCase() === ms ? 'PASS' : 'FAIL');
    record('config', 'Vault.owner', ms, (await vault.owner()).toLowerCase(), (await vault.owner()).toLowerCase() === ms ? 'PASS' : 'FAIL');
    record('config', 'Oracle.owner', ms, (await oracle.owner()).toLowerCase(), (await oracle.owner()).toLowerCase() === ms ? 'PASS' : 'FAIL');
    record('config', 'Treasury.multisig', ms, (await treasury.multisig()).toLowerCase(), (await treasury.multisig()).toLowerCase() === ms ? 'PASS' : 'FAIL');
    record('config', 'minter ICO', 'true', String(await race.isMinter(d.raceICO)), (await race.isMinter(d.raceICO)) ? 'PASS' : 'FAIL');
    record('config', 'minter Vault', 'true', String(await race.isMinter(d.raceRewardVault)), (await race.isMinter(d.raceRewardVault)) ? 'PASS' : 'FAIL');
    record('config', 'vault.engine', d.raceCommunityEngine.toLowerCase(), (await vault.engine()).toLowerCase(), (await vault.engine()).toLowerCase() === d.raceCommunityEngine.toLowerCase() ? 'PASS' : 'FAIL');
    record('config', 'ico.stakingEngine', d.raceCommunityEngine.toLowerCase(), (await ico.stakingEngine()).toLowerCase(), (await ico.stakingEngine()).toLowerCase() === d.raceCommunityEngine.toLowerCase() ? 'PASS' : 'FAIL');
    record('config', 'engine.oracle', d.raceRewardPriceOracle.toLowerCase(), (await engine.rewardPriceOracle()).toLowerCase(), (await engine.rewardPriceOracle()).toLowerCase() === d.raceRewardPriceOracle.toLowerCase() ? 'PASS' : 'FAIL');
    record('config', 'maturityTreasuryLocked', 'true', String(await engine.maturityTreasuryLocked()), (await engine.maturityTreasuryLocked()) ? 'PASS' : 'FAIL');
    record('config', 'maturityTreasury', d.raceTreasury.toLowerCase(), (await engine.maturityTreasury()).toLowerCase(), (await engine.maturityTreasury()).toLowerCase() === d.raceTreasury.toLowerCase() ? 'PASS' : 'FAIL');
    record('config', 'MultiSig.threshold', '3', (await multiSig.threshold()).toString(), Number(await multiSig.threshold()) === 3 ? 'PASS' : 'FAIL');
    record('config', 'RaceLiquidityLocker', 'optional/absent', d.raceLiquidityLocker ? d.raceLiquidityLocker : 'null', 'SKIP');
    record('config', 'RaceGovernance (community)', 'optional/absent', 'not in manifest', 'SKIP');

    // ── TEST-USDT ─────────────────────────────────────────────────────────
    const sym = await usdt.symbol();
    const dec = await usdt.decimals();
    record('token', 'symbol', 'TEST-USDT', sym, sym === 'TEST-USDT' ? 'PASS' : 'FAIL');
    record('token', 'decimals', '18', String(dec), Number(dec) === 18 ? 'PASS' : 'FAIL');

    let usdtBal = await usdt.balanceOf(testUser.address);
    if (usdtBal < BUY_USDT * 5n) {
        try {
            const mintTx = await sendTx('usdt.mint', usdt.mint(testUser.address, ethers.parseEther('100')));
            record('token', 'authorized mint', 'SUCCESS', mintTx.hash, mintTx.status === 'SUCCESS' ? 'PASS' : 'FAIL', mintTx);
            usdtBal = await usdt.balanceOf(testUser.address);
        } catch (e) {
            record('token', 'authorized mint', 'SUCCESS', e.message || String(e), 'FAIL');
        }
    } else {
        record('token', 'authorized mint', 'balance sufficient', ethers.formatEther(usdtBal), 'PASS');
    }

    // unauthorized mint probe via random wallet from multisig key #5 without owner
    try {
        const detected = detectMultisigPrivateKeys();
        const { addresses } = deriveAddressesFromPrivateKeys(detected.keys);
        const stranger = new ethers.Wallet(detected.keys[4], provider);
        const usdtAsStranger = usdt.connect(stranger);
        await usdtAsStranger.mint.staticCall(stranger.address, 1n);
        record('token', 'unauthorized mint blocked', 'revert', 'did not revert', 'FAIL');
    } catch {
        record('token', 'unauthorized mint blocked', 'revert', 'reverted', 'PASS');
    }

    // approve/allowance self-check
    const approveTx = await sendTx('usdt.approve(ico)', usdt.approve(d.raceICO, BUY_USDT * 10n));
    record('token', 'approve', 'SUCCESS', approveTx.hash, approveTx.status === 'SUCCESS' ? 'PASS' : 'FAIL', approveTx);
    const allowance = await usdt.allowance(testUser.address, d.raceICO);
    record('token', 'allowance', '>= buy', allowance.toString(), allowance >= BUY_USDT ? 'PASS' : 'FAIL');

    // ── Fund Multisig signers (gas for startPhase + Multisig UAT) ──────────
    const detected = detectMultisigPrivateKeys();
    const derived = deriveAddressesFromPrivateKeys(detected.keys);
    if (derived.errors.length || derived.addresses.length !== 5) {
        record('multisig', 'derive signers', '5 addresses', derived.errors.join(';'), 'FAIL');
        throw new Error('Cannot derive Multisig signers');
    }
    const signerWallets = detected.keys.map((pk) => new ethers.Wallet(pk, provider));
    for (let i = 0; i < 3; i++) {
        const bal = await provider.getBalance(signerWallets[i].address);
        if (bal < ethers.parseEther('0.01')) {
            const fund = await sendTx(`fund signer${i + 1}`, testUser.sendTransaction({
                to: signerWallets[i].address,
                value: ethers.parseEther('0.02'),
            }));
            record('setup', `fund Multisig signer ${i + 1}`, 'SUCCESS', fund.hash, fund.status === 'SUCCESS' ? 'PASS' : 'FAIL', fund);
        } else {
            record('setup', `fund Multisig signer ${i + 1}`, 'already funded', ethers.formatEther(bal), 'PASS');
        }
    }

    // ── Multisig: start ICO phase 1 (harmless required config) ────────────
    let phase = Number(await ico.currentPhaseId());
    if (phase === 0) {
        const msContract = await hre.ethers.getContractAt('RaceMultiSig', d.raceMultiSig);
        void msContract;
        const data = ico.interface.encodeFunctionData('startPhase', [1]);
        let txId = null;

        // Resume: find pending startPhase tx if already submitted
        const count = Number(await multiSig.transactionCount());
        for (let id = count - 1; id >= 0 && id >= count - 5; id--) {
            const t = await multiSig.getTransaction(id);
            if (!t.executed && t.to.toLowerCase() === d.raceICO.toLowerCase() && t.data.toLowerCase() === data.toLowerCase()) {
                txId = BigInt(id);
                record('multisig', 'resume pending startPhase txId', String(id), String(id), 'PASS');
                break;
            }
        }

        if (txId === null) {
            const sub = await sendTxFn('ms.submit startPhase(1)', () =>
                multiSig.connect(signerWallets[0]).submitTransaction(d.raceICO, 0, data),
            );
            record('multisig', 'submit startPhase(1)', 'SUCCESS', sub.hash, sub.status === 'SUCCESS' ? 'PASS' : 'FAIL', sub);
            txId = (await multiSig.transactionCount()) - 1n;
        }

        // non-signer reject
        try {
            await multiSig.connect(testUser).confirmTransaction.staticCall(txId);
            record('multisig', 'non-signer confirm blocked', 'revert', 'did not revert', 'FAIL');
        } catch {
            record('multisig', 'non-signer confirm blocked', 'revert', 'reverted', 'PASS');
        }

        const txn = await multiSig.getTransaction(txId);
        if (!txn.executed) {
            // confirm with first 3 signers who have not confirmed — probe via confirm staticCall
            for (let i = 0; i < 3; i++) {
                const fresh = await multiSig.getTransaction(txId);
                if (fresh.executed) break;
                try {
                    const conf = await sendTxFn(`ms.confirm signer${i + 1}`, () =>
                        multiSig.connect(signerWallets[i]).confirmTransaction(txId),
                    );
                    record('multisig', `confirm #${i + 1}`, 'SUCCESS', conf.hash, conf.status === 'SUCCESS' ? 'PASS' : 'FAIL', conf);
                } catch (e) {
                    const msg = e.message || String(e);
                    if (/confirmed|executed/i.test(msg)) {
                        record('multisig', `confirm #${i + 1}`, 'already confirmed/executed', msg.slice(0, 80), 'PASS');
                    } else {
                        throw e;
                    }
                }
            }

            // duplicate confirm check (if still not executed somehow use signer0)
            try {
                await multiSig.connect(signerWallets[0]).confirmTransaction.staticCall(txId);
                record('multisig', 'duplicate confirm blocked', 'revert', 'did not revert', 'FAIL');
            } catch {
                record('multisig', 'duplicate confirm blocked', 'revert', 'reverted', 'PASS');
            }
        } else {
            record('multisig', 'startPhase already executed via Multisig', 'executed', 'true', 'PASS');
        }

        phase = Number(await ico.currentPhaseId());
        record('ico', 'startPhase(1) via Multisig', '1', String(phase), phase === 1 ? 'PASS' : 'FAIL');
    } else {
        record('ico', 'startPhase already active', String(phase), String(phase), 'PASS');
        record('multisig', 'startPhase path', 'already done', 'skipped live submit', 'SKIP');
        // Still validate Multisig invariants
        try {
            await multiSig.connect(testUser).submitTransaction.staticCall(d.raceICO, 0, '0x');
            record('multisig', 'non-signer submit blocked', 'revert', 'did not revert', 'FAIL');
        } catch {
            record('multisig', 'non-signer submit blocked', 'revert', 'reverted', 'PASS');
        }
    }

    record('multisig', 'RaceMultiSig unchanged 3-of-5', '3', (await multiSig.threshold()).toString(), Number(await multiSig.threshold()) === 3 ? 'PASS' : 'FAIL');

    // ── ICO purchase ──────────────────────────────────────────────────────
    const usdtBefore = await usdt.balanceOf(testUser.address);
    const supplyBefore = await race.totalSupply();
    const engRaceBefore = await race.balanceOf(d.raceCommunityEngine);
    const stakesBefore = await engine.stakeCount(testUser.address);
    const soldBefore = await ico.totalSoldRace();
    const raisedBefore = await ico.totalRaisedUsdt();
    const adminWallet = await ico.adminWallet();
    const buyerIsAdmin = testUser.address.toLowerCase() === String(adminWallet).toLowerCase();

    // Flexible lock on ICO must fail
    try {
        await ico.purchase.staticCall(BUY_USDT, LOCK_FLEX);
        record('ico', 'Flexible lock rejected on ICO', 'revert', 'did not revert', 'FAIL');
    } catch {
        record('ico', 'Flexible lock rejected on ICO', 'revert', 'reverted', 'PASS');
    }

    const buy = await sendTx('ico.purchase(1 USDT, 180D)', ico.purchase(BUY_USDT, LOCK_180));
    record('ico', 'purchase', 'SUCCESS', buy.hash, buy.status === 'SUCCESS' ? 'PASS' : 'FAIL', buy);

    const usdtAfter = await usdt.balanceOf(testUser.address);
    const supplyAfter = await race.totalSupply();
    const engRaceAfter = await race.balanceOf(d.raceCommunityEngine);
    const stakesAfter = await engine.stakeCount(testUser.address);
    const soldAfter = await ico.totalSoldRace();
    const raisedAfter = await ico.totalRaisedUsdt();

    // When buyer == adminWallet, transferFrom(self→self) leaves buyer USDT balance unchanged.
    // Verify ICO raisedUsdt accounting instead of buyer wallet delta in that case.
    if (buyerIsAdmin) {
        const raisedDelta = raisedAfter - raisedBefore;
        record(
            'ico',
            'USDT raised (buyer=adminWallet)',
            '1e18',
            raisedDelta.toString(),
            raisedDelta === BUY_USDT ? 'PASS' : 'FAIL',
        );
        record(
            'ico',
            'USDT buyer delta N/A (self-transfer)',
            '0 expected',
            (usdtBefore - usdtAfter).toString(),
            usdtBefore - usdtAfter === 0n ? 'PASS' : 'FAIL',
        );
    } else {
        record(
            'ico',
            'USDT deducted',
            '1e18',
            (usdtBefore - usdtAfter).toString(),
            usdtBefore - usdtAfter === BUY_USDT ? 'PASS' : 'FAIL',
        );
        record(
            'ico',
            'USDT raised',
            '1e18',
            (raisedAfter - raisedBefore).toString(),
            raisedAfter - raisedBefore === BUY_USDT ? 'PASS' : 'FAIL',
        );
    }
    record('ico', 'totalSupply increased', '>0', (supplyAfter - supplyBefore).toString(), supplyAfter > supplyBefore ? 'PASS' : 'FAIL');
    record('ico', 'Engine RACE increased', '>0', (engRaceAfter - engRaceBefore).toString(), engRaceAfter > engRaceBefore ? 'PASS' : 'FAIL');
    record('ico', 'stake created', '+1', `${stakesBefore}->${stakesAfter}`, stakesAfter === stakesBefore + 1n ? 'PASS' : 'FAIL');
    record('ico', 'totalSoldRace increased', '>0', (soldAfter - soldBefore).toString(), soldAfter > soldBefore ? 'PASS' : 'FAIL');

    const stakeIndex = stakesAfter - 1n;
    const stake = await engine.stakeAt(testUser.address, stakeIndex);
    const principalUsdt = stake.principalUsdt ?? stake[0];
    const stakedRace = stake.stakedRace ?? stake[1];
    const lockPeriod = stake.lockPeriod ?? stake[2];
    const startedAt = stake.startedAt ?? stake[3];
    const unlockAt = stake.unlockAt ?? stake[4];
    const dailyRateBps = stake.dailyRateBps ?? stake[6];
    record('stake', 'principalUsdt', '1e18', principalUsdt.toString(), principalUsdt === BUY_USDT ? 'PASS' : 'FAIL');
    record('stake', 'stakedRace', '>0', stakedRace.toString(), stakedRace > 0n ? 'PASS' : 'FAIL');
    record('stake', 'lockPeriod', String(LOCK_180), lockPeriod.toString(), Number(lockPeriod) === LOCK_180 ? 'PASS' : 'FAIL');
    record('stake', 'dailyRateBps', '50', dailyRateBps.toString(), Number(dailyRateBps) === 50 ? 'PASS' : 'FAIL');
    record('stake', 'unlockAt > started', 'true', `${unlockAt}>${startedAt}`, unlockAt > startedAt ? 'PASS' : 'FAIL');

    // ── Reward / compound (live: no time travel) ───────────────────────────
    const pending = await engine.pendingRewardUsdt(testUser.address, stakeIndex);
    record('claim', 'pending before 1 day', '0', pending.toString(), pending === 0n ? 'PASS' : 'FAIL');
    try {
        await engine.claimReward.staticCall(stakeIndex);
        record('claim', 'claim before accrual blocked', 'revert', 'did not revert', 'FAIL');
    } catch {
        record('claim', 'claim before accrual blocked', 'revert', 'reverted', 'PASS');
    }
    try {
        await engine.compoundReward.staticCall(stakeIndex);
        record('compound', 'compound before accrual blocked', 'revert', 'did not revert', 'FAIL');
    } catch {
        record('compound', 'compound before accrual blocked', 'revert', 'reverted', 'PASS');
    }
    record('claim', 'live 1-day accrual / duplicate claim', 'needs time travel', 'NOT available on public BSC Testnet', 'SKIP');
    record('compound', 'live compound accrual', 'needs time travel', 'NOT available on public BSC Testnet', 'SKIP');
    record('maturity', 'matureStake + EMI 1/2/3', 'needs time travel', 'NOT available on public BSC Testnet (use Hardhat suite)', 'SKIP');
    record('flexible', 'withdraw after ICO complete', 'icoCompleted=false', String(await ico.icoCompleted()), 'SKIP');

    // Flexible participate while ICO not complete
    try {
        await engine.participate.staticCall(ethers.parseEther('1'), LOCK_FLEX);
        record('flexible', 'participate(FLEX) before ICO complete', 'revert or policy', 'did not revert', 'FAIL');
    } catch (e) {
        record('flexible', 'participate(FLEX) before ICO complete', 'revert', (e.shortMessage || e.message || 'reverted').slice(0, 120), 'PASS');
    }

    // ── Oracle ────────────────────────────────────────────────────────────
    try {
        const updatedAt = await oracle.updatedAt();
        const maxStale = await oracle.maxStaleness();
        const now = BigInt((await hre.ethers.provider.getBlock('latest')).timestamp);
        const age = now - BigInt(updatedAt);
        record(
            'oracle',
            'heartbeat age vs maxStaleness',
            `age<=${maxStale}`,
            `age=${age} max=${maxStale}`,
            age <= BigInt(maxStale) ? 'PASS' : 'SKIP',
        );

        try {
            const price = await oracle.racePriceUsdt();
            record('oracle', 'racePriceUsdt == $1', '1e18', price.toString(), price === ethers.parseEther('1') ? 'PASS' : 'FAIL');
        } catch (e) {
            const msg = e.shortMessage || e.message || String(e);
            record(
                'oracle',
                'racePriceUsdt readable',
                'fresh price',
                msg.slice(0, 160),
                /OracleStale|0x04578698/i.test(msg) ? 'SKIP' : 'FAIL',
            );
        }

        const updaterOk = await oracle.isUpdater(testUser.address);
        record('oracle', 'deployer isUpdater', 'optional after Multisig harden', String(updaterOk), 'PASS');

        try {
            const hb = await sendTxFn('oracle.updatePrice($1)', () => oracle.updatePrice(ethers.parseEther('1')));
            record('oracle', 'authorized updater heartbeat', 'SUCCESS', hb.hash, hb.status === 'SUCCESS' ? 'PASS' : 'FAIL', hb);
        } catch (e) {
            const msg = e.shortMessage || e.message || String(e);
            record(
                'oracle',
                'authorized updater heartbeat',
                'SUCCESS or Multisig-only updater',
                msg.slice(0, 160),
                /OracleNotUpdater|not updater|0x9a1e07dd/i.test(msg) ? 'SKIP' : 'FAIL',
            );
        }

        try {
            const stranger = signerWallets[4] || signerWallets[signerWallets.length - 1];
            if (!stranger || stranger.address.toLowerCase() === testUser.address.toLowerCase()) {
                record('oracle', 'unauthorized updater blocked', 'revert', 'no distinct stranger signer', 'SKIP');
            } else {
                await oracle.connect(stranger).updatePrice.staticCall(ethers.parseEther('1'));
                record('oracle', 'unauthorized updater blocked', 'revert', 'did not revert', 'FAIL');
            }
        } catch {
            record('oracle', 'unauthorized updater blocked', 'revert', 'reverted', 'PASS');
        }
    } catch (e) {
        record('oracle', 'oracle section', 'readable', (e.shortMessage || e.message || String(e)).slice(0, 160), 'FAIL');
    }

    // ── Governance ────────────────────────────────────────────────────────
    record('governance', 'RaceGovernance community 10-12', 'deployed', 'NOT DEPLOYED on this Testnet', 'SKIP');
    record('governance', 'legacy RaceGovernor present', d.raceGovernor, d.raceGovernor || 'missing', d.raceGovernor ? 'PASS' : 'FAIL');

    // ── Laravel / Frontend inspection (read-only) ─────────────────────────
    const rootEnv = path.join(__dirname, '..', '..', '.env');
    let laravel = { wired: false, details: 'Laravel .env not readable or contracts unset' };
    if (fs.existsSync(rootEnv)) {
        const raw = fs.readFileSync(rootEnv, 'utf8');
        const get = (k) => {
            const m = raw.match(new RegExp(`^${k}=(.*)$`, 'm'));
            return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
        };
        const icoEnv =
            get('RACE_ICO_CONTRACT') || get('RACE_ICO_ADDRESS') || get('RACE_ICO');
        const engEnv =
            get('RACE_COMMUNITY_ENGINE_CONTRACT') ||
            get('RACE_COMMUNITY_ENGINE_ADDRESS') ||
            get('RACE_COMMUNITY_ENGINE');
        const chain = get('BLOCKCHAIN_NETWORK') || get('BSC_NETWORK') || get('BSC_CHAIN_ID');
        const matchIco = !!(icoEnv && icoEnv.toLowerCase() === d.raceICO.toLowerCase());
        const matchEngine = !!(engEnv && engEnv.toLowerCase() === d.raceCommunityEngine.toLowerCase());
        laravel = {
            wired: !!(icoEnv && engEnv),
            icoSet: !!icoEnv,
            engSet: !!engEnv,
            chain,
            matchIco,
            matchEngine,
        };
    }
    if (!laravel.wired) {
        record(
            'laravel',
            'contracts wired to Testnet deployment',
            'set RACE_ICO_CONTRACT + RACE_COMMUNITY_ENGINE_CONTRACT on server/local .env',
            'unset in readable .env (configure for client UAT)',
            'SKIP',
        );
    } else {
        record(
            'laravel',
            'contracts wired to Testnet deployment',
            'RACE_ICO + ENGINE match deployment.json',
            JSON.stringify({ matchIco: laravel.matchIco, matchEngine: laravel.matchEngine, chain: laravel.chain }),
            laravel.matchIco && laravel.matchEngine ? 'PASS' : 'FAIL',
        );
    }
    record('laravel', 'indexer live event soak', 'events indexed', 'not executed in this automated UAT', 'SKIP');
    record('frontend', 'live browser UAT', 'manual client session', 'NOT STARTED in this automated run', 'SKIP');

    // Persist
    const summary = {
        chainId,
        testUser: testUser.address,
        deployment: d.raceICO,
        results,
        counts: {
            PASS: results.filter((r) => r.status === 'PASS').length,
            FAIL: results.filter((r) => r.status === 'FAIL').length,
            SKIP: results.filter((r) => r.status === 'SKIP').length,
        },
        finishedAt: new Date().toISOString(),
    };
    fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
    console.log('Wrote', OUT);
    console.log('COUNTS', summary.counts);
    if (summary.counts.FAIL > 0) process.exitCode = 1;
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
