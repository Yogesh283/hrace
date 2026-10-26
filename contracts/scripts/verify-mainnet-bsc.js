/**
 * Verify deployed BSC mainnet core contracts.
 * Sourcify v2 (no API key). BscScan/Etherscan v2 if BSCSCAN_API_KEY or ETHERSCAN_API_KEY is set.
 *
 *   cd contracts && npx hardhat run scripts/verify-mainnet-bsc.js --network bsc
 */
const hre = require('hardhat');
const { loadContractsEnv } = require('./lib/loadContractsEnv');

loadContractsEnv();

const CHAIN_ID = 56;
const SOURCIFY = 'https://sourcify.dev/server';
const DEPLOYER = '0x3F82B1CaCC6Fa52eE9F28A8964a78786d9ed50D8';
const USDT = '0x55d398326f99059ff775485246999027b3197955';
const ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const ADMIN = '0x568B11c83A104c81c70cde58cCdbF4aa9c97b225';
const FEE_ADMIN = '0x53fcf2f5569296478ce76C2e2977766B121D35E2';
const SIGNERS = [
    '0xCc2B87f8E8AABc295e1119E186c3021bA6F32339',
    '0x8B2Ac41931d4869E7a53144BaF5C1fa052E8Df24',
    '0xDE64cA155dEb48B459360FB8E3c4e7167Bfeb150',
    '0xE9db9ea0fC494fB1Fc743DAfD5a0a436cA19EECA',
    '0x71DDFC006c21756DF7b07fB4357f6F6B33CE11f9',
];

const CORE = {
    raceMultiSig: '0x46aC99282929bb95B4362Aa06CbbAdecEC3D2e4B',
    raceCoin: '0x7603AaCDc5cB7aF15dBFA0a0B52e5Fd0337365c8',
    raceTreasury: '0xb8ad9eE82739B7cd420c847F6B32347E73791854',
    raceRewardVault: '0xb39f30932fcfC11d816F16A1619690498fA2295B',
    raceCommunityEngine: '0x4CC371a67EBc287978Ab8885D50021A28e9E49Bf',
    raceICO: '0x6E9c778841bF4037365A65a1F0ca413b49BaCe05',
    icoContract: '0xA473409De978d1F0D8BB9CB1A34cCe315D820Af4',
    raceRewardPriceOracle: '0xC05DC44304C8c0adBb1a3C2320be0DB41EC8D4ae',
    raceIncomeHold: '0xe0698e9D5a58977Ec57dd082F002e6c234b5F813',
};

function jobs() {
    const { ethers } = hre;
    return [
        { name: 'RaceMultiSig', address: CORE.raceMultiSig, fqn: 'src/RaceMultiSig.sol:RaceMultiSig', args: [SIGNERS] },
        {
            name: 'RaceCoin',
            address: CORE.raceCoin,
            fqn: 'src/RaceCoin.sol:RaceCoin',
            args: [DEPLOYER, DEPLOYER, DEPLOYER, DEPLOYER, DEPLOYER],
        },
        {
            name: 'RaceTreasury',
            address: CORE.raceTreasury,
            fqn: 'src/RaceTreasury.sol:RaceTreasury',
            args: [DEPLOYER, CORE.raceCoin, CORE.raceMultiSig],
        },
        {
            name: 'RaceRewardVault',
            address: CORE.raceRewardVault,
            fqn: 'src/RaceRewardVault.sol:RaceRewardVault',
            args: [DEPLOYER, CORE.raceCoin],
        },
        {
            name: 'RaceCommunityEngine',
            address: CORE.raceCommunityEngine,
            fqn: 'src/RaceCommunityEngine.sol:RaceCommunityEngine',
            args: [DEPLOYER, USDT, CORE.raceCoin, ROUTER, CORE.raceRewardVault],
        },
        { name: 'RaceICO', address: CORE.raceICO, fqn: 'src/RaceICO.sol:RaceICO', args: [DEPLOYER, CORE.raceCoin, USDT, ADMIN] },
        {
            name: 'ICOContract',
            address: CORE.icoContract,
            fqn: 'src/ICOContract.sol:ICOContract',
            args: [DEPLOYER, CORE.raceCoin, ADMIN],
        },
        {
            name: 'RaceRewardPriceOracle',
            address: CORE.raceRewardPriceOracle,
            fqn: 'src/RaceRewardPriceOracle.sol:RaceRewardPriceOracle',
            args: [
                DEPLOYER,
                ethers.parseEther('0.05'),
                24 * 60 * 60,
                ethers.parseEther(process.env.RACE_REWARD_PRICE_MIN || '0.01'),
                ethers.parseEther(process.env.RACE_REWARD_PRICE_MAX || '100'),
            ],
        },
        {
            name: 'RaceIncomeHold',
            address: CORE.raceIncomeHold,
            fqn: 'src/RaceIncomeHold.sol:RaceIncomeHold',
            args: [DEPLOYER, CORE.raceCoin, USDT, FEE_ADMIN, CORE.raceRewardPriceOracle],
        },
    ];
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function compilerVersion(solcLongVersion) {
    return String(solcLongVersion || '').replace(/\.Emscripten\.clang$/i, '');
}

async function sourcifyLookup(address) {
    const res = await fetch(`${SOURCIFY}/v2/contract/${CHAIN_ID}/${address}?fields=all`);
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        return { verified: false, raw: text.slice(0, 120) };
    }
    if (!res.ok) {
        return { verified: false, status: res.status, json };
    }
    const match = json.match || json.runtimeMatch || json.creationMatch;
    return {
        verified: Boolean(match && match !== 'unverified' && match !== 'null'),
        match,
        json,
    };
}

async function sourcifyVerify(job) {
    const existing = await sourcifyLookup(job.address);
    if (existing.verified) {
        return { ok: true, already: true, match: existing.match };
    }

    const buildInfo = await hre.artifacts.getBuildInfo(job.fqn);
    if (!buildInfo) {
        throw new Error(`No buildInfo for ${job.fqn}`);
    }

    const body = {
        stdJsonInput: buildInfo.input,
        compilerVersion: compilerVersion(buildInfo.solcLongVersion),
        contractIdentifier: job.fqn,
    };
    if (job.creationTx) {
        body.creationTransactionHash = job.creationTx;
    }

    const submit = await fetch(`${SOURCIFY}/v2/verify/${CHAIN_ID}/${job.address}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const submitText = await submit.text();
    let submitJson;
    try {
        submitJson = JSON.parse(submitText);
    } catch {
        throw new Error(`Sourcify submit HTML/non-JSON (${submit.status}): ${submitText.slice(0, 160)}`);
    }
    if (!submit.ok && !submitJson.verificationId) {
        throw new Error(`Sourcify submit ${submit.status}: ${JSON.stringify(submitJson).slice(0, 300)}`);
    }

    const id = submitJson.verificationId;
    if (!id) {
        const lookup = await sourcifyLookup(job.address);
        if (lookup.verified) {
            return { ok: true, already: true, match: lookup.match };
        }
        throw new Error(`No verificationId: ${JSON.stringify(submitJson).slice(0, 300)}`);
    }

    for (let i = 0; i < 24; i += 1) {
        await sleep(2500);
        const jobRes = await fetch(`${SOURCIFY}/v2/verify/${id}`);
        const jobJson = await jobRes.json();
        const done =
            jobJson.isJobCompleted === true ||
            jobJson.status === 'completed' ||
            jobJson.status === 'success' ||
            Boolean(jobJson.match && jobJson.match !== 'unverified');
        const failed =
            jobJson.isJobCompleted === true && (jobJson.error || jobJson.jobError || jobJson.status === 'error');
        if (failed) {
            throw new Error(JSON.stringify(jobJson.error || jobJson.jobError || jobJson).slice(0, 300));
        }
        if (done) {
            const lookup = await sourcifyLookup(job.address);
            return {
                ok: lookup.verified || Boolean(jobJson.match),
                match: lookup.match || jobJson.match || jobJson.status,
                job: jobJson,
            };
        }
    }
    throw new Error('Sourcify poll timeout');
}

function ctorTypes(job) {
    switch (job.name) {
        case 'RaceMultiSig':
            return ['address[5]'];
        case 'RaceCoin':
            return ['address', 'address', 'address', 'address', 'address'];
        case 'RaceTreasury':
            return ['address', 'address', 'address'];
        case 'RaceRewardVault':
            return ['address', 'address'];
        case 'RaceCommunityEngine':
            return ['address', 'address', 'address', 'address', 'address'];
        case 'RaceICO':
            return ['address', 'address', 'address', 'address'];
        case 'ICOContract':
            return ['address', 'address', 'address'];
        case 'RaceRewardPriceOracle':
            return ['address', 'uint256', 'uint64', 'uint256', 'uint256'];
        case 'RaceIncomeHold':
            return ['address', 'address', 'address', 'address', 'address'];
        default:
            throw new Error(`No ctor types for ${job.name}`);
    }
}

async function etherscanVerified(address, apiKey) {
    const url = `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    const json = await res.json();
    const src = json.result?.[0]?.SourceCode;
    return Boolean(src && src !== '');
}

async function etherscanVerify(job, apiKey) {
    if (await etherscanVerified(job.address, apiKey)) {
        return { ok: true, already: true };
    }

    const buildInfo = await hre.artifacts.getBuildInfo(job.fqn);
    if (!buildInfo?.input) {
        throw new Error(`No local standard-json for ${job.fqn}`);
    }

    const ctor = hre.ethers.AbiCoder.defaultAbiCoder().encode(ctorTypes(job), job.args).replace(/^0x/i, '');
    const body = new URLSearchParams({
        module: 'contract',
        action: 'verifysourcecode',
        apikey: apiKey,
        contractaddress: job.address,
        sourceCode: JSON.stringify(buildInfo.input),
        codeformat: 'solidity-standard-json-input',
        contractname: job.fqn,
        compilerversion: 'v0.8.20+commit.a1b79de6',
        constructorArguments: ctor,
        licenseType: '3',
    });

    let submitJson;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            const submit = await fetch(`https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
                signal: AbortSignal.timeout(90_000),
            });
            submitJson = await submit.json();
            break;
        } catch (e) {
            if (attempt === 3) throw e;
            await sleep(3000);
        }
    }

    if (/already verified/i.test(String(submitJson.result || ''))) {
        return { ok: true, already: true };
    }
    if (String(submitJson.status) !== '1') {
        throw new Error(`BscScan submit: ${JSON.stringify(submitJson).slice(0, 300)}`);
    }

    const guid = submitJson.result;
    for (let i = 0; i < 24; i += 1) {
        await sleep(4000);
        const checkUrl = `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=contract&action=checkverifystatus&guid=${encodeURIComponent(guid)}&apikey=${encodeURIComponent(apiKey)}`;
        const check = await fetch(checkUrl, { signal: AbortSignal.timeout(60_000) });
        const checkJson = await check.json();
        const msg = `${checkJson.result || ''} ${checkJson.message || ''}`;
        if (/already verified|pass - verified/i.test(msg)) {
            return { ok: true, already: /already verified/i.test(msg) };
        }
        if (/fail|error/i.test(String(checkJson.status)) && !/pending/i.test(msg)) {
            throw new Error(`BscScan status: ${JSON.stringify(checkJson).slice(0, 300)}`);
        }
    }
    throw new Error('BscScan poll timeout');
}

async function main() {
    const net = await hre.ethers.provider.getNetwork();
    if (Number(net.chainId) !== CHAIN_ID) {
        throw new Error(`Expected BSC 56, got ${net.chainId}`);
    }

    const apiKey = process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY || '';
    console.log('BscScan key:', apiKey ? 'yes' : 'no (Sourcify v2 only)');

    const token = await hre.ethers.getContractAt('RaceCoin', CORE.raceCoin);
    console.log('Live RaceCoin', await token.symbol(), 'MAX_SUPPLY', hre.ethers.formatEther(await token.MAX_SUPPLY()));

    const results = [];
    for (const job of jobs()) {
        process.stdout.write(`Sourcify ${job.name} … `);
        try {
            const r = await sourcifyVerify(job);
            console.log(r.already ? `ALREADY ${r.match || ''}` : `OK ${r.match || ''}`);
            results.push({ name: job.name, address: job.address, sourcify: r.already ? 'ALREADY' : 'OK', match: r.match });
        } catch (e) {
            console.log('FAIL');
            console.log('  ', (e.message || String(e)).slice(0, 280));
            results.push({ name: job.name, address: job.address, sourcify: 'FAIL', error: (e.message || String(e)).slice(0, 280) });
        }

        if (apiKey) {
            process.stdout.write(`  BscScan ${job.name} … `);
            try {
                const r = await etherscanVerify(job, apiKey);
                console.log(r.already ? 'ALREADY' : 'OK');
                results[results.length - 1].bscscan = r.already ? 'ALREADY' : 'OK';
            } catch (e) {
                const msg = e.message || String(e);
                const already = /already verified/i.test(msg);
                console.log(already ? 'ALREADY' : 'FAIL');
                if (!already) console.log('   ', msg.split('\n')[0].slice(0, 220));
                results[results.length - 1].bscscan = already ? 'ALREADY' : 'FAIL';
            }
        }
    }

    console.log('\n=== SUMMARY ===');
    for (const row of results) {
        console.log(
            `${String(row.sourcify).padEnd(8)} ${row.name.padEnd(22)} https://repo.sourcify.dev/${CHAIN_ID}/${row.address}`,
        );
        console.log(`         BscScan  https://bscscan.com/address/${row.address}#code`);
    }
    if (!apiKey) {
        console.log('\nBscScan publish: set BSCSCAN_API_KEY in contracts/.env (etherscan.io API key), then run npm run verify:mainnet');
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
