/**
 * Load contracts/.env into process.env (does not override existing env).
 * Supports alias names used in operator templates.
 * Never logs secret values.
 */
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '..', '.env');
const LARAVEL_ENV_PATH = path.join(__dirname, '..', '..', '..', '.env');

function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const out = {};
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const i = t.indexOf('=');
        if (i < 0) continue;
        const k = t.slice(0, i).trim();
        let v = t.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
        }
        out[k] = v;
    }
    return out;
}

function applyToProcessEnv(parsed) {
    for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] === undefined) {
            process.env[k] = v;
        }
    }
}

/** First non-empty among keys (process.env already loaded). */
function envFirst(...keys) {
    for (const k of keys) {
        const v = process.env[k];
        if (v !== undefined && String(v).trim() !== '') return String(v).trim();
    }
    return '';
}

/** MULTISIG_SIGNER_1..5 or GOVERNANCE_MEMBER_1..12 */
function collectIndexed(prefix, max) {
    const list = [];
    for (let i = 1; i <= max; i++) {
        const v = process.env[`${prefix}_${i}`];
        if (v && String(v).trim()) list.push(String(v).trim());
    }
    return list;
}

function resolveMultisigSignersRaw() {
    const csv = envFirst('MULTISIG_SIGNERS');
    if (csv) return csv.split(',').map((s) => s.trim()).filter(Boolean);
    return collectIndexed('MULTISIG_SIGNER', 5);
}

function resolveGovernanceMembersRaw() {
    const csv = envFirst('GOVERNANCE_MEMBERS');
    if (csv) return csv.split(',').map((s) => s.trim()).filter(Boolean);
    return collectIndexed('GOVERNANCE_MEMBER', 12);
}

function resolveUsdt() {
    return envFirst('USDT', 'TESTNET_USDT_ADDRESS', 'TESTNET_USDT');
}

function resolvePancakeRouter() {
    return envFirst('PANCAKE_ROUTER', 'PANCAKE_ROUTER_ADDRESS');
}

function resolveTestnetRpc() {
    return (
        envFirst('BSC_TESTNET_RPC', 'BSC_TESTNET_RPC_URL') ||
        'https://data-seed-prebsc-1-s1.binance.org:8545'
    );
}

/** Primary + optional fallbacks (order preserved, duplicates removed). */
function resolveTestnetRpcList() {
    const list = [
        resolveTestnetRpc(),
        envFirst('BSC_TESTNET_RPC_FALLBACK_1'),
        envFirst('BSC_TESTNET_RPC_FALLBACK_2'),
    ].filter(Boolean);
    const seen = new Set();
    const out = [];
    for (const url of list) {
        const key = url.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(url.trim());
    }
    return out;
}

function looksLikePlaceholderKey(pk) {
    if (!pk) return true;
    const s = pk.trim();
    if (/YOUR_|PLACEHOLDER|CHANGE_ME|xxx/i.test(s)) return true;
    if (/^0x0+$/i.test(s)) return true;
    // ethers accepts 64 hex chars with optional 0x
    const hex = s.startsWith('0x') ? s.slice(2) : s;
    return !/^[0-9a-fA-F]{64}$/.test(hex);
}

function loadContractsEnv() {
    applyToProcessEnv(parseEnvFile(LARAVEL_ENV_PATH));
    applyToProcessEnv(parseEnvFile(ENV_PATH));
    if (!process.env.DEPLOY_ENV && String(process.env.BSC_CHAIN_ID || '') === '97') {
        process.env.DEPLOY_ENV = 'testnet';
    }
    // Normalize aliases into canonical keys (only if canonical empty).
    const usdt = resolveUsdt();
    if (usdt && !process.env.USDT) process.env.USDT = usdt;
    const router = resolvePancakeRouter();
    if (router && !process.env.PANCAKE_ROUTER) process.env.PANCAKE_ROUTER = router;
    const rpc = envFirst('BSC_TESTNET_RPC', 'BSC_TESTNET_RPC_URL');
    if (rpc && !process.env.BSC_TESTNET_RPC) process.env.BSC_TESTNET_RPC = rpc;

    // Derive Multisig addresses from private keys in memory when addresses unset.
    try {
        const { applyDerivedMultisigSignersToEnv } = require('./deriveMultisigSigners');
        applyDerivedMultisigSignersToEnv();
    } catch {
        /* derive helper optional during early boot */
    }

    const ms = resolveMultisigSignersRaw();
    if (ms.length && !process.env.MULTISIG_SIGNERS) {
        process.env.MULTISIG_SIGNERS = ms.join(',');
    }
    const gm = resolveGovernanceMembersRaw();
    if (gm.length && !process.env.GOVERNANCE_MEMBERS) {
        process.env.GOVERNANCE_MEMBERS = gm.join(',');
    }
}

module.exports = {
    ENV_PATH,
    loadContractsEnv,
    envFirst,
    resolveMultisigSignersRaw,
    resolveGovernanceMembersRaw,
    resolveUsdt,
    resolvePancakeRouter,
    resolveTestnetRpc,
    resolveTestnetRpcList,
    looksLikePlaceholderKey,
};
