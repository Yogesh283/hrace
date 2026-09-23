/**
 * Shared BSC Testnet network / address / balance helpers.
 * Never logs private keys or secret values.
 */
const { ethers } = require('ethers');
const {
    loadContractsEnv,
    envFirst,
    resolveTestnetRpc,
    resolveTestnetRpcList,
    resolveUsdt,
    resolvePancakeRouter,
    resolveMultisigSignersRaw,
    resolveGovernanceMembersRaw,
    looksLikePlaceholderKey,
} = require('./loadContractsEnv');

const MAINNET_USDT = '0x55d398326f99059ff775485246999027b3197955';
const MAINNET_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const MIN_RECOMMENDED_TBNB = 0.2;
const PREFERRED_TBNB = 0.3;
const DEFAULT_RPC_TIMEOUT_MS = 12_000;

function isLikelyMainnetRpc(rpc) {
    if (!rpc) return false;
    const s = String(rpc);
    if (/testnet|seed-prebsc|chapel/i.test(s)) return false;
    return /bsc-dataseed|bsc-mainnet|binance\.org\/(?!.*test)|mainnet/i.test(s);
}

function redactRpc(rpc) {
    try {
        const u = new URL(rpc);
        return `${u.protocol}//${u.host}${u.pathname === '/' ? '' : u.pathname}`;
    } catch {
        return '(invalid-rpc-url)';
    }
}

function rpcTimeoutMs() {
    const n = Number(envFirst('BSC_TESTNET_RPC_TIMEOUT_MS') || DEFAULT_RPC_TIMEOUT_MS);
    if (!Number.isFinite(n) || n < 3000) return DEFAULT_RPC_TIMEOUT_MS;
    if (n > 30_000) return 30_000;
    return Math.floor(n);
}

function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(
                Object.assign(new Error(`request timeout (${label}, ${ms}ms)`), {
                    code: 'TIMEOUT',
                }),
            );
        }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function assertTestnetEnvFlags({ requireConfirm = true } = {}) {
    const errors = [];
    const deployEnv = envFirst('DEPLOY_ENV');
    const confirm = envFirst('CONFIRM_TESTNET_DEPLOYMENT');
    if (deployEnv !== 'testnet') {
        errors.push('DEPLOY_ENV must be exactly "testnet" (set in contracts/.env)');
    }
    if (requireConfirm && confirm !== 'YES') {
        errors.push('CONFIRM_TESTNET_DEPLOYMENT must be YES');
    }
    return { deployEnv: deployEnv || '(unset)', confirm: confirm || '(unset)', errors };
}

function parseUniqueAddresses(rawList, { label, exactCount, minCount, maxCount }) {
    const errors = [];
    const list = [];
    const seen = new Set();
    for (let i = 0; i < rawList.length; i++) {
        const raw = rawList[i];
        if (!raw || raw.includes('...') || /^0x\.+$/i.test(raw)) {
            errors.push(`${label}[${i}] is placeholder/missing`);
            continue;
        }
        let addr;
        try {
            addr = ethers.getAddress(raw);
        } catch {
            errors.push(`${label}[${i}] malformed: ${raw}`);
            continue;
        }
        if (addr === ethers.ZeroAddress) {
            errors.push(`${label}[${i}] is zero address`);
            continue;
        }
        const k = addr.toLowerCase();
        if (seen.has(k)) {
            errors.push(`${label} duplicate: ${addr}`);
            continue;
        }
        seen.add(k);
        list.push(addr);
    }
    if (exactCount !== undefined && list.length !== exactCount) {
        errors.push(`${label} requires exactly ${exactCount} unique addresses (got ${list.length})`);
    }
    if (minCount !== undefined && list.length < minCount) {
        errors.push(`${label} requires at least ${minCount} (got ${list.length})`);
    }
    if (maxCount !== undefined && list.length > maxCount) {
        errors.push(`${label} allows at most ${maxCount} (got ${list.length})`);
    }
    return { list, errors };
}

function classifyTbnb(balanceEth) {
    const n = Number(balanceEth);
    if (!Number.isFinite(n) || n <= 0) return 'ZERO';
    if (n < MIN_RECOMMENDED_TBNB) return 'LOW';
    return 'SUFFICIENT';
}

function readinessLabel(tier) {
    if (tier === 'ZERO') return 'NOT READY (0 tBNB)';
    if (tier === 'LOW') return `LOW (recommended ≥ ${MIN_RECOMMENDED_TBNB}, preferred ≥ ${PREFERRED_TBNB})`;
    return `READY (preferred ≥ ${PREFERRED_TBNB})`;
}

function createTestnetProvider(rpc) {
    return new ethers.JsonRpcProvider(rpc, 97, { staticNetwork: true });
}

/**
 * Connect to BSC Testnet using BSC_TESTNET_RPC then optional fallbacks.
 * Shared by balance / wallets / preflight / deployment checks.
 */
async function connectTestnetProvider({ log = true } = {}) {
    loadContractsEnv();
    const timeoutMs = rpcTimeoutMs();
    const candidates = resolveTestnetRpcList();
    const flagErrors = [];

    if (!candidates.length) {
        flagErrors.push('STOP: No Testnet RPC configured');
        return { provider: null, rpc: null, chainId: 0, blockNumber: null, flagErrors };
    }

    for (let i = 0; i < candidates.length; i++) {
        const rpc = candidates[i];
        const label = redactRpc(rpc);
        if (log) console.log(`[RPC] trying ${label}`);

        if (isLikelyMainnetRpc(rpc)) {
            if (log) console.log('[RPC] failed -> mainnet RPC refused (never use chain 56)');
            continue;
        }

        try {
            const provider = createTestnetProvider(rpc);
            const net = await withTimeout(provider.getNetwork(), timeoutMs, 'getNetwork');
            const chainId = Number(net.chainId);
            if (chainId !== 97) {
                if (log) console.log(`[RPC] failed -> chainId=${chainId} (need 97)`);
                continue;
            }
            if (log) console.log('[RPC] chainId=97');

            const blockNumber = await withTimeout(provider.getBlockNumber(), timeoutMs, 'getBlockNumber');
            if (log) console.log(`[RPC] block=${blockNumber}`);
            if (log) console.log('[RPC] selected');

            return { provider, rpc, chainId, blockNumber, flagErrors: [] };
        } catch (e) {
            const msg = e && e.message ? e.message : String(e);
            if (log) {
                if (i < candidates.length - 1) {
                    console.log(`[RPC] failed (${msg}) -> trying fallback`);
                } else {
                    console.log(`[RPC] failed (${msg})`);
                }
            }
        }
    }

    flagErrors.push(
        'STOP: All configured Testnet RPCs failed (timeout/unreachable). Set BSC_TESTNET_RPC and optional BSC_TESTNET_RPC_FALLBACK_1/2.',
    );
    return { provider: null, rpc: candidates[0] || null, chainId: 0, blockNumber: null, flagErrors };
}

async function getBalanceSafe(provider, address, { timeoutMs = rpcTimeoutMs(), retries = 1 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await withTimeout(provider.getBalance(address), timeoutMs, 'getBalance');
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr;
}

function getDeployerWallet(provider) {
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        return { error: 'DEPLOYER_PRIVATE_KEY missing or placeholder', wallet: null };
    }
    try {
        return { wallet: new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider), error: null };
    } catch {
        return { error: 'DEPLOYER_PRIVATE_KEY invalid', wallet: null };
    }
}

function validateTestnetTokenConfig() {
    const errors = [];
    const usdt = resolveUsdt();
    const router = resolvePancakeRouter();
    if (!usdt) errors.push('Missing USDT / TESTNET_USDT_ADDRESS');
    if (!router) errors.push('Missing PANCAKE_ROUTER / PANCAKE_ROUTER_ADDRESS');
    if (usdt) {
        try {
            const a = ethers.getAddress(usdt);
            if (a === ethers.ZeroAddress) errors.push('USDT is zero address');
            if (a.toLowerCase() === MAINNET_USDT.toLowerCase()) {
                errors.push('USDT is BSC Mainnet USDT — refused for testnet');
            }
        } catch {
            errors.push('USDT address malformed');
        }
    }
    if (router) {
        try {
            const a = ethers.getAddress(router);
            if (a === ethers.ZeroAddress) errors.push('PANCAKE_ROUTER is zero address');
            if (a.toLowerCase() === MAINNET_ROUTER.toLowerCase()) {
                errors.push('PANCAKE_ROUTER is BSC Mainnet router — refused for testnet');
            }
        } catch {
            errors.push('PANCAKE_ROUTER address malformed');
        }
    }
    return { usdt, router, errors };
}

module.exports = {
    MAINNET_USDT,
    MAINNET_ROUTER,
    MIN_RECOMMENDED_TBNB,
    PREFERRED_TBNB,
    DEFAULT_RPC_TIMEOUT_MS,
    isLikelyMainnetRpc,
    redactRpc,
    assertTestnetEnvFlags,
    parseUniqueAddresses,
    classifyTbnb,
    readinessLabel,
    connectTestnetProvider,
    getBalanceSafe,
    getDeployerWallet,
    validateTestnetTokenConfig,
    resolveMultisigSignersRaw,
    resolveGovernanceMembersRaw,
    resolveTestnetRpc,
    envFirst,
    loadContractsEnv,
};
