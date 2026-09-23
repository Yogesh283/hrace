/**
 * Transfer native tBNB on BSC Testnet (97) from deployer wallet.
 * Does NOT deploy contracts. Never prints private keys.
 *
 *   cd contracts
 *   $env:TRANSFER_TO="0x..."
 *   $env:TRANSFER_AMOUNT="0.05"
 *   $env:CONFIRM_TBNB_TRANSFER="YES"
 *   npm run transfer:testnet-tbnb
 */
const hre = require('hardhat');
const { loadContractsEnv, envFirst, looksLikePlaceholderKey } = require('./lib/loadContractsEnv');

const EVmAddressRe = /^0x[a-fA-F0-9]{40}$/;

function parsePositiveAmount(raw) {
    if (!raw || !/^\d+(\.\d+)?$/.test(raw)) {
        return null;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
        return null;
    }
    return raw;
}

async function main() {
    loadContractsEnv();

    const network = await hre.ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    console.log('NETWORK:', hre.network.name);
    console.log('CHAIN ID:', chainId);

    if (chainId === 56) {
        throw new Error('STOP: Mainnet (56) forbidden for tBNB transfer');
    }
    if (chainId !== 97) {
        throw new Error(`STOP: chainId must be 97 (got ${chainId})`);
    }
    if (envFirst('DEPLOY_ENV') !== 'testnet') {
        throw new Error('STOP: DEPLOY_ENV=testnet required');
    }
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        throw new Error('STOP: DEPLOYER_PRIVATE_KEY missing/placeholder in contracts/.env');
    }

    const transferToRaw = envFirst('TRANSFER_TO', 'TESTNET_TBNB_TRANSFER_TO');
    if (!transferToRaw || !EVmAddressRe.test(transferToRaw)) {
        throw new Error('STOP: set TRANSFER_TO=0xYourWallet (valid BSC Testnet recipient)');
    }

    let recipient;
    try {
        recipient = hre.ethers.getAddress(transferToRaw);
    } catch {
        throw new Error('STOP: TRANSFER_TO is not a valid EVM address');
    }
    if (recipient === hre.ethers.ZeroAddress) {
        throw new Error('STOP: TRANSFER_TO cannot be the zero address');
    }

    const amountHuman = parsePositiveAmount(envFirst('TRANSFER_AMOUNT', 'TESTNET_TBNB_TRANSFER_AMOUNT'));
    if (!amountHuman) {
        throw new Error('STOP: TRANSFER_AMOUNT must be a positive number (e.g. 0.05)');
    }

    const [sender] = await hre.ethers.getSigners();
    const amountWei = hre.ethers.parseEther(amountHuman);

    console.log('SENDER:', sender.address);
    console.log('RECIPIENT:', recipient);
    console.log('AMOUNT:', amountHuman, 'tBNB');

    if (envFirst('CONFIRM_TBNB_TRANSFER') !== 'YES') {
        throw new Error('STOP: set CONFIRM_TBNB_TRANSFER=YES to proceed (testnet only)');
    }

    const balanceBefore = await hre.ethers.provider.getBalance(sender.address);

    const gasEstimate = await sender.estimateGas({ to: recipient, value: amountWei });
    const feeData = await hre.ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
    if (!gasPrice) {
        throw new Error('STOP: could not resolve gas price from provider');
    }
    const gasCost = gasEstimate * gasPrice;
    const totalRequired = amountWei + gasCost;

    if (balanceBefore < totalRequired) {
        throw new Error(
            `STOP: insufficient tBNB. Need ≥ ${hre.ethers.formatEther(totalRequired)} tBNB ` +
                `(amount ${amountHuman} + est. gas ${hre.ethers.formatEther(gasCost)}); ` +
                `sender has ${hre.ethers.formatEther(balanceBefore)} tBNB`,
        );
    }

    const tx = await sender.sendTransaction({ to: recipient, value: amountWei });
    const receipt = await tx.wait();
    const balanceAfter = await hre.ethers.provider.getBalance(sender.address);

    console.log('TX:', receipt.hash);
    console.log('BLOCK:', receipt.blockNumber);
    console.log('SENDER_BALANCE_BEFORE:', hre.ethers.formatEther(balanceBefore));
    console.log('SENDER_BALANCE_AFTER:', hre.ethers.formatEther(balanceAfter));
    console.log('STATUS: PASS');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
