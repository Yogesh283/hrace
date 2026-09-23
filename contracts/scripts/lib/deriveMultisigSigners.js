/**
 * Derive MultiSig signer addresses from private keys in contracts/.env.
 * Never logs private keys / mnemonics.
 */
const { ethers } = require('ethers');
const { envFirst, looksLikePlaceholderKey } = require('./loadContractsEnv');

const PRIVATE_KEY_PREFIXES = [
    'MULTISIG_PRIVATE_KEY',
    'MULTISIG_SIGNER_PRIVATE_KEY',
    'MULTISIG_PK',
    'SIGNER_PRIVATE_KEY',
    'MS_PRIVATE_KEY',
];

function collectIndexed(prefix, max) {
    const list = [];
    for (let i = 1; i <= max; i++) {
        const v = process.env[`${prefix}_${i}`];
        if (v && String(v).trim()) list.push(String(v).trim());
    }
    return list;
}

/** Detect which indexed private-key naming scheme is used (first complete set of 5). */
function detectMultisigPrivateKeys() {
    for (const prefix of PRIVATE_KEY_PREFIXES) {
        const keys = collectIndexed(prefix, 5);
        if (keys.length > 0) {
            return { scheme: `${prefix}_1..5`, keys, prefix };
        }
    }
    const csv = envFirst('MULTISIG_PRIVATE_KEYS');
    if (csv) {
        return {
            scheme: 'MULTISIG_PRIVATE_KEYS',
            keys: csv.split(',').map((s) => s.trim()).filter(Boolean),
            prefix: null,
        };
    }
    return { scheme: null, keys: [], prefix: null };
}

function deriveAddressesFromPrivateKeys(rawKeys) {
    const errors = [];
    const addresses = [];
    const seen = new Set();

    rawKeys.forEach((pk, i) => {
        if (looksLikePlaceholderKey(pk)) {
            errors.push(`signer key[${i + 1}] missing or placeholder`);
            return;
        }
        let wallet;
        try {
            wallet = new ethers.Wallet(pk);
        } catch {
            errors.push(`signer key[${i + 1}] invalid`);
            return;
        }
        const addr = wallet.address;
        if (addr === ethers.ZeroAddress) {
            errors.push(`signer key[${i + 1}] derives zero address`);
            return;
        }
        const k = addr.toLowerCase();
        if (seen.has(k)) {
            errors.push(`duplicate address from signer key[${i + 1}]: ${addr}`);
            return;
        }
        seen.add(k);
        addresses.push(addr);
    });

    if (rawKeys.length !== 5) {
        errors.push(`expected exactly 5 Multisig private keys (got ${rawKeys.length})`);
    }
    if (addresses.length !== 5 && rawKeys.length === 5 && errors.length === 0) {
        errors.push('failed to derive 5 unique addresses');
    }

    return { addresses, errors };
}

/**
 * If MULTISIG_SIGNERS / MULTISIG_SIGNER_* unset but private keys exist,
 * populate process.env addresses in memory (does not write disk).
 */
function applyDerivedMultisigSignersToEnv() {
    const existing = envFirst('MULTISIG_SIGNERS');
    const indexed = collectIndexed('MULTISIG_SIGNER', 5);
    if (existing || indexed.length === 5) {
        return { applied: false, reason: 'addresses_already_set' };
    }

    const detected = detectMultisigPrivateKeys();
    if (detected.keys.length === 0) {
        return { applied: false, reason: 'no_private_keys' };
    }

    const { addresses, errors } = deriveAddressesFromPrivateKeys(detected.keys);
    if (errors.length || addresses.length !== 5) {
        return { applied: false, reason: 'derive_failed', errors, scheme: detected.scheme };
    }

    process.env.MULTISIG_SIGNERS = addresses.join(',');
    for (let i = 0; i < 5; i++) {
        if (!process.env[`MULTISIG_SIGNER_${i + 1}`]) {
            process.env[`MULTISIG_SIGNER_${i + 1}`] = addresses[i];
        }
    }
    return { applied: true, addresses, scheme: detected.scheme };
}

module.exports = {
    PRIVATE_KEY_PREFIXES,
    detectMultisigPrivateKeys,
    deriveAddressesFromPrivateKeys,
    applyDerivedMultisigSignersToEnv,
};
