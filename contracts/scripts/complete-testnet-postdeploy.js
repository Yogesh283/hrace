/**
 * Resume BSC Testnet post-deploy configuration WITHOUT redeploying contracts.
 *
 * Uses existing addresses (deployment.json or KNOWN_TESTNET_DEPLOYMENT).
 *
 *   npm run complete:testnet-postdeploy
 *
 * Requires:
 *   DEPLOY_ENV=testnet
 *   CONFIRM_TESTNET_DEPLOYMENT=YES
 *   ORACLE_UPDATER=<dedicated ops EOA>
 *   HARDEN_GOVERNANCE=1   (optional but recommended for ownership → MultiSig)
 *
 * Never prints private keys. Never deploys new core contracts.
 */
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const {
    loadContractsEnv,
    ENV_PATH,
    envFirst,
    looksLikePlaceholderKey,
} = require('./lib/loadContractsEnv');

const OUT_DIR = path.join(__dirname, '..', 'deployments', 'bscTestnet');
const OUT_FILE = path.join(OUT_DIR, 'deployment.json');

/** Addresses from the partial deploy that stopped at oracle updater assert (terminal log). */
const KNOWN = {
    network: 'bscTestnet',
    chainId: 97,
    raceMultiSig: '0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a',
    raceCoin: '0xbCAE5e637872a2760065ff9e9f6533ECC80122e6',
    raceTreasury: '0x04F3C02018Da34D3641f47C1F136FFcDb57Dc93A',
    raceDevelopmentTreasury: '0xfFfF27aFdADf6F58276d2293A3246eDAd2B4cd5f',
    raceMarketingTreasury: '0x67e5d4ab5187a9292F47e7FeC6a0b067dD64084A',
    raceOperationsTreasury: '0x08Bba9326DbCc9f7f9C615dDb4889656e1C3cCFA',
    raceAutoLiquidity: '0xafC443895FAb63F4221B50Cc9dceB46ce925F146',
    raceStaking: '0xA31C053767034C86BaB132B53686AAb7898255A3',
    raceRewardVault: '0x44aB7B654dAA8184C7B43CAcB69994969A926ca4',
    raceCommunityEngine: '0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9',
    raceParticipation: '0x9BF2E3405c0cB666C6664BD7651dab3F656fEDA5',
    raceICO: '0x9C227938885f5fE4f91826EC6dB37ea54AC31C73',
    raceRewardPriceOracle: '0xB5A67CD0D32Ed0D5021827b1C5d6bfd1C401556a',
    raceRewardPool: '0x77116d2B7f00F17fdEA1E2076dBAEfD257E004C8',
    raceGovernor: '0xD53De472E9363B5eA08BAF919955B6332575A85D',
    raceEcosystemVault: '0x6bBBe3AB18f2639c2Ade66F68D1F4edf32Bdc6D9',
    strategicReserveVesting: '0x1AF0856957FB35d6143C204C84c5187aBc01E70E',
    developmentFundVesting: '0xDBC3C6e5295A2244036DB93E3DfF626d94ab02D9',
    partnershipsVesting: '0x859929b84D3Ded76fd409289724Ae0a78f75de74',
    raceLiquidityLocker: null,
    usdt: '0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc',
    pancakeRouter: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
};

function upsertEnv(raw, updates) {
    const lines = raw.split(/\r?\n/);
    const found = new Set();
    const out = lines.map((line) => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return line;
        const i = t.indexOf('=');
        if (i < 0) return line;
        const k = t.slice(0, i).trim();
        if (Object.prototype.hasOwnProperty.call(updates, k)) {
            found.add(k);
            return `${k}=${updates[k]}`;
        }
        return line;
    });
    for (const [k, v] of Object.entries(updates)) {
        if (!found.has(k)) out.push(`${k}=${v}`);
    }
    return out.join('\n').replace(/\n*$/, '\n');
}

function loadManifest() {
    if (fs.existsSync(OUT_FILE)) {
        const existing = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
        return { ...KNOWN, ...existing, chainId: 97, network: 'bscTestnet' };
    }
    return { ...KNOWN };
}

async function send(label, txPromise, txs) {
    console.log('ACTION:', label);
    const tx = await txPromise;
    const receipt = await tx.wait();
    const row = {
        action: label,
        txHash: receipt.hash,
        status: receipt.status === 1 ? 'SUCCESS' : 'FAIL',
        block: receipt.blockNumber,
    };
    txs.push(row);
    console.log('TX HASH:', row.txHash);
    console.log('STATUS:', row.status);
    console.log('BLOCK:', row.block);
    if (row.status !== 'SUCCESS') throw new Error(`${label} failed`);
    return receipt;
}

async function main() {
    loadContractsEnv();

    const network = await hre.ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    console.log('NETWORK:', hre.network.name);
    console.log('CHAIN ID:', chainId);

    if (chainId === 56) throw new Error('STOP: Mainnet forbidden');
    if (chainId !== 97) throw new Error(`STOP: chainId must be 97 (got ${chainId})`);
    if (envFirst('DEPLOY_ENV') !== 'testnet') throw new Error('STOP: DEPLOY_ENV=testnet required');
    if (envFirst('CONFIRM_TESTNET_DEPLOYMENT') !== 'YES') {
        throw new Error('STOP: CONFIRM_TESTNET_DEPLOYMENT=YES required');
    }
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        throw new Error('STOP: DEPLOYER_PRIVATE_KEY missing');
    }

    const [deployer] = await hre.ethers.getSigners();
    console.log('DEPLOYER:', deployer.address);

    let oracleUpdater = envFirst('ORACLE_UPDATER');
    if (!oracleUpdater) {
        // Dedicated Testnet ops wallet = deployer (has tBNB). Do NOT silently use MultiSig.
        oracleUpdater = deployer.address;
        console.warn('WARN: ORACLE_UPDATER unset — using deployer as dedicated Testnet ops updater');
        if (fs.existsSync(ENV_PATH)) {
            const next = upsertEnv(fs.readFileSync(ENV_PATH, 'utf8'), {
                ORACLE_UPDATER: oracleUpdater,
                RACE_REWARD_PRICE_USDT: envFirst('RACE_REWARD_PRICE_USDT') || '1',
                HARDEN_GOVERNANCE: envFirst('HARDEN_GOVERNANCE') || '1',
            });
            fs.writeFileSync(ENV_PATH, next);
            process.env.ORACLE_UPDATER = oracleUpdater;
            if (!process.env.RACE_REWARD_PRICE_USDT) process.env.RACE_REWARD_PRICE_USDT = '1';
            if (!process.env.HARDEN_GOVERNANCE) process.env.HARDEN_GOVERNANCE = '1';
            console.log('Wrote ORACLE_UPDATER (+ price/harden defaults) to contracts/.env');
        }
    }
    oracleUpdater = hre.ethers.getAddress(oracleUpdater);
    if (oracleUpdater === hre.ethers.ZeroAddress) throw new Error('ORACLE_UPDATER zero');

    const harden =
        envFirst('HARDEN_GOVERNANCE') === '1' || envFirst('HARDEN_GOVERNANCE') === 'true';
    const priceHuman = envFirst('RACE_REWARD_PRICE_USDT') || '1';
    const priceWei = hre.ethers.parseEther(priceHuman);

    const manifest = loadManifest();
    const txs = Array.isArray(manifest.postDeployTxs) ? [...manifest.postDeployTxs] : [];

    const oracle = await hre.ethers.getContractAt(
        'RaceRewardPriceOracle',
        manifest.raceRewardPriceOracle,
        deployer,
    );
    const raceCoin = await hre.ethers.getContractAt('RaceCoin', manifest.raceCoin, deployer);
    const engine = await hre.ethers.getContractAt(
        'RaceCommunityEngine',
        manifest.raceCommunityEngine,
        deployer,
    );
    const vault = await hre.ethers.getContractAt('RaceRewardVault', manifest.raceRewardVault, deployer);
    const ico = await hre.ethers.getContractAt('RaceICO', manifest.raceICO, deployer);
    const treasury = await hre.ethers.getContractAt('RaceTreasury', manifest.raceTreasury, deployer);
    const multiSig = await hre.ethers.getContractAt('RaceMultiSig', manifest.raceMultiSig, deployer);

    // ── Oracle updater activation (no redeploy) ─────────────────────────────
    const ownerBefore = await oracle.owner();
    console.log('Oracle owner:', ownerBefore);
    if (ownerBefore.toLowerCase() !== deployer.address.toLowerCase()) {
        throw new Error(
            `STOP: Oracle owner is ${ownerBefore}; deployer cannot setUpdater. Need MultiSig path.`,
        );
    }

    if (!(await oracle.isUpdater(oracleUpdater))) {
        await send(
            'oracle.setUpdater(ORACLE_UPDATER,true)',
            oracle.setUpdater(oracleUpdater, true),
            txs,
        );
    } else {
        console.log('Oracle updater already active:', oracleUpdater);
    }

    const active = await oracle.isUpdater(oracleUpdater);
    console.log('isUpdater eth_call:', active);
    if (!active) throw new Error('ASSERT: ORACLE_UPDATER still inactive');

    // Ensure explicit $1 reward settlement price (not Pancake spot).
    // Signer must be an active updater; Hardhat only has DEPLOYER_PRIVATE_KEY.
    if (oracleUpdater.toLowerCase() !== deployer.address.toLowerCase()) {
        if (!(await oracle.isUpdater(deployer.address))) {
            await send(
                'oracle.setUpdater(deployer,true) for heartbeat signer',
                oracle.setUpdater(deployer.address, true),
                txs,
            );
        }
    }
    const raw = await oracle.rawPriceUsdtPerRace();
    if (raw !== priceWei) {
        await send(`oracle.updatePrice(${priceHuman} USDT/RACE)`, oracle.updatePrice(priceWei), txs);
    } else {
        try {
            await send('oracle.updatePrice(heartbeat $1)', oracle.updatePrice(priceWei), txs);
        } catch (e) {
            console.warn('Price heartbeat skipped:', e.message || e);
        }
    }

    const livePrice = await oracle.racePriceUsdt();
    console.log('racePriceUsdt:', livePrice.toString(), livePrice === priceWei ? 'OK' : 'MISMATCH');
    if (livePrice !== priceWei) throw new Error('ASSERT: racePriceUsdt != configured price');

    // ── Ownership hardening → MultiSig (NOT Community Governance) ───────────
    // RaceCoin ownership to MultiSig is SAFE for mint gates (setMinter); governanceMint
    // still requires separate governance address — do NOT set governance to RaceGovernance
    // without explicit review. Never transfer RaceCoin to Community Governance here.
    const ownersBefore = {
        raceCoin: await raceCoin.owner(),
        engine: await engine.owner(),
        vault: await vault.owner(),
        ico: await ico.owner(),
        oracle: await oracle.owner(),
        treasury: await treasury.owner(),
    };
    console.log('Owners before harden:', ownersBefore);

    if (harden) {
        const ms = manifest.raceMultiSig;
        const transfers = [
            ['oracle.transferOwnership(MultiSig)', oracle, ms],
            ['engine.transferOwnership(MultiSig)', engine, ms],
            ['treasury.transferOwnership(MultiSig)', treasury, ms],
            ['raceCoin.transferOwnership(MultiSig)', raceCoin, ms],
            ['ico.transferOwnership(MultiSig)', ico, ms],
            ['vault.transferOwnership(MultiSig)', vault, ms],
        ];
        for (const [label, contract, target] of transfers) {
            const cur = await contract.owner();
            if (cur.toLowerCase() === target.toLowerCase()) {
                console.log('SKIP (already MultiSig):', label);
                continue;
            }
            if (cur.toLowerCase() !== deployer.address.toLowerCase()) {
                throw new Error(`STOP: ${label} current owner ${cur} is not deployer`);
            }
            await send(label, contract.transferOwnership(target), txs);
        }
    } else {
        console.warn('HARDEN_GOVERNANCE not enabled — owners remain deployer');
    }

    const ownersAfter = {
        raceCoin: await raceCoin.owner(),
        engine: await engine.owner(),
        vault: await vault.owner(),
        ico: await ico.owner(),
        oracle: await oracle.owner(),
        treasury: await treasury.owner(),
        treasuryMultisig: await treasury.multisig(),
    };

    const expectedOwner = harden ? manifest.raceMultiSig : deployer.address;
    for (const [k, v] of Object.entries({
        raceCoin: ownersAfter.raceCoin,
        engine: ownersAfter.engine,
        vault: ownersAfter.vault,
        ico: ownersAfter.ico,
        oracle: ownersAfter.oracle,
        treasury: ownersAfter.treasury,
    })) {
        if (v.toLowerCase() !== expectedOwner.toLowerCase()) {
            throw new Error(`ASSERT: ${k}.owner ${v} != ${expectedOwner}`);
        }
    }

    const stillActive = await oracle.isUpdater(oracleUpdater);
    if (!stillActive) throw new Error('ASSERT: updater inactive after ownership change');

    const multiSigThreshold = await multiSig.threshold();
    const signers = await multiSig.getSigners();

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const finalDoc = {
        ...manifest,
        chainId: 97,
        network: 'bscTestnet',
        deployer: deployer.address,
        completedAt: new Date().toISOString(),
        blockNumber: await hre.ethers.provider.getBlockNumber(),
        oracleUpdater,
        oraclePriceUsdt: priceHuman,
        oraclePriceWei: priceWei.toString(),
        hardenGovernance: harden,
        owners: ownersAfter,
        multisigThreshold: multiSigThreshold.toString(),
        multisigSigners: signers,
        postDeployTxs: txs,
        linkages: {
            vaultEngine: await vault.engine(),
            icoStakingEngine: await ico.stakingEngine(),
            engineOracle: await engine.rewardPriceOracle(),
            raceCoinMinterIco: await raceCoin.isMinter(manifest.raceICO),
            raceCoinMinterVault: await raceCoin.isMinter(manifest.raceRewardVault),
        },
        note: 'Resumed post-deploy — contracts NOT redeployed. TESTNET ONLY.',
    };
    fs.writeFileSync(OUT_FILE, JSON.stringify(finalDoc, null, 2));
    console.log('Updated', OUT_FILE);
    console.log('STATUS: PASS');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
