require('@nomicfoundation/hardhat-toolbox');
const { loadContractsEnv } = require('./scripts/lib/loadContractsEnv');
loadContractsEnv();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    paths: {
        sources: './src',
        tests: './test',
        cache: './cache',
        artifacts: './artifacts',
    },
    solidity: {
        version: '0.8.20',
        settings: {
            optimizer: { enabled: true, runs: 200 },
            viaIR: true,
        },
    },
    networks: {
        hardhat: {
            chainId: 31337,
        },
        bscTestnet: {
            url: process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com',
            chainId: 97,
            timeout: 120_000,
            accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
        },
        bsc: {
            url: process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed.binance.org',
            chainId: 56,
            accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
        },
    },
};
