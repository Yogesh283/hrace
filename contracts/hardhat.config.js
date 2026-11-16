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
            timeout: 180_000,
            accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
        },
    },
    etherscan: {
        apiKey: {
            bsc: process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY || '',
        },
        // BscScan moved to Etherscan API v2 (old api.bscscan.com/api 308s).
        customChains: [
            {
                network: 'bsc',
                chainId: 56,
                urls: {
                    apiURL: 'https://api.etherscan.io/v2/api?chainid=56',
                    browserURL: 'https://bscscan.com',
                },
            },
        ],
        enabled: Boolean(process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY),
    },
    sourcify: {
        enabled: true,
        apiUrl: 'https://sourcify.dev/server',
        browserUrl: 'https://repo.sourcify.dev',
    },
};
