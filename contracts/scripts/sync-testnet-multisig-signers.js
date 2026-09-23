/**
 * Derive Multisig addresses from private keys and write ONLY addresses into contracts/.env.
 * Does not remove or rewrite private key lines.
 * Never prints private keys.
 *
 *   npm run sync:testnet-multisig-signers
 */
const fs = require('fs');
const { loadContractsEnv, ENV_PATH } = require('./lib/loadContractsEnv');
const {
    detectMultisigPrivateKeys,
    deriveAddressesFromPrivateKeys,
    PRIVATE_KEY_PREFIXES,
} = require('./lib/deriveMultisigSigners');

function readEnvRaw() {
    return fs.readFileSync(ENV_PATH, 'utf8');
}

function upsertEnvLines(raw, updates) {
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

loadContractsEnv();

if (!fs.existsSync(ENV_PATH)) {
    console.error('STOP: contracts/.env missing');
    process.exitCode = 1;
    process.exit();
}

const detected = detectMultisigPrivateKeys();
if (!detected.scheme) {
    console.error('STOP: No Multisig private keys found.');
    console.error('Add to contracts/.env (then re-run):');
    for (const p of PRIVATE_KEY_PREFIXES.slice(0, 1)) {
        for (let i = 1; i <= 5; i++) console.error(`  ${p}_${i}=<testnet_private_key>`);
    }
    process.exitCode = 1;
    process.exit();
}

const { addresses, errors } = deriveAddressesFromPrivateKeys(detected.keys);
if (errors.length || addresses.length !== 5) {
    console.error('STOP: could not derive 5 unique addresses');
    for (const e of errors) console.error('-', e);
    process.exitCode = 1;
    process.exit();
}

const updates = {
    MULTISIG_SIGNERS: addresses.join(','),
};
for (let i = 0; i < 5; i++) {
    updates[`MULTISIG_SIGNER_${i + 1}`] = addresses[i];
}

const next = upsertEnvLines(readEnvRaw(), updates);
fs.writeFileSync(ENV_PATH, next, 'utf8');

console.log('Wrote address-only Multisig config to contracts/.env');
for (let i = 0; i < 5; i++) {
    console.log(`MULTISIG_SIGNER_${i + 1}=${addresses[i]}`);
}
console.log('MULTISIG_SIGNERS=' + addresses.join(','));
console.log('Private key lines left unchanged. Private keys were not printed.');
