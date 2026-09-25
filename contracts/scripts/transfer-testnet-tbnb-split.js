/**
 * Split deployer's remaining tBNB across TRANSFER_BATCH wallets (testnet 97).
 * Use when deployer is too low for full TRANSFER_AMOUNT each.
 */
const hre = require('hardhat');
const { loadContractsEnv, envFirst, looksLikePlaceholderKey } = require('./lib/loadContractsEnv');

const EVmAddressRe = /^0x[a-fA-F0-9]{40}$/;

function parseRecipients() {
    const raw = envFirst('TRANSFER_BATCH', 'TESTNET_TBNB_BATCH') || '';
    const list = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) throw new Error('STOP: set TRANSFER_BATCH=0xAddr1,0xAddr2,...');
    return list.map((a) => {
        if (!EVmAddressRe.test(a)) throw new Error(`STOP: invalid address ${a}`);
        return hre.ethers.getAddress(a);
    });
}

async function main() {
    loadContractsEnv();
    const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
    if (chainId !== 97) throw new Error(`STOP: chainId must be 97 (got ${chainId})`);
    if (envFirst('DEPLOY_ENV') !== 'testnet') throw new Error('STOP: DEPLOY_ENV=testnet required');
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        throw new Error('STOP: DEPLOYER_PRIVATE_KEY missing/placeholder');
    }
    if (envFirst('CONFIRM_TBNB_TRANSFER') !== 'YES') throw new Error('STOP: CONFIRM_TBNB_TRANSFER=YES');

    const recipients = parseRecipients();
    const [sender] = await hre.ethers.getSigners();
    let balance = await hre.ethers.provider.getBalance(sender.address);
    const feeData = await hre.ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
    if (!gasPrice) throw new Error('STOP: no gas price');

    const gasPerTx = 21_000n;
    const gasCostEach = gasPerTx * gasPrice;
    const n = BigInt(recipients.length);
    const totalGas = gasCostEach * n;
    if (balance <= totalGas) {
        throw new Error(
            `STOP: deployer ${sender.address} has ${hre.ethers.formatEther(balance)} tBNB; ` +
                `need > ${hre.ethers.formatEther(totalGas)} for gas alone. Fund deployer via faucet.`,
        );
    }

    const distributable = balance - totalGas;
    const each = distributable / n;
    if (each < 1n) throw new Error('STOP: per-wallet amount too small after gas');

    console.log('SENDER:', sender.address);
    console.log('RECIPIENTS:', recipients.length);
    console.log('EACH (~):', hre.ethers.formatEther(each), 'tBNB');

    for (const recipient of recipients) {
        const tx = await sender.sendTransaction({ to: recipient, value: each, gasLimit: gasPerTx });
        const receipt = await tx.wait();
        console.log('OK', recipient, hre.ethers.formatEther(each), receipt.hash);
    }
    const left = await hre.ethers.provider.getBalance(sender.address);
    console.log('SENDER_BALANCE_END:', hre.ethers.formatEther(left));
    console.log('STATUS: PASS');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
