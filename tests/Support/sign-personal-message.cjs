const { Wallet } = require('../../contracts/node_modules/ethers');

const message = process.argv[2] ?? '';
const privateKey = process.argv[3] ?? '';

if (!message || !privateKey) {
    process.stderr.write('usage: node sign-personal-message.cjs <message> <privateKey>\n');
    process.exit(1);
}

new Wallet(privateKey)
    .signMessage(message)
    .then((sig) => {
        process.stdout.write(sig);
    })
    .catch((err) => {
        process.stderr.write(String(err?.message ?? err));
        process.exit(1);
    });
