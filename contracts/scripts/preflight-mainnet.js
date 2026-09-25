/**
 * MAINNET PREFLIGHT — must PASS before deploy:mainnet.
 * Never prints private keys. Does not deploy.
 *
 *   npm run preflight:mainnet
 */
const fs = require('fs');
const { ethers } = require('ethers');
const {
    loadContractsEnv,
    looksLikePlaceholderKey,
    resolveUsdt,
    resolvePancakeRouter,
    resolveMultisigSignersRaw,
    ENV_PATH,
} = require('./lib/loadContractsEnv');

loadContractsEnv();

const MAINNET_USDT = '0x55d398326f99059ff775485246999027b3197955';
const MAINNET_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

async function main() {
    const errors = [];

    if (!fs.existsSync(ENV_PATH)) {
        console.error('STOP: contracts/.env missing');
        process.exitCode = 1;
        return;
    }

    if (process.env.DEPLOY_ENV !== 'mainnet') {
        errors.push('DEPLOY_ENV must be mainnet');
    }
    if (process.env.CONFIRM_MAINNET_DEPLOYMENT !== 'YES') {
        errors.push('CONFIRM_MAINNET_DEPLOYMENT must be YES');
    }
    if (process.env.EXPECTED_CHAIN_ID && Number(process.env.EXPECTED_CHAIN_ID) !== 56) {
        errors.push('EXPECTED_CHAIN_ID must be 56');
    }
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        errors.push('DEPLOYER_PRIVATE_KEY missing/placeholder');
    }
    if (!process.env.RACE_REWARD_PRICE_USDT || String(process.env.RACE_REWARD_PRICE_USDT).trim() === '1') {
        errors.push('RACE_REWARD_PRICE_USDT must be real mainnet price (not 1)');
    }
    if (!process.env.ICO_ADMIN_WALLET || !String(process.env.ICO_ADMIN_WALLET).trim()) {
        errors.push('ICO_ADMIN_WALLET required');
    }
    if (!process.env.FEE_ADMIN_WALLET || !String(process.env.FEE_ADMIN_WALLET).trim()) {
        errors.push('FEE_ADMIN_WALLET required (admin $1 / 1% fees)');
    }
    if (process.env.HARDEN_GOVERNANCE !== '1' && process.env.HARDEN_GOVERNANCE !== 'true') {
        errors.push('HARDEN_GOVERNANCE should be 1 on mainnet');
    }

    let usdt = resolveUsdt() || MAINNET_USDT;
    let router = resolvePancakeRouter() || MAINNET_ROUTER;
    // Mainnet deploy must never use testnet router/USDT even if leftover in env.
    if (process.env.DEPLOY_ENV === 'mainnet') {
        usdt = MAINNET_USDT;
        router = MAINNET_ROUTER;
    }
    try {
        usdt = ethers.getAddress(usdt);
        router = ethers.getAddress(router);
    } catch {
        errors.push('Invalid USDT or PANCAKE_ROUTER');
    }
    if (usdt.toLowerCase() !== MAINNET_USDT.toLowerCase()) {
        errors.push(`USDT must be mainnet BUSD/USDT ${MAINNET_USDT} (got ${usdt})`);
    }
    if (router.toLowerCase() !== MAINNET_ROUTER.toLowerCase()) {
        errors.push(`PANCAKE_ROUTER must be mainnet ${MAINNET_ROUTER} (got ${router})`);
    }

    let signers = [];
    try {
        signers = resolveMultisigSignersRaw().map((a) => ethers.getAddress(a));
    } catch (e) {
        errors.push(`MULTISIG_SIGNERS invalid: ${e.message}`);
    }
    if (signers.length !== 5) {
        errors.push(`MULTISIG_SIGNERS need exactly 5 addresses (got ${signers.length})`);
    }
    if (new Set(signers.map((s) => s.toLowerCase())).size !== signers.length) {
        errors.push('MULTISIG_SIGNERS must be unique');
    }

    const rpc =
        process.env.BSC_MAINNET_RPC ||
        process.env.BSC_RPC_URL ||
        'https://bsc-dataseed.binance.org';
    const provider = new ethers.JsonRpcProvider(rpc);
    let chainId;
    try {
        const net = await provider.getNetwork();
        chainId = Number(net.chainId);
        if (chainId !== 56) {
            errors.push(`RPC chainId is ${chainId}, expected 56`);
        }
    } catch (e) {
        errors.push(`RPC failed: ${e.message}`);
    }

    let deployer = '—';
    let bal = '—';
    if (!looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        try {
            const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
            deployer = wallet.address;
            const wei = await provider.getBalance(deployer);
            bal = ethers.formatEther(wei);
            if (wei < ethers.parseEther('0.01')) {
                errors.push(`Deployer BNB low (${bal}). Need ≥ 0.01 BNB on ${deployer}`);
            } else if (wei < ethers.parseEther('0.05')) {
                console.warn(`WARN: Only ${bal} BNB — deploy may work at low gas; keep spare BNB ready.`);
            }
        } catch (e) {
            errors.push(`Deployer wallet error: ${e.message}`);
        }
    }

    console.log('=== MAINNET PREFLIGHT ===');
    console.log('RPC:            ', rpc);
    console.log('Chain:          ', chainId ?? '—');
    console.log('Deployer:       ', deployer);
    console.log('BNB balance:    ', bal);
    console.log('USDT:           ', usdt);
    console.log('Pancake:        ', router);
    console.log('ICO admin:      ', process.env.ICO_ADMIN_WALLET || '—');
    console.log('Fee admin:      ', process.env.FEE_ADMIN_WALLET || '—');
    console.log('Oracle price:   ', process.env.RACE_REWARD_PRICE_USDT || '—');
    console.log('Multisig (5):   ', signers.length ? signers.join(', ') : '—');
    console.log('CONFIRM:        ', process.env.CONFIRM_MAINNET_DEPLOYMENT || '—');
    console.log('');

    if (errors.length) {
        console.error('FAIL — fix before deploy:mainnet:');
        for (const e of errors) console.error(' -', e);
        process.exitCode = 1;
        return;
    }

    console.log('PASS — ready for: npm run deploy:mainnet');
    console.log('This will spend REAL BNB and mint 1,000,000 RACE on chain 56.');
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
