/**
 * Deploy TestnetMockUSDT to BSC Testnet (97) only.
 *
 *   npm run deploy:testnet-usdt
 *
 * Requires DEPLOY_ENV=testnet, CONFIRM_TESTNET_DEPLOYMENT=YES.
 * Never deploys to mainnet. Never prints private keys.
 */
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const {
    loadContractsEnv,
    ENV_PATH,
    envFirst,
} = require('./lib/loadContractsEnv');
const { looksLikePlaceholderKey } = require('./lib/loadContractsEnv');

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

async function main() {
    loadContractsEnv();

    const network = await hre.ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    console.log('NETWORK:', hre.network.name);
    console.log('CHAIN ID:', chainId);

    if (chainId === 56) {
        throw new Error('STOP: Mainnet (56) forbidden for TestnetMockUSDT');
    }
    if (chainId !== 97) {
        throw new Error(`STOP: chainId must be 97 (got ${chainId})`);
    }
    if (envFirst('DEPLOY_ENV') !== 'testnet') {
        throw new Error('STOP: DEPLOY_ENV=testnet required');
    }
    if (envFirst('CONFIRM_TESTNET_DEPLOYMENT') !== 'YES') {
        throw new Error('STOP: CONFIRM_TESTNET_DEPLOYMENT=YES required');
    }
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        throw new Error('STOP: DEPLOYER_PRIVATE_KEY missing/placeholder');
    }

    const [deployer] = await hre.ethers.getSigners();
    const faucetAdmin = envFirst('TESTNET_USDT_FAUCET_ADMIN') || deployer.address;
    console.log('DEPLOYER:', deployer.address);
    console.log('FAUCET/ADMIN (mint authority):', faucetAdmin);
    console.log('NOTE: TESTNET ONLY — NOT real USDT');

    const Factory = await hre.ethers.getContractFactory('TestnetMockUSDT');
    const token = await Factory.deploy(faucetAdmin);
    await token.waitForDeployment();
    const address = await token.getAddress();

    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const owner = await token.owner();

    console.log('TestnetMockUSDT:', address);
    console.log('name:', name);
    console.log('symbol:', symbol);
    console.log('decimals:', decimals.toString());
    console.log('owner:', owner);

    // Smoke mint tiny amount to deployer for later ICO tests
    const smoke = hre.ethers.parseEther('1000');
    const tx = await token.mint(deployer.address, smoke);
    const receipt = await tx.wait();
    console.log('SMOKE_MINT_TX:', receipt.hash);
    console.log('DEPLOYER_TEST_USDT_BALANCE:', hre.ethers.formatEther(await token.balanceOf(deployer.address)));

    const outDir = path.join(__dirname, '..', 'deployments', 'bscTestnet');
    fs.mkdirSync(outDir, { recursive: true });
    const artifact = {
        network: 'bscTestnet',
        chainId: 97,
        contract: 'TestnetMockUSDT',
        address,
        name,
        symbol,
        decimals: Number(decimals),
        mintAuthority: owner,
        deployer: deployer.address,
        deploymentTimestamp: new Date().toISOString(),
        blockNumber: await hre.ethers.provider.getBlockNumber(),
        smokeMintTx: receipt.hash,
        note: 'TESTNET ONLY — NOT real USDT / NOT for Mainnet',
    };
    const outFile = path.join(outDir, 'test-usdt.json');
    fs.writeFileSync(outFile, JSON.stringify(artifact, null, 2));
    console.log('Wrote', outFile);

    if (fs.existsSync(ENV_PATH)) {
        const next = upsertEnv(fs.readFileSync(ENV_PATH, 'utf8'), {
            USDT: address,
            TESTNET_USDT_ADDRESS: address,
        });
        fs.writeFileSync(ENV_PATH, next);
        console.log('Configured USDT (+ TESTNET_USDT_ADDRESS) in contracts/.env');
    }

    console.log('STATUS: PASS');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
