export const NO_WALLET_MESSAGE =
    'No crypto wallet found. Choose any EVM wallet below, or open this site in your wallet’s in-app browser.';

export const OPENED_WALLET_APP_MESSAGE =
    'Continue in your wallet app. When this site opens inside the wallet, tap Connect again.';

export const WALLET_PICK_CANCELLED = 'Wallet selection cancelled.';

export const RECOMMENDED_WALLETS = [
    {
        id: 'metamask',
        name: 'MetaMask',
        flag: 'isMetaMask',
        matchNames: ['metamask'],
        install: 'https://metamask.io/download/',
    },
    {
        id: 'trust',
        name: 'Trust Wallet',
        flag: 'isTrust',
        matchNames: ['trust'],
        install: 'https://trustwallet.com/download',
    },
    {
        id: 'tokenpocket',
        name: 'TokenPocket',
        flag: 'isTokenPocket',
        matchNames: ['tokenpocket', 'token pocket'],
        install: 'https://www.tokenpocket.pro/',
    },
    {
        id: 'okx',
        name: 'OKX Wallet',
        flag: 'isOkxWallet',
        matchNames: ['okx'],
        install: 'https://www.okx.com/web3',
    },
    {
        id: 'rabby',
        name: 'Rabby',
        flag: 'isRabby',
        matchNames: ['rabby'],
        install: 'https://rabby.io/',
    },
    {
        id: 'coinbase',
        name: 'Coinbase Wallet',
        flag: 'isCoinbaseWallet',
        matchNames: ['coinbase'],
        install: 'https://www.coinbase.com/wallet/downloads',
    },
    {
        id: 'bitget',
        name: 'Bitget Wallet',
        flag: 'isBitgetWallet',
        matchNames: ['bitget', 'bitkeep'],
        install: 'https://web3.bitget.com/en/wallet-download',
    },
    {
        id: 'binance',
        name: 'Binance Wallet',
        flag: 'isBinance',
        matchNames: ['binance'],
        install: 'https://www.binance.com/en/web3wallet',
    },
    {
        id: 'safepal',
        name: 'SafePal',
        flag: 'isSafePal',
        matchNames: ['safepal'],
        install: 'https://www.safepal.com/download',
    },
];

const announced = new Map();
let selectedProvider = null;
let listening = false;
const WALLET_SESSION_KEY = 'race.wallet.session';

function isLikelyMobile() {
    if (typeof navigator === 'undefined') {
        return false;
    }
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function guessWalletName(provider, index = 0) {
    if (!provider) {
        return `Wallet ${index + 1}`;
    }
    if (provider.isTrust || provider.isTrustWallet) {
        return 'Trust Wallet';
    }
    if (provider.isCoinbaseWallet) {
        return 'Coinbase Wallet';
    }
    if (provider.isOkxWallet || provider.isOKExWallet) {
        return 'OKX Wallet';
    }
    if (provider.isRabby) {
        return 'Rabby';
    }
    if (provider.isTokenPocket) {
        return 'TokenPocket';
    }
    if (provider.isBitKeep || provider.isBitgetWallet) {
        return 'Bitget Wallet';
    }
    if (provider.isBraveWallet) {
        return 'Brave Wallet';
    }
    if (provider.isSafePal) {
        return 'SafePal';
    }
    if (provider.isBinance || provider.isBinanceWallet) {
        return 'Binance Wallet';
    }
    if (provider.isMetaMask) {
        return 'MetaMask';
    }
    return `Browser wallet ${index + 1}`;
}

function listenForInjectedWallets() {
    if (typeof window === 'undefined' || listening) {
        return;
    }
    listening = true;
    window.addEventListener('eip6963:announceProvider', (event) => {
        const detail = event?.detail;
        const provider = detail?.provider;
        const info = detail?.info;
        if (!provider || !info?.uuid) {
            return;
        }
        announced.set(info.uuid, {
            id: info.uuid,
            name: info.name || guessWalletName(provider),
            icon: info.icon || '',
            rdns: info.rdns || '',
            provider,
        });
    });
    window.dispatchEvent(new Event('eip6963:requestProvider'));
}

if (typeof window !== 'undefined') {
    listenForInjectedWallets();
}

export function listInjectedWallets() {
    if (typeof window === 'undefined') {
        return [];
    }
    listenForInjectedWallets();
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    const fromAnnounce = Array.from(announced.values());
    if (fromAnnounce.length > 0) {
        return fromAnnounce;
    }

    const eth = window.ethereum;
    if (!eth) {
        return [];
    }
    const providers = Array.isArray(eth.providers) && eth.providers.length > 0 ? eth.providers : [eth];
    return providers.map((provider, index) => ({
        id: `legacy-${index}`,
        name: guessWalletName(provider, index),
        icon: '',
        provider,
    }));
}

export function matchRecommendedWallet(recommended, detected) {
    const names = (recommended.matchNames || [recommended.name]).map((name) => name.toLowerCase());
    return (
        detected.find((wallet) => {
            const walletName = String(wallet.name || '').toLowerCase();
            if (names.some((name) => walletName.includes(name))) {
                return true;
            }
            const provider = wallet.provider;
            if (recommended.flag && provider?.[recommended.flag]) {
                return true;
            }
            if (recommended.id === 'trust' && (provider?.isTrust || provider?.isTrustWallet)) {
                return true;
            }
            if (recommended.id === 'okx' && (provider?.isOkxWallet || provider?.isOKExWallet)) {
                return true;
            }
            if (recommended.id === 'bitget' && (provider?.isBitKeep || provider?.isBitgetWallet)) {
                return true;
            }
            return false;
        }) || null
    );
}

export function listWalletChoices() {
    const detected = listInjectedWallets();
    const rows = [];

    detected.forEach((wallet) => {
        rows.push({
            ...wallet,
            ready: true,
        });
    });

    RECOMMENDED_WALLETS.forEach((recommended) => {
        const match = matchRecommendedWallet(recommended, detected);
        if (match) {
            return;
        }
        rows.push({
            ...recommended,
            ready: false,
            provider: null,
        });
    });

    return rows;
}

export function openWalletDeepLink(wallet) {
    if (typeof window === 'undefined' || !wallet) {
        return;
    }

    const href = window.location.href;
    const encoded = encodeURIComponent(href);
    const hostPath = `${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`;
    const deepLinks = {
        metamask: `https://metamask.app.link/dapp/${hostPath}`,
        trust: `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encoded}`,
        tokenpocket: `tpdapp://open?params=${encodeURIComponent(JSON.stringify({ url: href, chain: 'BSC' }))}`,
        okx: `okx://wallet/dapp/details?dappUrl=${encoded}`,
        coinbase: `https://go.cb-w.com/dapp?cb_url=${encoded}`,
        bitget: `https://bkcode.vip?action=dapp&url=${encoded}`,
        binance: `bnc://app.binance.com/cedefi/dapp?url=${encoded}`,
        safepal: `https://link.safepal.io/open?url=${encoded}`,
        rabby: wallet.install || 'https://rabby.io/',
    };

    const target = isLikelyMobile()
        ? deepLinks[wallet.id] || wallet.install
        : wallet.install || deepLinks[wallet.id];

    if (!target) {
        return;
    }

    if (isLikelyMobile() && target.startsWith('http')) {
        window.location.href = target;
        return;
    }

    window.open(target, '_blank', 'noopener,noreferrer');
}

export function readWalletSession() {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        const raw = window.localStorage.getItem(WALLET_SESSION_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

export function hasWalletSession() {
    return Boolean(selectedProvider || readWalletSession());
}

export function rememberBoundAddress(address) {
    const saved = readWalletSession();
    if (!saved) {
        return;
    }
    rememberWalletChoice(saved, address);
}

export function rememberWalletChoice(wallet, address = '') {
    if (typeof window === 'undefined' || !wallet) {
        return;
    }
    const prev = readWalletSession() || {};
    const next = {
        rdns: wallet.rdns || prev.rdns || '',
        uuid: wallet.id || wallet.uuid || prev.uuid || '',
        name: wallet.name || prev.name || '',
        address: String(address || prev.address || '').toLowerCase(),
    };
    try {
        window.localStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(next));
    } catch {
        // Ignore quota / private-mode failures.
    }
}

export function clearWalletSession() {
    selectedProvider = null;
    if (typeof window === 'undefined') {
        return;
    }
    try {
        window.localStorage.removeItem(WALLET_SESSION_KEY);
    } catch {
        // ignore
    }
}

function matchPersistedWallet() {
    const saved = readWalletSession();
    if (!saved) {
        return null;
    }
    const wallets = listInjectedWallets();
    return (
        wallets.find((wallet) => {
            if (saved.rdns && wallet.rdns && saved.rdns === wallet.rdns) {
                return true;
            }
            if (saved.uuid && wallet.id && saved.uuid === wallet.id) {
                return true;
            }
            if (
                saved.name &&
                wallet.name &&
                String(saved.name).toLowerCase() === String(wallet.name).toLowerCase()
            ) {
                return true;
            }
            return false;
        }) || null
    );
}

export function restorePersistedProvider() {
    if (selectedProvider) {
        return selectedProvider;
    }
    const match = matchPersistedWallet();
    if (match?.provider) {
        selectedProvider = match.provider;
        return selectedProvider;
    }
    return null;
}

export async function findWalletByAddress(address) {
    const target = String(address || '').toLowerCase();
    if (!target) {
        return null;
    }
    const wallets = listInjectedWallets();
    for (const wallet of wallets) {
        if (!wallet?.provider?.request) {
            continue;
        }
        try {
            const accounts = await wallet.provider.request({ method: 'eth_accounts' });
            if ((accounts || []).some((item) => String(item).toLowerCase() === target)) {
                return wallet;
            }
        } catch {
            // Provider not ready or locked — try the next one.
        }
    }
    return null;
}

export function selectWalletProvider(provider, wallet = null) {
    selectedProvider = provider || null;
    if (provider && wallet) {
        rememberWalletChoice(wallet);
    }
}

export function getWalletProvider() {
    if (typeof window === 'undefined') {
        return null;
    }
    if (selectedProvider) {
        return selectedProvider;
    }
    const restored = restorePersistedProvider();
    if (restored) {
        return restored;
    }
    const wallets = listInjectedWallets();
    if (wallets.length === 1) {
        selectWalletProvider(wallets[0].provider, wallets[0]);
        return wallets[0].provider;
    }
    if (wallets.length === 0) {
        return window.ethereum || null;
    }
    return null;
}

export function hasWeb3Wallet() {
    return listInjectedWallets().length > 0 || Boolean(typeof window !== 'undefined' && window.ethereum);
}

export function requireWalletProvider() {
    const provider = getWalletProvider();
    if (!provider) {
        throw new Error(NO_WALLET_MESSAGE);
    }
    return provider;
}

export async function walletRequest(args) {
    return requireWalletProvider().request(args);
}

export async function resolveSessionWallet({ boundAddress = '', allowPicker = true } = {}) {
    if (selectedProvider) {
        return {
            id: 'selected',
            name: 'Connected wallet',
            icon: '',
            provider: selectedProvider,
            ready: true,
        };
    }

    restorePersistedProvider();
    if (selectedProvider) {
        return {
            id: 'persisted',
            name: readWalletSession()?.name || 'Connected wallet',
            icon: '',
            provider: selectedProvider,
            ready: true,
        };
    }

    if (boundAddress) {
        const byAddress = await findWalletByAddress(boundAddress);
        if (byAddress?.provider) {
            selectWalletProvider(byAddress.provider, byAddress);
            rememberWalletChoice(byAddress, boundAddress);
            return { ...byAddress, ready: true };
        }
    }

    const wallets = listInjectedWallets();
    if (wallets.length === 1) {
        selectWalletProvider(wallets[0].provider, wallets[0]);
        if (boundAddress) {
            rememberWalletChoice(wallets[0], boundAddress);
        }
        return { ...wallets[0], ready: true };
    }

    if (!allowPicker || typeof window === 'undefined') {
        return null;
    }

    return new Promise((resolve) => {
        window.dispatchEvent(
            new CustomEvent('race:pick-wallet', {
                detail: { wallets: listWalletChoices(), resolve },
            }),
        );
    });
}

/**
 * First login/register may open the picker. After a wallet is bound / saved,
 * reuse that provider — never ask the member to choose again until logout.
 */
export function pickInjectedWallet(options = {}) {
    const boundAddress = options.boundAddress || readWalletSession()?.address || '';
    const allowPicker = options.allowPicker === true || (!boundAddress && !hasWalletSession() && options.allowPicker !== false);

    if (typeof window === 'undefined') {
        const wallets = listInjectedWallets();
        if (wallets[0]) {
            selectWalletProvider(wallets[0].provider, wallets[0]);
            return Promise.resolve(wallets[0]);
        }
        return Promise.resolve(null);
    }

    return resolveSessionWallet({ boundAddress, allowPicker });
}
