/**
 * Send tBNB to multiple wallets on BSC Testnet (97).
 *
 *   TRANSFER_BATCH=0xA,0xB,0xC TRANSFER_AMOUNT=0.005 CONFIRM_TBNB_TRANSFER=YES DEPLOY_ENV=testnet \
 *     npx hardhat run scripts/transfer-testnet-tbnb-batch.js --network bscTestnet
 */
const hre = require('hardhat');
const { loadContractsEnv, envFirst, looksLikePlaceholderKey } = require('./lib/loadContractsEnv');

const EVmAddressRe = /^0x[a-fA-F0-9]{40}$/;

function parseRecipients() {
    const raw = envFirst('TRANSFER_BATCH', 'TESTNET_TBNB_BATCH') || '';
    const list = raw
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (!list.length) {
        throw new Error('STOP: set TRANSFER_BATCH=0xAddr1,0xAddr2,...');
    }
    const out = [];
    for (const a of list) {
        if (!EVmAddressRe.test(a)) {
            throw new Error(`STOP: invalid address in batch: ${a}`);
        }
        out.push(hre.ethers.getAddress(a));
    }
    return out;
}

async function main() {
    loadContractsEnv();
    const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
    if (chainId !== 97) {
        throw new Error(`STOP: chainId must be 97 (got ${chainId})`);
    }
    if (envFirst('DEPLOY_ENV') !== 'testnet') {
        throw new Error('STOP: DEPLOY_ENV=testnet required');
    }
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        throw new Error('STOP: DEPLOYER_PRIVATE_KEY missing/placeholder');
    }
    if (envFirst('CONFIRM_TBNB_TRANSFER') !== 'YES') {
        throw new Error('STOP: set CONFIRM_TBNB_TRANSFER=YES');
    }

    const amountHuman = envFirst('TRANSFER_AMOUNT', 'TESTNET_TBNB_TRANSFER_AMOUNT') || '0.005';
    if (!/^\d+(\.\d+)?$/.test(amountHuman) || Number(amountHuman) <= 0) {
        throw new Error('STOP: TRANSFER_AMOUNT must be positive');
    }
    const amountWei = hre.ethers.parseEther(amountHuman);
    const recipients = parseRecipients();
    const [sender] = await hre.ethers.getSigners();

    console.log('SENDER:', sender.address);
    console.log('RECIPIENTS:', recipients.length);
    console.log('EACH:', amountHuman, 'tBNB');

    let balance = await hre.ethers.provider.getBalance(sender.address);
    console.log('SENDER_BALANCE_START:', hre.ethers.formatEther(balance));

    const results = [];
    for (const recipient of recipients) {
        const gasEstimate = await sender.estimateGas({ to: recipient, value: amountWei });
        const feeData = await hre.ethers.provider.getFeeData();
        const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
        if (!gasPrice) {
            throw new Error('STOP: could not resolve gas price');
        }
        const gasCost = gasEstimate * gasPrice;
        const totalRequired = amountWei + gasCost;
        if (balance < totalRequired) {
            throw new Error(
                `STOP: insufficient tBNB after ${results.length}/${recipients.length} transfers. ` +
                    `Need ${hre.ethers.formatEther(totalRequired)} for next; have ${hre.ethers.formatEther(balance)}. ` +
                    `Fund deployer ${sender.address} via testnet faucet.`,
            );
        }
        const tx = await sender.sendTransaction({ to: recipient, value: amountWei });
        const receipt = await tx.wait();
        balance = await hre.ethers.provider.getBalance(sender.address);
        results.push({ recipient, hash: receipt.hash, block: receipt.blockNumber });
        console.log('OK', recipient, receipt.hash);
    }

    console.log('SENDER_BALANCE_END:', hre.ethers.formatEther(balance));
    console.log('STATUS: PASS', results.length, 'transfers');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
