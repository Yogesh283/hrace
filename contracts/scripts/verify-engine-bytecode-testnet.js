/**
 * Read-only: verify live BSC Testnet RaceCommunityEngine config + ENG-HIGH-01 fix probe.
 *
 *   cd contracts && npx hardhat run scripts/verify-engine-bytecode-testnet.js --network bscTestnet
 *
 * Does NOT send transactions. Never prints private keys.
 */
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');
const { loadContractsEnv } = require('./lib/loadContractsEnv');

const MANIFEST = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'deployment.json');
const ENGINE_ABI = [
    'function owner() view returns (address)',
    'function usdt() view returns (address)',
    'function raceToken() view returns (address)',
    'function pancakeRouter() view returns (address)',
    'function rewardVault() view returns (address)',
    'function icoContract() view returns (address)',
    'function rewardPriceOracle() view returns (address)',
    'function maturityTreasury() view returns (address)',
    'function maturityTreasuryLocked() view returns (bool)',
    'function claimEnabled() view returns (bool)',
    'function totalStakesCreated() view returns (uint256)',
    'function totalLockedRace() view returns (uint256)',
    'function stakeCount(address) view returns (uint256)',
    'function distributeReward(address user, uint256 stakeIndex)',
];

async function probeDistributeRewardAuth(provider, engineAddress, iface, victim, attacker) {
    const data = iface.encodeFunctionData('distributeReward', [victim, 0]);
    try {
        await provider.call({
            to: engineAddress,
            from: attacker,
            data,
        });
        return {
            status: 'VULNERABLE',
            reason: 'eth_call_did_not_revert',
            fixLikelyPresent: false,
        };
    } catch (e) {
        const blob = `${e.shortMessage || ''} ${e.message || ''} ${e.data || ''}`.toLowerCase();
        if (blob.includes('not user') || blob.includes('0x') && decodeRevertNotUser(e)) {
            return {
                status: 'HARDENED',
                reason: 'revert_not_user',
                fixLikelyPresent: true,
            };
        }
        if (blob.includes('claim disabled') || blob.includes('ico active')) {
            return {
                status: 'INCONCLUSIVE',
                reason: 'reverted_claim_or_ico_gate_before_or_without_auth_fix',
                fixLikelyPresent: null,
                note: 'When claimEnabled=false, legacy bytecode may revert here without proving auth fix.',
            };
        }
        return {
            status: 'INCONCLUSIVE',
            reason: (e.shortMessage || e.message || 'revert').slice(0, 200),
            fixLikelyPresent: null,
        };
    }
}

function decodeRevertNotUser(e) {
    const data = e.data;
    if (typeof data !== 'string' || !data.startsWith('0x')) return false;
    try {
        const reason = hre.ethers.toUtf8String('0x' + data.slice(10));
        return reason.includes('not user');
    } catch {
        return false;
    }
}

async function compareCompiledBytecode(engineAddress) {
    const artifactPath = path.join(
        __dirname,
        '..',
        'artifacts',
        'src',
        'RaceCommunityEngine.sol',
        'RaceCommunityEngine.json',
    );
    if (!fs.existsSync(artifactPath)) {
        return { error: 'artifact_missing_run_compile' };
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const localDeployed = artifact.deployedBytecode;
    const onChain = await hre.ethers.provider.getCode(engineAddress);
    if (!onChain || onChain === '0x') {
        return { hasCode: false, matchesCurrentRepoCompile: false };
    }
    const matches = localDeployed.toLowerCase() === onChain.toLowerCase();
    return {
        hasCode: true,
        matchesCurrentRepoCompile: matches,
        localDeployedBytecodeHash: hre.ethers.keccak256(localDeployed),
        onChainRuntimeHash: hre.ethers.keccak256(onChain),
        localBytecodeLength: localDeployed.length,
        onChainBytecodeLength: onChain.length,
    };
}

async function main() {
    loadContractsEnv();
    const net = await hre.ethers.provider.getNetwork();
    const chainId = Number(net.chainId);
    if (chainId !== 97) {
        throw new Error(`STOP: expected BSC testnet chain 97, got ${chainId}`);
    }

    if (!fs.existsSync(MANIFEST)) {
        throw new Error('deployment.json missing');
    }
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const engineAddress = manifest.raceCommunityEngine;
    if (!engineAddress) throw new Error('raceCommunityEngine missing in manifest');

    const provider = hre.ethers.provider;
    const iface = new hre.ethers.Interface(ENGINE_ABI);
    const signers = await hre.ethers.getSigners();
    const caller = signers[0]?.address || manifest.deployer;
    const attackerAddr = signers[1]?.address || '0x1111111111111111111111111111111111111111';
    const engine = await hre.ethers.getContractAt('RaceCommunityEngine', engineAddress, provider);

    const vault = await hre.ethers.getContractAt('RaceRewardVault', manifest.raceRewardVault, provider);
    const ico = await hre.ethers.getContractAt('RaceICO', manifest.raceICO, provider);

    const report = {
        chainId,
        engineAddress,
        deprecatedEngine: manifest.raceCommunityEngineDeprecated || null,
        c1EngineRedeployAt: manifest.c1EngineRedeployAt || null,
        bytecode: await compareCompiledBytecode(engineAddress),
        onChain: {
            owner: await engine.owner(),
            usdt: await engine.usdt(),
            raceToken: await engine.raceToken(),
            pancakeRouter: await engine.pancakeRouter(),
            rewardVault: await engine.rewardVault(),
            icoContract: await engine.icoContract(),
            rewardPriceOracle: await engine.rewardPriceOracle(),
            maturityTreasury: await engine.maturityTreasury(),
            maturityTreasuryLocked: await engine.maturityTreasuryLocked(),
            claimEnabled: await engine.claimEnabled(),
            totalStakesCreated: (await engine.totalStakesCreated()).toString(),
            totalLockedRace: (await engine.totalLockedRace()).toString(),
        },
        manifestExpected: {
            raceCoin: manifest.raceCoin,
            raceRewardVault: manifest.raceRewardVault,
            raceICO: manifest.raceICO,
            raceTreasury: manifest.raceTreasury,
            raceRewardPriceOracle: manifest.raceRewardPriceOracle,
            raceMultiSig: manifest.raceMultiSig,
            pancakeRouter: manifest.pancakeRouter,
            usdt: manifest.usdt,
        },
        linkages: {
            vaultEngine: await vault.engine(),
            icoStakingEngine: await ico.stakingEngine(),
        },
        alignment: {},
        distributeRewardAuthProbe: null,
        verifiedAt: new Date().toISOString(),
    };

    const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
    report.alignment.ownerIsMultiSig = eq(report.onChain.owner, manifest.raceMultiSig);
    report.alignment.vaultEngineMatches = eq(report.linkages.vaultEngine, engineAddress);
    report.alignment.icoEngineMatches = eq(report.linkages.icoStakingEngine, engineAddress);
    report.alignment.raceCoinMatches = eq(report.onChain.raceToken, manifest.raceCoin);
    report.alignment.vaultAddressMatches = eq(report.onChain.rewardVault, manifest.raceRewardVault);
    report.alignment.oracleMatches = eq(report.onChain.rewardPriceOracle, manifest.raceRewardPriceOracle);
    report.alignment.icoMatches = eq(report.onChain.icoContract, manifest.raceICO);
    report.alignment.treasuryMatches = eq(report.onChain.maturityTreasury, manifest.raceTreasury);

    const probeWallet = manifest.deployer || caller;
    report.stakeCountProbe = {
        wallet: probeWallet,
        stakeCount: (await engine.stakeCount(probeWallet)).toString(),
    };

    report.distributeRewardAuthProbe = await probeDistributeRewardAuth(
        provider,
        engineAddress,
        iface,
        probeWallet,
        attackerAddr,
    );

    console.log(JSON.stringify(report, null, 2));

    let fixStatus = 'CANNOT_VERIFY';
    const probe = report.distributeRewardAuthProbe;
    const byteMatch = report.bytecode.matchesCurrentRepoCompile === true;
    if (byteMatch) {
        fixStatus = 'CONFIRMED';
    } else if (report.bytecode.matchesCurrentRepoCompile === false && report.bytecode.hasCode) {
        fixStatus = 'NOT_CONFIRMED';
    }
    if (probe.fixLikelyPresent === true) fixStatus = 'CONFIRMED';
    else if (probe.fixLikelyPresent === false) fixStatus = 'NOT_CONFIRMED';

    console.log('\n--- SUMMARY ---');
    console.log('LIVE_ENGINE_FIX_STATUS (bytecode + auth probe):', fixStatus);
    console.log('bytecode.matchesCurrentRepoCompile:', report.bytecode.matchesCurrentRepoCompile);
    console.log('claimEnabled:', report.onChain.claimEnabled);
}

main().catch((e) => {
    console.error('VERIFY FAIL:', e.message || e);
    process.exitCode = 1;
});
