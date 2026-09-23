/**
 * Derive Multisig signer addresses from private keys in contracts/.env.
 * Prints addresses ONLY — never private keys.
 *
 *   npm run derive:testnet-signer-addresses
 */
const {
    loadContractsEnv,
    ENV_PATH,
} = require('./lib/loadContractsEnv');
const {
    detectMultisigPrivateKeys,
    deriveAddressesFromPrivateKeys,
    PRIVATE_KEY_PREFIXES,
} = require('./lib/deriveMultisigSigners');
const fs = require('fs');

loadContractsEnv();

if (!fs.existsSync(ENV_PATH)) {
    console.error('STOP: contracts/.env missing');
    process.exitCode = 1;
} else {
    const detected = detectMultisigPrivateKeys();
    console.log('Private-key scheme:', detected.scheme || '(none found)');
    if (!detected.scheme) {
        console.error('STOP: No Multisig private keys found in contracts/.env');
        console.error('Supported names:');
        for (const p of PRIVATE_KEY_PREFIXES) {
            console.error(`  ${p}_1 .. ${p}_5`);
        }
        console.error('  MULTISIG_PRIVATE_KEYS=<key1>,<key2>,<key3>,<key4>,<key5>');
        console.error('Save the file, then re-run. Private keys are never printed.');
        process.exitCode = 1;
    } else {
        const { addresses, errors } = deriveAddressesFromPrivateKeys(detected.keys);
        if (errors.length) {
            console.error('STOP: validation failed');
            for (const e of errors) console.error('-', e);
            process.exitCode = 1;
        } else {
            addresses.forEach((a, i) => {
                console.log(`Signer ${i + 1}: ${a}`);
                console.log(`MULTISIG_SIGNER_${i + 1}=${a}`);
            });
            console.log('MULTISIG_SIGNERS=' + addresses.join(','));
            console.log('Private keys were not printed.');
        }
    }
}
