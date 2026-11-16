/**
 * Verify RaceCoin 0x093C8ebE… on Sourcify + BscScan (if API key present).
 *   npx hardhat run scripts/verify-racecoin-093c.js --network bsc
 */
const hre = require('hardhat');
const { loadContractsEnv } = require('./lib/loadContractsEnv');

loadContractsEnv();

const CHAIN_ID = 56;
const SOURCIFY = 'https://sourcify.dev/server';
const ADDRESS = '0x093C8ebEdd1248f96E3dfbC4941059c3dbBb495C';
const DEPLOYER = '0x3F82B1CaCC6Fa52eE9F28A8964a78786d9ed50D8';
const ARGS = [DEPLOYER, DEPLOYER, DEPLOYER, DEPLOYER, DEPLOYER];

function compilerVersion(solcLongVersion) {
    return String(solcLongVersion || '').replace(/\.Emscripten\.clang$/i, '');
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function sourcifyLookup(address) {
    const res = await fetch(`${SOURCIFY}/v2/contract/${CHAIN_ID}/${address}?fields=all`);
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        return { verified: false, raw: text.slice(0, 160) };
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

async function sourcifyVerify(fqn) {
    const existing = await sourcifyLookup(ADDRESS);
    if (existing.verified) {
        return { ok: true, already: true, match: existing.match };
    }

    const buildInfo = await hre.artifacts.getBuildInfo(fqn);
    if (!buildInfo) {
        throw new Error(`No buildInfo for ${fqn}`);
    }

    const body = {
        stdJsonInput: buildInfo.input,
        compilerVersion: compilerVersion(buildInfo.solcLongVersion),
        contractIdentifier: fqn,
    };

    const submit = await fetch(`${SOURCIFY}/v2/verify/${CHAIN_ID}/${ADDRESS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const submitText = await submit.text();
    let submitJson;
    try {
        submitJson = JSON.parse(submitText);
    } catch {
        throw new Error(`Sourcify submit HTML/non-JSON (${submit.status}): ${submitText.slice(0, 200)}`);
    }
    if (!submit.ok && !submitJson.verificationId) {
        throw new Error(`Sourcify submit ${submit.status}: ${JSON.stringify(submitJson).slice(0, 400)}`);
    }

    const id = submitJson.verificationId;
    if (!id) {
        const lookup = await sourcifyLookup(ADDRESS);
        if (lookup.verified) {
            return { ok: true, already: true, match: lookup.match };
        }
        throw new Error(`No verificationId: ${JSON.stringify(submitJson).slice(0, 400)}`);
    }

    for (let i = 0; i < 24; i += 1) {
        await sleep(2500);
        const jobRes = await fetch(`${SOURCIFY}/v2/verify/${id}`);
        const jobJson = await jobRes.json();
        const failed =
            jobJson.isJobCompleted === true && (jobJson.error || jobJson.jobError || jobJson.status === 'error');
        if (failed) {
            throw new Error(JSON.stringify(jobJson.error || jobJson.jobError || jobJson).slice(0, 400));
        }
        const done =
            jobJson.isJobCompleted === true ||
            jobJson.status === 'completed' ||
            jobJson.status === 'success' ||
            Boolean(jobJson.match && jobJson.match !== 'unverified');
        if (done) {
            const lookup = await sourcifyLookup(ADDRESS);
            return {
                ok: lookup.verified || Boolean(jobJson.match),
                match: lookup.match || jobJson.match || jobJson.status,
            };
        }
    }
    throw new Error('Sourcify poll timeout');
}

async function main() {
    const net = await hre.ethers.provider.getNetwork();
    if (Number(net.chainId) !== CHAIN_ID) {
        throw new Error(`Expected BSC 56, got ${net.chainId}`);
    }

    const token = await hre.ethers.getContractAt('RaceCoin', ADDRESS);
    const [name, symbol, supply, max, owner] = await Promise.all([
        token.name(),
        token.symbol(),
        token.totalSupply(),
        token.MAX_SUPPLY(),
        token.owner(),
    ]);
    console.log('Live token', name, symbol);
    console.log('totalSupply', hre.ethers.formatEther(supply), 'MAX_SUPPLY', hre.ethers.formatEther(max));
    console.log('owner', owner);

    const fqn = Number(hre.ethers.formatEther(supply)) >= 149_000_000
        ? 'src/RaceCoinBsc.sol:RaceCoinBsc'
        : 'src/RaceCoin.sol:RaceCoin';
    console.log('Verify as', fqn);

    if (process.env.SKIP_SOURCIFY !== '1') {
        try {
            process.stdout.write('Sourcify … ');
            const sourcify = await sourcifyVerify(fqn);
            console.log(sourcify.already ? `ALREADY ${sourcify.match || ''}` : `OK ${sourcify.match || ''}`);
        } catch (e) {
            console.log('SKIP', (e.message || String(e)).slice(0, 80));
        }
    }

    const apiKey = process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY || '';
    if (!apiKey) {
        console.log('BscScan: no BSCSCAN_API_KEY / ETHERSCAN_API_KEY — cannot publish ABI to bscscan.com');
        console.log(`Sourcify: https://repo.sourcify.dev/${CHAIN_ID}/${ADDRESS}`);
        process.exitCode = 2;
        return;
    }

    const ctor = hre.ethers.AbiCoder.defaultAbiCoder()
        .encode(['address', 'address', 'address', 'address', 'address'], ARGS)
        .replace(/^0x/i, '');

    const buildInfo = await hre.artifacts.getBuildInfo(fqn);
    if (!buildInfo?.input) {
        throw new Error(`No local standard-json for ${fqn}`);
    }

    process.stdout.write('BscScan submit … ');
    const body = new URLSearchParams({
        module: 'contract',
        action: 'verifysourcecode',
        apikey: apiKey,
        contractaddress: ADDRESS,
        sourceCode: JSON.stringify(buildInfo.input),
        codeformat: 'solidity-standard-json-input',
        contractname: fqn,
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
            console.log(`retry ${attempt} (${e.cause?.code || e.message})`);
            await sleep(3000);
        }
    }
    if (String(submitJson.status) !== '1' && !/already verified/i.test(String(submitJson.result || ''))) {
        throw new Error(`BscScan submit: ${JSON.stringify(submitJson).slice(0, 400)}`);
    }
    if (/already verified/i.test(String(submitJson.result || ''))) {
        console.log('ALREADY');
        console.log(`https://bscscan.com/address/${ADDRESS}#code`);
        return;
    }

    const guid = submitJson.result;
    console.log('guid', String(guid).slice(0, 18));
    for (let i = 0; i < 24; i += 1) {
        await sleep(4000);
        const checkUrl = `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=contract&action=checkverifystatus&guid=${encodeURIComponent(guid)}&apikey=${encodeURIComponent(apiKey)}`;
        const check = await fetch(checkUrl);
        const checkJson = await check.json();
        const msg = `${checkJson.result || ''} ${checkJson.message || ''}`;
        if (/already verified|pass - verified/i.test(msg)) {
            console.log('BscScan VERIFIED');
            console.log(`https://bscscan.com/address/${ADDRESS}#code`);
            return;
        }
        if (/fail|error/i.test(String(checkJson.status)) && !/pending/i.test(msg)) {
            throw new Error(`BscScan status: ${JSON.stringify(checkJson).slice(0, 400)}`);
        }
        process.stdout.write('.');
    }
    throw new Error('BscScan poll timeout');
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
