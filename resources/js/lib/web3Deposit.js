/** Official Tether USD (USDT) on BSC mainnet — never use on Testnet. */
import { hideWalletPending, showWalletPending } from '@/lib/appNotify';
import {
    getWalletProvider,
    NO_WALLET_MESSAGE,
    OPENED_WALLET_APP_MESSAGE,
    pickInjectedWallet,
    requireWalletProvider,
    WALLET_PICK_CANCELLED,
    walletRequest,
} from '@/lib/web3Wallet';

export const OFFICIAL_USDT_BEP20 = '0x55d398326f99059ff775485246999027b3197955';

/** Project TestnetMockUSDT (BSC Testnet) — when configured, wallet must be on chain 97. */
export const TESTNET_MOCK_USDT = '0xe30fb617215c4eb5a0e4e6b1a5f537c0e28c8fec';

export const BSC_TESTNET_CHAIN_ID = 97;
export const BSC_TESTNET_CHAIN_HEX = '0x61';
export const BSC_MAINNET_CHAIN_ID = 56;
export const BSC_MAINNET_CHAIN_HEX = '0x38';

export const WRONG_NETWORK_MESSAGE =
    'Please switch your wallet to BNB Smart Chain (Chain ID 56).';

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
        return 'Please switch your wallet to BSC Testnet (Chain ID 97).';
    }
    return WRONG_NETWORK_MESSAGE;
}

function normalizeAddressForChain(address) {
    if (!address || typeof address !== 'string') {
        return '';
    }
    const trimmed = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
        return '';
    }
    return trimmed.toLowerCase();
}

/**
 * Resolve chain id from Laravel Inertia blockchain props (handles Testnet USDT + is_testnet).
 */
export function resolvePageChainId(blockchain = {}) {
    const usdt = normalizeAddressForChain(
        blockchain.contracts?.usdt
            || blockchain.ico?.usdt_contract
            || blockchain.web3?.usdt_contract
            || blockchain.token?.usdt_contract,
    );
    if (usdt === TESTNET_MOCK_USDT) {
        return BSC_TESTNET_CHAIN_ID;
    }

    const fromProps = Number(blockchain.chain_id);
    if (Number.isFinite(fromProps) && fromProps > 0) {
        return fromProps;
    }
    if (blockchain.is_testnet) {
        return BSC_TESTNET_CHAIN_ID;
    }
    return BSC_MAINNET_CHAIN_ID;
}

export function networkLabelForChainId(chainId = activeChainId) {
    return Number(chainId) === BSC_TESTNET_CHAIN_ID
        ? 'BSC Testnet (Chain ID 97)'
        : 'BNB Smart Chain (Chain ID 56)';
}

export function friendlyNetworkSwitchMessage(chainId = activeChainId) {
    return `Wrong network. Switch to ${networkLabelForChainId(chainId)}. ${getWrongNetworkMessage(chainId)}`;
}

export function isLikelyWrongNetworkError(message) {
    const lower = String(message || '').toLowerCase();
    if (!lower) {
        return false;
    }
    if (lower.includes('wrong network')) {
        return true;
    }
    if (/please switch metamask to bsc testnet/i.test(message)) {
        return true;
    }
    if (/please switch metamask to bnb smart chain/i.test(message)) {
        return true;
    }
    if (/switch to bsc testnet \(chain id 97\)/i.test(message)) {
        return true;
    }
    if (/switch to bnb smart chain \(chain id 56\)/i.test(message)) {
        return true;
    }
    return false;
}

function debugLog(payload) {
    if (!import.meta.env.DEV) {
        return;
    }
    console.debug('[web3:network]', payload);
}

function requireEthereum() {
    requireWalletProvider();
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
    const chainId = await walletRequest({ method: 'eth_chainId' });
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
        await walletRequest({
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
            await walletRequest({
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
/** Fallback when estimate is unavailable (RPC flake) — ICO/Engine need headroom beyond simple ERC20. */
export const DEFAULT_CONTRACT_GAS = 3_500_000;

/**
 * Estimate gas with buffer, hard-capped under RPC max. Never returns block gas limit.
 * If the call would revert, throws (do NOT send a doomed tx with fallback gas).
 * @returns {string} hex gas limit
 */
export async function resolveGasLimitHex({
    from,
    to,
    data,
    fallback = DEFAULT_CONTRACT_GAS,
    minGas = 0,
} = {}) {
    let gas = Number(fallback) || DEFAULT_CONTRACT_GAS;
    let estimated = false;

    try {
        const est = await walletRequest({
            method: 'eth_estimateGas',
            params: [{ from, to, data }],
        });
        if (est != null && est !== '') {
            gas = Number(BigInt(est));
            gas = Math.ceil(gas * 1.35);
            estimated = true;
        }
    } catch (err) {
        // Revert / execution failure — surface reason; do not broadcast with fallback gas.
        const decoded = extractRpcRevertMessage(err);
        const raw = String(err?.data?.message || err?.message || '');
        const isAmbiguous =
            !decoded &&
            (/execution reverted:\s*0x$/i.test(raw) ||
                raw.toLowerCase() === 'execution reverted: 0x' ||
                raw.toLowerCase() === 'internal json-rpc error.');
        if ((decoded || isExecutionRevertError(err)) && !isAmbiguous) {
            throw new Error(
                decoded ||
                    'Transaction would revert on-chain. Check allowance, stake plan, balance, and network.',
            );
        }
        // Ambiguous empty revert or RPC timeout — keep fallback below.
    }

    if (!Number.isFinite(gas) || gas < 21_000) {
        gas = DEFAULT_CONTRACT_GAS;
    }

    const floor = Number(minGas) || 0;
    if (floor > 0) {
        gas = Math.max(gas, floor);
    }

    gas = Math.min(Math.floor(gas), RPC_GAS_LIMIT_CAP);
    if (!estimated && gas < fallback) {
        gas = Math.min(Math.floor(fallback), RPC_GAS_LIMIT_CAP);
    }
    return `0x${gas.toString(16)}`;
}

function isExecutionRevertError(err) {
    const blob = JSON.stringify(err?.data ?? err?.error ?? err?.info ?? err?.message ?? '').toLowerCase();
    return (
        blob.includes('execution reverted') ||
        blob.includes('revert') ||
        err?.code === 3 ||
        err?.data?.code === 3
    );
}

/** Best-effort Solidity Error(string) / nested MetaMask revert text. */
export function extractRpcRevertMessage(err) {
    const nested =
        err?.data?.message ||
        err?.error?.message ||
        err?.info?.error?.message ||
        err?.data?.data?.message ||
        '';
    const candidates = [
        typeof err?.data === 'string' ? err.data : null,
        typeof err?.data?.data === 'string' ? err.data.data : null,
        typeof err?.info?.error?.data === 'string' ? err.info.error.data : null,
        typeof err?.data?.data?.data === 'string' ? err.data.data.data : null,
    ].filter(Boolean);

    // Deep-scan JSON for Error(string) payloads (MetaMask nests oddly).
    try {
        const blob = JSON.stringify(err ?? {});
        const match = blob.match(/0x08c379a0[a-fA-F0-9]+/);
        if (match?.[0]) {
            candidates.unshift(match[0].startsWith('0x') ? match[0] : `0x${match[0]}`);
        }
        const quoted = blob.match(/execution reverted:?\s*\\?"([^"\\]+)\\?"/i);
        if (quoted?.[1] && quoted[1] !== '0x') {
            return quoted[1];
        }
    } catch {
        // ignore
    }

    for (const data of candidates) {
        const decoded = decodeSolidityErrorString(data);
        if (decoded) {
            return decoded;
        }
    }

    const msg = String(nested || err?.shortMessage || err?.reason || err?.message || '');
    if (/execution reverted/i.test(msg) && msg.length < 200) {
        const m = msg.match(/execution reverted:?\s*(.*)$/i);
        if (m?.[1] && m[1] !== '0x' && m[1].trim() !== '') {
            return m[1].replace(/^["']|["']$/g, '').trim();
        }
    }
    return '';
}

function decodeSolidityErrorString(data) {
    if (!data || typeof data !== 'string' || !data.startsWith('0x') || data.length < 10) {
        return '';
    }
    const hex = data.slice(2).toLowerCase();
    if (!hex.startsWith('08c379a0') || hex.length < 8 + 64 + 64) {
        return '';
    }
    try {
        const len = Number.parseInt(hex.slice(8 + 64, 8 + 128), 16);
        if (!Number.isFinite(len) || len <= 0 || len > 256) {
            return '';
        }
        const strHex = hex.slice(8 + 128, 8 + 128 + len * 2);
        const bytes = strHex.match(/.{1,2}/g) || [];
        return bytes.map((b) => String.fromCharCode(Number.parseInt(b, 16))).join('');
    } catch {
        return '';
    }
}

/**
 * eth_sendTransaction with explicit gas so Custom RPC 0x61 does not reject.
 */
export async function sendContractTx({ from, to, data, value, chainId, gasFallback, minGas }) {
    showWalletPending('Confirm transaction in your wallet…');
    try {
        await ensureBscNetwork(chainId);
        const gas = await resolveGasLimitHex({
            from,
            to,
            data,
            fallback: gasFallback ?? DEFAULT_CONTRACT_GAS,
            minGas: minGas ?? 0,
        });
        const tx = { from, to, data, gas };
        if (value != null && value !== '' && value !== '0x0' && value !== '0x') {
            tx.value = value;
        }
        return await walletRequest({
            method: 'eth_sendTransaction',
            params: [tx],
        });
    } finally {
        hideWalletPending();
    }
}

/** Alias for UI "Switch network" button. */
export async function switchToConfiguredNetwork(chainIdOverride) {
    return ensureBscNetwork(chainIdOverride);
}

/**
 * Login / register only: connect wallet accounts — do NOT force network switch popup.
 * Tx pages still use connectWalletWithNetwork / ensureBscNetwork.
 */
export async function connectWalletForAuth() {
    const picked = await pickInjectedWallet();
    if (picked?.openedApp) {
        throw new Error(OPENED_WALLET_APP_MESSAGE);
    }
    if (!picked) {
        throw new Error(WALLET_PICK_CANCELLED);
    }
    if (!picked.provider) {
        throw new Error(NO_WALLET_MESSAGE);
    }
    requireEthereum();

    showWalletPending('Connect / unlock your wallet…');
    try {
        const accounts = await walletRequest({ method: 'eth_requestAccounts' });
        const address = accounts?.[0];
        if (!address) {
            throw new Error('No account returned from the wallet.');
        }

        let chainIdHex = '';
        try {
            chainIdHex = await readWalletChainIdHex();
        } catch {
            chainIdHex = '';
        }

        debugLog({
            phase: 'auth-connect',
            walletAddress: address,
            currentChainId: chainIdHex,
        });

        return { address, chainIdHex };
    } finally {
        hideWalletPending();
    }
}

/**
 * Connect wallet accounts, then enforce configured network (accounts → chainId → switch → verify).
 */
export async function connectWalletWithNetwork(chainIdOverride) {
    const picked = await pickInjectedWallet();
    if (picked?.openedApp) {
        throw new Error(OPENED_WALLET_APP_MESSAGE);
    }
    if (!picked) {
        throw new Error(WALLET_PICK_CANCELLED);
    }
    if (!picked.provider) {
        throw new Error(NO_WALLET_MESSAGE);
    }
    requireEthereum();
    const targetChainId = resolveChainId(chainIdOverride);

    showWalletPending('Connect / unlock your wallet…');
    try {
        const accounts = await walletRequest({ method: 'eth_requestAccounts' });
        const address = accounts?.[0];
        if (!address) {
            throw new Error('No account returned from the wallet.');
        }

        debugLog({
            phase: 'connect-accounts',
            walletAddress: address,
            targetChainId: chainIdToHex(targetChainId),
        });

        showWalletPending('Switch network in your wallet if asked…');
        const { chainIdHex } = await ensureBscNetwork(targetChainId);

        debugLog({
            phase: 'connect-success',
            walletAddress: address,
            currentChainId: chainIdHex,
            targetChainId: chainIdToHex(targetChainId),
        });

        return { address, chainIdHex };
    } finally {
        hideWalletPending();
    }
}

/**
 * Subscribe to wallet chain/account changes. Returns cleanup function.
 */
export function subscribeWalletEvents({ onChainChanged, onAccountsChanged } = {}) {
    const provider = getWalletProvider();
    if (!provider) {
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

    provider.on?.('chainChanged', handleChain);
    provider.on?.('accountsChanged', handleAccounts);

    return () => {
        provider.removeListener?.('chainChanged', handleChain);
        provider.removeListener?.('accountsChanged', handleAccounts);
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
    showWalletPending('Confirm USDT transfer in your wallet…');
    try {
        await ensureBscNetwork();
        assertOfficialUsdtContract(usdtContract);

        const amountWei = parseTokenAmount(amountUsd, 18);

        const txHash = await walletRequest({
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
    } finally {
        hideWalletPending();
    }
}

export async function waitForConfirmations(
    txHash,
    { minConfirmations = 12, maxAttempts = 80, intervalMs = 3000 } = {},
) {
    showWalletPending('Waiting for blockchain confirmation…');
    try {
        let receipt = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            receipt = await walletRequest({
                method: 'eth_getTransactionReceipt',
                params: [txHash],
            });

            if (receipt) {
                if (receipt.status !== '0x1') {
                    const reason = await tryReplayRevertReason(txHash);
                    let gasLimit = BigInt(receipt.gasLimit || '0x0');
                    if (gasLimit === 0n) {
                        try {
                            const tx = await walletRequest({
                                method: 'eth_getTransactionByHash',
                                params: [txHash],
                            });
                            gasLimit = BigInt(tx?.gas || '0x0');
                        } catch {
                            gasLimit = 0n;
                        }
                    }
                    const gasUsed = BigInt(receipt.gasUsed || '0x0');
                    const outOfGas =
                        gasLimit > 0n && gasUsed > 0n && gasUsed * 100n >= gasLimit * 95n;
                    const short = txHash.slice(0, 10);
                    if (outOfGas) {
                        throw new Error(
                            `Transaction ran out of gas (${short}…). Retry Buy & Stake — more gas will be used.`,
                        );
                    }
                    const explorerBase =
                        Number(activeChainId) === BSC_TESTNET_CHAIN_ID
                            ? 'https://testnet.bscscan.com'
                            : 'https://bscscan.com';
                    throw new Error(
                        reason
                            ? `Transaction failed on chain (${short}…): ${reason}`
                            : `Transaction failed on chain (${short}…). Open ${explorerBase}/tx/${txHash}`,
                    );
                }
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }

        if (!receipt) {
            throw new Error(
                'Transaction confirmation timed out. Your USDT may still arrive — check Recent deposits shortly.',
            );
        }

        const txBlock = parseInt(receipt.blockNumber, 16);
        if (Number.isNaN(txBlock)) {
            throw new Error('Could not read transaction block.');
        }

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const currentBlockHex = await walletRequest({
                method: 'eth_blockNumber',
                params: [],
            });
            const currentBlock = parseInt(currentBlockHex, 16);
            const confirmations = currentBlock - txBlock + 1;

            if (confirmations >= minConfirmations) {
                return receipt;
            }

            showWalletPending(
                `Waiting for confirmations… (${Math.min(confirmations, minConfirmations)}/${minConfirmations})`,
            );
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }

        throw new Error(
            `Waiting for ${minConfirmations} block confirmations. Try crediting again from Recent deposits shortly.`,
        );
    } finally {
        hideWalletPending();
    }
}
async function tryReplayRevertReason(txHash) {
    try {
        const tx = await walletRequest({
            method: 'eth_getTransactionByHash',
            params: [txHash],
        });
        if (!tx?.to || !tx?.from) {
            return '';
        }
        await walletRequest({
            method: 'eth_call',
            params: [
                {
                    from: tx.from,
                    to: tx.to,
                    data: tx.input || tx.data || '0x',
                    value: tx.value || '0x0',
                    gas: tx.gas || undefined,
                },
                tx.blockNumber || 'latest',
            ],
        });
        return '';
    } catch (err) {
        return extractRpcRevertMessage(err) || '';
    }
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

/**
 * Instant DB index for Engine/ICO/Vault logs from one confirmed tx.
 * Writes blockchain_events (+ ico_purchases / stakes when present).
 */
export async function syncBlockchainTx({ txHash, syncUrl = '/blockchain/sync-tx' }) {
    const response = await fetch(syncUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': getCsrfToken(),
        },
        body: JSON.stringify({ tx_hash: txHash }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || 'Could not sync transaction to database.');
    }

    return payload;
}
