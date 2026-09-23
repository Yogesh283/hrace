/**
 * Mint TEST-USDT (TestnetMockUSDT) on BSC Testnet (97) only.
 * Uses the already deployed token — does NOT redeploy.
 *
 *   cd contracts
 *   MINT_TO=0xYourWallet MINT_AMOUNT=1000 npm run mint:testnet-usdt
 *
 * Requires DEPLOYER_PRIVATE_KEY (token owner / mint authority) in contracts/.env.
 * Never prints private keys.
 */
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const {
    loadContractsEnv,
    envFirst,
    resolveUsdt,
    looksLikePlaceholderKey,
} = require('./lib/loadContractsEnv');

const MANIFEST = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'deployment.json');
const TEST_USDT_ARTIFACT = path.join(__dirname, '..', 'deployments', 'bscTestnet', 'test-usdt.json');

function resolveTokenAddress() {
    if (fs.existsSync(TEST_USDT_ARTIFACT)) {
        const j = JSON.parse(fs.readFileSync(TEST_USDT_ARTIFACT, 'utf8'));
        if (j.address && Number(j.chainId) === 97) {
            return String(j.address);
        }
    }
    if (fs.existsSync(MANIFEST)) {
        const d = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
        if (d.usdt && Number(d.chainId) === 97) {
            return String(d.usdt);
        }
    }
    const fromEnv = resolveUsdt();
    if (fromEnv) {
        return fromEnv;
    }
    throw new Error('STOP: TestnetMockUSDT address not found (test-usdt.json / deployment.json / USDT env)');
}

async function main() {
    loadContractsEnv();

    const network = await hre.ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    console.log('NETWORK:', hre.network.name);
    console.log('CHAIN ID:', chainId);

    if (chainId === 56) {
        throw new Error('STOP: Mainnet (56) forbidden for TestnetMockUSDT mint');
    }
    if (chainId !== 97) {
        throw new Error(`STOP: chainId must be 97 (got ${chainId})`);
    }
    if (envFirst('DEPLOY_ENV') !== 'testnet') {
        throw new Error('STOP: DEPLOY_ENV=testnet required');
    }
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        throw new Error('STOP: DEPLOYER_PRIVATE_KEY missing/placeholder in contracts/.env');
    }

    const mintTo = envFirst('MINT_TO', 'TESTNET_USDT_MINT_TO');
    if (!mintTo || !/^0x[a-fA-F0-9]{40}$/.test(mintTo)) {
        throw new Error('STOP: set MINT_TO=0xYourWallet (BSC Testnet recipient address)');
    }

    const amountHuman = envFirst('MINT_AMOUNT', 'TESTNET_USDT_MINT_AMOUNT') || '1000';
    if (!/^\d+(\.\d+)?$/.test(amountHuman) || Number(amountHuman) <= 0) {
        throw new Error('STOP: MINT_AMOUNT must be a positive number (default 1000)');
    }

    const tokenAddress = resolveTokenAddress();
    const [minter] = await hre.ethers.getSigners();
    const token = await hre.ethers.getContractAt('TestnetMockUSDT', tokenAddress, minter);

    const owner = await token.owner();
    if (owner.toLowerCase() !== minter.address.toLowerCase()) {
        throw new Error(
            `STOP: DEPLOYER_PRIVATE_KEY (${minter.address}) is not mint authority. Owner is ${owner}`,
        );
    }

    const amountWei = hre.ethers.parseEther(amountHuman);
    const symbol = await token.symbol();
    const before = await token.balanceOf(mintTo);

    console.log('TOKEN:', tokenAddress);
    console.log('SYMBOL:', symbol);
    console.log('MINT AUTHORITY:', owner);
    console.log('RECIPIENT:', mintTo);
    console.log('AMOUNT:', amountHuman, symbol);

    const tx = await token.mint(mintTo, amountWei);
    const receipt = await tx.wait();
    const after = await token.balanceOf(mintTo);

    console.log('TX:', receipt.hash);
    console.log('BLOCK:', receipt.blockNumber);
    console.log('BALANCE_BEFORE:', hre.ethers.formatEther(before));
    console.log('BALANCE_AFTER:', hre.ethers.formatEther(after));
    console.log('STATUS: PASS');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
