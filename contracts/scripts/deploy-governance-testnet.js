/**
 * TESTNET-ONLY — deploy RaceGovernance (Community 10–12).
 * Does NOT modify RaceMultiSig. Does NOT deploy mainnet.
 *
 * Env:
 *   GOVERNANCE_MEMBERS=0x..,0x.. (10–12 unique)
 *   GOVERNANCE_THRESHOLD=7
 *   GOVERNANCE_VOTING_PERIOD_SECONDS=259200   # 3 days
 *   GOVERNANCE_TIMELOCK_SECONDS=86400        # 1 day
 *   GOVERNANCE_INITIAL_TARGETS=0xEngine,0xOracle,...  (optional)
 */
const hre = require('hardhat');
const { loadContractsEnv, resolveGovernanceMembersRaw } = require('./lib/loadContractsEnv');
loadContractsEnv();

function parseAddresses(raw, label) {
    if (!raw || !String(raw).trim()) {
        throw new Error(`${label} required`);
    }
    const list = String(raw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((a, i) => {
            try {
                return hre.ethers.getAddress(a);
            } catch {
                throw new Error(`${label}[${i}] invalid: ${a}`);
            }
        });
    const seen = new Set();
    for (const a of list) {
        if (a === hre.ethers.ZeroAddress) throw new Error(`${label} contains zero address`);
        const k = a.toLowerCase();
        if (seen.has(k)) throw new Error(`${label} duplicate ${a}`);
        seen.add(k);
    }
    return list;
}

async function main() {
    const network = await hre.ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    if (chainId === 56) {
        throw new Error('REFUSED: mainnet deploy of Governance is not allowed by this script.');
    }

    const accounts = await hre.ethers.getSigners();
    const deployer = accounts[0];
    console.log('Deployer:', deployer.address);
    console.log('Chain ID:', chainId);

    let members;
    const membersRaw = resolveGovernanceMembersRaw();
    if (membersRaw.length) {
        members = parseAddresses(membersRaw.join(','), 'GOVERNANCE_MEMBERS');
    } else if (accounts.length >= 12) {
        members = accounts.slice(0, 12).map((a) => a.address);
        console.warn('WARN: GOVERNANCE_MEMBERS unset — using first 12 Hardhat/RPC accounts (local only).');
    } else {
        throw new Error(
            'Set GOVERNANCE_MEMBERS (csv) or GOVERNANCE_MEMBER_1..12 to 10–12 unique addresses',
        );
    }

    if (members.length < 10 || members.length > 12) {
        throw new Error(`GOVERNANCE_MEMBERS must be 10–12 (got ${members.length})`);
    }

    const threshold = Number(process.env.GOVERNANCE_THRESHOLD || 7);
    if (!Number.isInteger(threshold) || threshold * 2 <= members.length || threshold > members.length) {
        throw new Error(`Invalid GOVERNANCE_THRESHOLD=${threshold} for ${members.length} members (>50% required)`);
    }

    const votingPeriod = Number(process.env.GOVERNANCE_VOTING_PERIOD_SECONDS || 3 * 24 * 60 * 60);
    const timelock = Number(process.env.GOVERNANCE_TIMELOCK_SECONDS || 24 * 60 * 60);

    let initialTargets = [];
    if (process.env.GOVERNANCE_INITIAL_TARGETS) {
        initialTargets = parseAddresses(process.env.GOVERNANCE_INITIAL_TARGETS, 'GOVERNANCE_INITIAL_TARGETS');
    }

    const RaceGovernance = await hre.ethers.getContractFactory('RaceGovernance');
    const gov = await RaceGovernance.deploy(members, threshold, votingPeriod, timelock, initialTargets);
    await gov.waitForDeployment();
    const address = await gov.getAddress();

    console.log('\n=== COMMUNITY GOVERNANCE (TESTNET) ===');
    console.log('GOVERNANCE ADDRESS:', address);
    console.log('MEMBERS:', members.join(', '));
    console.log('MEMBER COUNT:', members.length);
    console.log('THRESHOLD:', threshold);
    console.log('VOTING PERIOD (s):', votingPeriod);
    console.log('TIMELOCK (s):', timelock);
    console.log('INITIAL TARGETS:', initialTargets.length ? initialTargets.join(', ') : '(self only)');
    console.log('NOTE: RaceMultiSig untouched. Do not transfer RaceCoin ownership without mint-risk review.');
    console.log('=====================================\n');

    console.log(
        JSON.stringify(
            {
                network: String(chainId),
                raceGovernance: address,
                members,
                threshold,
                votingPeriod,
                timelock,
                initialTargets,
            },
            null,
            2,
        ),
    );
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
