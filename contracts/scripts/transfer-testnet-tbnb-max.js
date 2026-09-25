/**
 * Send (almost) all deployer tBNB to one wallet in a single tx (testnet 97).
 *
 *   cd contracts
 *   $env:TRANSFER_TO="0xYourWallet"
 *   $env:CONFIRM_TBNB_TRANSFER="YES"
 *   npm run transfer:testnet-tbnb-max
 *
 * Optional: TRANSFER_DEPLOYER_RESERVE=0.01  (keep this much on deployer)
 */
const hre = require('hardhat');
const { loadContractsEnv, envFirst, looksLikePlaceholderKey } = require('./lib/loadContractsEnv');

const EVmAddressRe = /^0x[a-fA-F0-9]{40}$/;

async function main() {
    loadContractsEnv();

    const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
    if (chainId === 56) {
        throw new Error('STOP: Mainnet (56) forbidden');
    }
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

    const transferToRaw = envFirst('TRANSFER_TO', 'TESTNET_TBNB_TRANSFER_TO');
    if (!transferToRaw || !EVmAddressRe.test(transferToRaw)) {
        throw new Error('STOP: set TRANSFER_TO=0xYourWallet');
    }
    const recipient = hre.ethers.getAddress(transferToRaw);

    const reserveHuman = envFirst('TRANSFER_DEPLOYER_RESERVE') || '0.01';
    const reserveWei = hre.ethers.parseEther(reserveHuman);

    const [sender] = await hre.ethers.getSigners();
    const balanceBefore = await hre.ethers.provider.getBalance(sender.address);

    const feeData = await hre.ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
    if (!gasPrice) {
        throw new Error('STOP: could not resolve gas price');
    }

    const gasEstimate = await sender.estimateGas({ to: recipient, value: 1n });
    const gasCost = (gasEstimate * gasPrice * 12n) / 10n;

    if (balanceBefore <= reserveWei + gasCost) {
        throw new Error(
            `STOP: deployer tBNB too low. Has ${hre.ethers.formatEther(balanceBefore)} tBNB; ` +
                `need > reserve ${reserveHuman} + gas. Fund deployer ${sender.address} via ` +
                `https://www.bnbchain.org/en/testnet-faucet then retry.`,
        );
    }

    const amountWei = balanceBefore - reserveWei - gasCost;

    console.log('NETWORK: bscTestnet');
    console.log('SENDER:', sender.address);
    console.log('RECIPIENT:', recipient);
    console.log('RESERVE_ON_DEPLOYER:', reserveHuman, 'tBNB');
    console.log('AMOUNT:', hre.ethers.formatEther(amountWei), 'tBNB');

    const tx = await sender.sendTransaction({ to: recipient, value: amountWei });
    const receipt = await tx.wait();
    const balanceAfter = await hre.ethers.provider.getBalance(sender.address);

    console.log('TX:', receipt.hash);
    console.log('BLOCK:', receipt.blockNumber);
    console.log('SENDER_BALANCE_AFTER:', hre.ethers.formatEther(balanceAfter));
    console.log('STATUS: PASS');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
