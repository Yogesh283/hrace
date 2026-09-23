/** Official Tether USD (USDT) on BSC mainnet — never use on Testnet. */
export const OFFICIAL_USDT_BEP20 = '0x55d398326f99059ff775485246999027b3197955';

export const BSC_TESTNET_CHAIN_ID = 97;
export const BSC_TESTNET_CHAIN_HEX = '0x61';
export const BSC_MAINNET_CHAIN_ID = 56;
export const BSC_MAINNET_CHAIN_HEX = '0x38';

export const WRONG_NETWORK_MESSAGE =
    'Please switch MetaMask to BSC Testnet (Chain ID 97).';

const BSC_MAINNET = {
    chainId: BSC_MAINNET_CHAIN_HEX,
    chainName: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
    blockExplorerUrls: ['https://bscscan.com/'],
};

const DEFAULT_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.bnbchain.org:8545';

const BSC_TESTNET = {
    chainId: BSC_TESTNET_CHAIN_HEX,
    chainName: 'BSC Testnet',
    nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
    rpcUrls: [DEFAULT_TESTNET_RPC],
    blockExplorerUrls: ['https://testnet.bscscan.com/'],
};

let activeChainId = BSC_MAINNET_CHAIN_ID;
let configuredUsdtContract = OFFICIAL_USDT_BEP20;
let configuredRpcUrl = '';

export function configureWeb3Network({ chainId, usdtContract, rpcUrl } = {}) {
    if (chainId !== undefined && chainId !== null && chainId !== '') {
        activeChainId = Number(chainId);
    }
    if (usdtContract) {
        configuredUsdtContract = String(usdtContract).trim();
    }
    if (rpcUrl) {
        configuredRpcUrl = String(rpcUrl).trim();
    }
}

export function getActiveChainId() {
    return activeChainId;
}

export function getConfiguredUsdtContract() {
    return configuredUsdtContract;
}

export function isTestnetMode() {
    return activeChainId === BSC_TESTNET_CHAIN_ID;
}

export function chainIdToHex(chainId) {
    return `0x${Number(chainId).toString(16)}`;
}

export function normalizeChainHex(chainHex) {
    if (!chainHex || typeof chainHex !== 'string') {
        return '';
    }
    const raw = chainHex.startsWith('0x') ? chainHex.slice(2) : chainHex;
    if (!/^[0-9a-fA-F]+$/.test(raw)) {
        return '';
    }
    return `0x${raw.toLowerCase()}`;
}

export function isChainIdMatch(chainHex, targetChainId = activeChainId) {
    const normalized = normalizeChainHex(chainHex);
    const expected = chainIdToHex(targetChainId).toLowerCase();
    return normalized === expected;
}

export function getWrongNetworkMessage(targetChainId = activeChainId) {
    if (Number(targetChainId) === BSC_TESTNET_CHAIN_ID) {
        return WRONG_NETWORK_MESSAGE;
    }
    return 'Please switch MetaMask to BNB Smart Chain (Chain ID 56).';
}

function debugLog(payload) {
    if (!import.meta.env.DEV) {
        return;
    }
    console.debug('[web3:network]', payload);
}

function requireEthereum() {
    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No Web3 wallet detected. Install MetaMask or another EVM wallet.');
    }
}

function resolveChainId(chainId) {
    const value = chainId ?? activeChainId;
    return Number(value);
}

function networkParamsForChainId(chainId) {
    if (chainId === BSC_TESTNET_CHAIN_ID) {
        const rpc = configuredRpcUrl || DEFAULT_TESTNET_RPC;
        return {
            ...BSC_TESTNET,
            rpcUrls: [rpc],
        };
    }
    return BSC_MAINNET;
}

export async function readWalletChainIdHex() {
    requireEthereum();
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return normalizeChainHex(chainId);
}

async function switchOrAddNetwork(targetChainId) {
    requireEthereum();
    const chainHex = chainIdToHex(targetChainId);
    const network = networkParamsForChainId(targetChainId);

    debugLog({
        phase: 'switch-attempt',
        currentChainId: await readWalletChainIdHex().catch(() => null),
        targetChainId: chainHex,
    });

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainHex }],
        });
        debugLog({ phase: 'switch-success', targetChainId: chainHex });
    } catch (switchError) {
        debugLog({
            phase: 'switch-failure',
            code: switchError?.code,
            message: switchError?.message,
            targetChainId: chainHex,
        });

        if (switchError?.code === 4902) {
            debugLog({ phase: 'add-network-attempt', targetChainId: chainHex });
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [network],
            });
            debugLog({ phase: 'add-network-success', targetChainId: chainHex });
            return;
        }

        if (switchError?.code === 4001) {
            throw new Error('Network switch cancelled.');
        }

        throw switchError;
    }
}

/**
 * Ensure wallet is on the configured BSC network. Verifies eth_chainId after switch/add.
 */
export async function ensureBscNetwork(chainIdOverride) {
    requireEthereum();
    const targetChainId = resolveChainId(chainIdOverride);
    const targetHex = chainIdToHex(targetChainId);

    let currentHex = await readWalletChainIdHex();
    debugLog({ phase: 'ensure-initial', currentChainId: currentHex, targetChainId: targetHex });

    if (isChainIdMatch(currentHex, targetChainId)) {
        debugLog({ phase: 'ensure-already-correct', targetChainId: targetHex });
        return { chainIdHex: currentHex };
    }

    await switchOrAddNetwork(targetChainId);

    currentHex = await readWalletChainIdHex();
    debugLog({ phase: 'ensure-post-switch', currentChainId: currentHex, targetChainId: targetHex });

    if (!isChainIdMatch(currentHex, targetChainId)) {
        throw new Error(getWrongNetworkMessage(targetChainId));
    }

    debugLog({ phase: 'ensure-success', currentChainId: currentHex, targetChainId: targetHex });
    return { chainIdHex: currentHex };
}

/**
 * Public Testnet / custom RPCs often reject gas > 2^24-1 (16777216).
 * MetaMask alone can propose ~35M when estimate fails → "gas limit too high".
 */
export const RPC_GAS_LIMIT_CAP = 16_000_000;
export const DEFAULT_CONTRACT_GAS = 1_500_000;

/**
 * Estimate gas with buffer, hard-capped under RPC max. Never returns block gas limit.
 * @returns {string} hex gas limit
 */
export async function resolveGasLimitHex({ from, to, data, fallback = DEFAULT_CONTRACT_GAS } = {}) {
    let gas = Number(fallback) || DEFAULT_CONTRACT_GAS;

    try {
        const est = await window.ethereum.request({
            method: 'eth_estimateGas',
            params: [{ from, to, data }],
        });
        if (est != null && est !== '') {
            gas = Number(BigInt(est));
            gas = Math.ceil(gas * 1.25);
        }
    } catch {
        // Keep fallback — do not let wallet use uncapped block gas limit.
    }

    if (!Number.isFinite(gas) || gas < 21_000) {
        gas = DEFAULT_CONTRACT_GAS;
    }

    gas = Math.min(Math.floor(gas), RPC_GAS_LIMIT_CAP);
    return `0x${gas.toString(16)}`;
}

/**
 * eth_sendTransaction with explicit gas so Custom RPC 0x61 does not reject.
 */
export async function sendContractTx({ from, to, data, value }) {
    await ensureBscNetwork();
    const gas = await resolveGasLimitHex({ from, to, data });
    const tx = { from, to, data, gas };
    if (value != null && value !== '' && value !== '0x0' && value !== '0x') {
        tx.value = value;
    }
    return window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [tx],
    });
}

/** Alias for UI "Switch to BSC Testnet" button. */
export async function switchToConfiguredNetwork(chainIdOverride) {
    return ensureBscNetwork(chainIdOverride);
}

/**
 * Connect wallet accounts, then enforce configured network (accounts → chainId → switch → verify).
 */
export async function connectWalletWithNetwork(chainIdOverride) {
    requireEthereum();
    const targetChainId = resolveChainId(chainIdOverride);

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const address = accounts?.[0];
    if (!address) {
        throw new Error('No account returned from the wallet.');
    }

    debugLog({
        phase: 'connect-accounts',
        walletAddress: address,
        targetChainId: chainIdToHex(targetChainId),
    });

    const { chainIdHex } = await ensureBscNetwork(targetChainId);

    debugLog({
        phase: 'connect-success',
        walletAddress: address,
        currentChainId: chainIdHex,
        targetChainId: chainIdToHex(targetChainId),
    });

    return { address, chainIdHex };
}

/**
 * Subscribe to wallet chain/account changes. Returns cleanup function.
 */
export function subscribeWalletEvents({ onChainChanged, onAccountsChanged } = {}) {
    if (typeof window === 'undefined' || !window.ethereum) {
        return () => {};
    }

    const handleChain = () => {
        debugLog({ phase: 'chainChanged' });
        onChainChanged?.();
    };
    const handleAccounts = () => {
        debugLog({ phase: 'accountsChanged' });
        onAccountsChanged?.();
    };

    window.ethereum.on?.('chainChanged', handleChain);
    window.ethereum.on?.('accountsChanged', handleAccounts);

    return () => {
        window.ethereum.removeListener?.('chainChanged', handleChain);
        window.ethereum.removeListener?.('accountsChanged', handleAccounts);
    };
}

function getCsrfToken() {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

function normalizeAddress(address) {
    return String(address ?? '').trim().toLowerCase();
}

export function assertOfficialUsdtContract(usdtContract, expectedUsdt = null) {
    const contract = normalizeAddress(usdtContract);
    const expected = normalizeAddress(expectedUsdt || configuredUsdtContract || OFFICIAL_USDT_BEP20);

    if (!contract) {
        throw new Error('USDT contract is not configured.');
    }

    if (activeChainId === BSC_TESTNET_CHAIN_ID && contract === normalizeAddress(OFFICIAL_USDT_BEP20)) {
        throw new Error('Flash / mainnet USDT blocked on Testnet. Use project TestnetMockUSDT only.');
    }

    if (activeChainId === BSC_MAINNET_CHAIN_ID && contract !== normalizeAddress(OFFICIAL_USDT_BEP20)) {
        throw new Error('Flash / fake USDT blocked. Only official BEP20 Tether USDT is allowed.');
    }

    if (contract !== expected) {
        if (activeChainId === BSC_TESTNET_CHAIN_ID) {
            throw new Error('Only configured TestnetMockUSDT is allowed on BSC Testnet. Fake tokens rejected.');
        }
        throw new Error('Only official BEP20 USDT deposits are allowed. Fake / flash USDT rejected.');
    }
}

export function parseTokenAmount(value, decimals = 18) {
    const raw = String(value ?? '').trim();
    if (!/^\d+(\.\d+)?$/.test(raw)) {
        throw new Error('Enter a valid amount.');
    }
    const [whole, frac = ''] = raw.split('.');
    const paddedFrac = frac.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(`${whole}${paddedFrac}`);
}

function encodeTransfer(to, amountWei) {
    const selector = '0xa9059cbb';
    const toPadded = to.slice(2).toLowerCase().padStart(64, '0');
    const amountHex = amountWei.toString(16).padStart(64, '0');
    return selector + toPadded + amountHex;
}

export async function sendUsdtTransfer({ from, to, usdtContract, amountUsd }) {
    await ensureBscNetwork();
    assertOfficialUsdtContract(usdtContract);

    const amountWei = parseTokenAmount(amountUsd, 18);

    const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
            {
                from,
                to: usdtContract,
                data: encodeTransfer(to, amountWei),
                gas: await resolveGasLimitHex({
                    from,
                    to: usdtContract,
                    data: encodeTransfer(to, amountWei),
                    fallback: 100_000,
                }),
            },
        ],
    });

    if (!txHash || typeof txHash !== 'string') {
        throw new Error('Wallet did not return a transaction hash.');
    }

    return txHash;
}

export async function waitForConfirmations(
    txHash,
    { minConfirmations = 12, maxAttempts = 80, intervalMs = 3000 } = {},
) {
    let receipt = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        receipt = await window.ethereum.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
        });

        if (receipt) {
            if (receipt.status !== '0x1') {
                throw new Error('Transaction failed on chain.');
            }
            break;
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    if (!receipt) {
        throw new Error('Transaction confirmation timed out. Your USDT may still arrive — check Recent deposits shortly.');
    }

    const txBlock = parseInt(receipt.blockNumber, 16);
    if (Number.isNaN(txBlock)) {
        throw new Error('Could not read transaction block.');
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const currentBlockHex = await window.ethereum.request({
            method: 'eth_blockNumber',
            params: [],
        });
        const currentBlock = parseInt(currentBlockHex, 16);
        const confirmations = currentBlock - txBlock + 1;

        if (confirmations >= minConfirmations) {
            return receipt;
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(
        `Waiting for ${minConfirmations} block confirmations. Try crediting again from Recent deposits shortly.`,
    );
}

export async function verifyOnChainDeposit({ txHash, amountUsd, verifyUrl, extra = {} }) {
    const response = await fetch(verifyUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': getCsrfToken(),
        },
        body: JSON.stringify({
            tx_hash: txHash,
            amount_usd: amountUsd,
            ...extra,
        }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(payload.error || 'Deposit verification failed.');
    }

    return payload;
}
