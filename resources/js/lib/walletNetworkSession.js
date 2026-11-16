import {
    BSC_MAINNET_CHAIN_ID,
    bindWalletProviderListeners,
    getActiveChainId,
    isChainIdMatch,
    isInAppWalletBrowser,
    isTrustWalletBrowser,
    parseChainIdDecimal,
    readWalletChainIdHex,
    subscribeWalletEvents,
    switchToConfiguredNetwork,
    trustDisclaimerHint,
    waitUntilChainConfirmed,
} from '@/lib/web3Deposit';
import {
    describeWalletProvider,
    discoverTrustProvider,
    getWalletProvider,
    restorePersistedProvider,
    selectWalletProvider,
    walletRequest,
} from '@/lib/web3Wallet';

export const NETWORK_GATE_STATUS = {
    idle: 'idle',
    checking: 'checking',
    prompt: 'prompt',
    waiting: 'waiting',
    ready: 'ready',
    rejected: 'rejected',
    unsupported: 'unsupported',
};

const REJECTED_KEY = 'race.network.gate.rejected';
const AUTO_SWITCH_KEY = 'race.network.gate.autostarted';

const listeners = new Set();
let booted = false;
let switchInFlight = false;
let visibilityBound = false;
let providerUnsubscribe = () => {};

let snapshot = {
    status: NETWORK_GATE_STATUS.idle,
    message: 'Checking wallet network...',
    chainHex: '',
    chainId: 0,
    address: '',
    hasProvider: false,
    ready: false,
    readyWithoutWallet: false,
    softMode: false,
    providerName: '',
    hasEthereum: false,
    hasTrustWallet: false,
    waitingConfirm: false,
    manualHint: '',
};

function targetChainId() {
    return getActiveChainId() || BSC_MAINNET_CHAIN_ID;
}

function chainDisplayName(chainId) {
    if (chainId === 56) {
        return 'BNB Smart Chain';
    }
    if (chainId === 1) {
        return 'Ethereum';
    }
    if (chainId === 97) {
        return 'BSC Testnet';
    }
    return chainId ? `Chain ${chainId}` : 'Unknown';
}

function trustManualHint() {
    return 'Trust menu → Network → BNB Smart Chain choose karo, phir yahan Switch dabao. Disclaimer aaye to Terms tick + Confirm.';
}

function messageFor(status, extra = snapshot) {
    const trust = Boolean(extra.softMode || isTrustWalletBrowser());
    switch (status) {
        case NETWORK_GATE_STATUS.checking:
            return trust ? 'Detecting Trust Wallet...' : 'Checking wallet network...';
        case NETWORK_GATE_STATUS.prompt:
            if (trust) {
                return `Current network: ${chainDisplayName(extra.chainId || 0)} — switch to BNB`;
            }
            return extra.chainId ? `Current network: ${chainDisplayName(extra.chainId)}` : 'Current network: Unknown';
        case NETWORK_GATE_STATUS.waiting:
            return extra.waitingConfirm
                ? 'Waiting for wallet confirmation...'
                : 'Switching to BNB Smart Chain...';
        case NETWORK_GATE_STATUS.ready:
            return extra.hasProvider ? 'BNB Smart Chain connected.' : extra.message || 'BNB Smart Chain connected.';
        case NETWORK_GATE_STATUS.rejected:
        case NETWORK_GATE_STATUS.unsupported:
            if (trust) {
                return `Still on ${chainDisplayName(extra.chainId || 0)}. Choose BNB Smart Chain in Trust, then Switch.`;
            }
            return 'Please switch to BNB Smart Chain, then Retry.';
        default:
            return trust ? 'Detecting Trust Wallet...' : 'Checking wallet network...';
    }
}

function providerDebug() {
    const info = describeWalletProvider();
    return {
        providerName: info.name || 'None',
        hasEthereum: Boolean(info.hasEthereum),
        hasTrustWallet: Boolean(info.hasTrustWallet),
    };
}

function preserveAppUrl() {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        window.sessionStorage.setItem('race.app.url', window.location.href);
        window.history.replaceState(window.history.state, document.title, window.location.href);
    } catch {
        // private mode / restricted WebView
    }
}

function emit() {
    const current = { ...snapshot };
    listeners.forEach((fn) => {
        try {
            fn(current);
        } catch {
            // ignore subscriber errors
        }
    });
}

function setSnapshot(patch) {
    const next = { ...snapshot, ...patch };
    if (patch.message === undefined && (patch.status || patch.chainId !== undefined || patch.waitingConfirm !== undefined || patch.softMode !== undefined)) {
        next.message = messageFor(next.status, next);
    }
    // Trust soft mode: never hard-block the whole site for wrong chain.
    if (next.softMode && next.hasProvider && !next.readyWithoutWallet) {
        next.ready = true;
    } else {
        next.ready = next.status === NETWORK_GATE_STATUS.ready;
    }
    snapshot = next;
    emit();
}

function fromLive(live, extra = {}) {
    const softMode = Boolean(extra.softMode ?? (isTrustWalletBrowser() || live?.hasTrustWallet));
    return {
        hasProvider: live.hasProvider,
        chainHex: live.chainHex || '',
        chainId: live.chainId || 0,
        providerName: live.providerName || '',
        hasEthereum: Boolean(live.hasEthereum),
        hasTrustWallet: Boolean(live.hasTrustWallet),
        readyWithoutWallet: false,
        softMode,
        ...extra,
    };
}

function readRejectedFlag() {
    if (typeof window === 'undefined') {
        return false;
    }
    try {
        return window.sessionStorage.getItem(REJECTED_KEY) === '1';
    } catch {
        return false;
    }
}

function writeSessionFlag(key, value) {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        if (value) {
            window.sessionStorage.setItem(key, '1');
        } else {
            window.sessionStorage.removeItem(key);
        }
    } catch {
        // private mode
    }
}

function writeRejectedFlag(value) {
    writeSessionFlag(REJECTED_KEY, value);
}

async function waitForProvider(maxMs = 2500) {
    const started = Date.now();
    restorePersistedProvider();
    while (Date.now() - started < maxMs) {
        if (getWalletProvider()) {
            bindWalletProviderListeners();
            return true;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 200));
    }
    return Boolean(getWalletProvider());
}

async function readLiveNetwork() {
    restorePersistedProvider();
    const debug = providerDebug();
    const hasProvider = Boolean(getWalletProvider());
    if (!hasProvider) {
        return { hasProvider: false, chainHex: '', chainId: 0, match: false, ...debug };
    }
    bindWalletProviderListeners();
    const chainHex = await readWalletChainIdHex().catch(() => '');
    const chainId = parseChainIdDecimal(chainHex);
    return {
        hasProvider: true,
        chainHex,
        chainId,
        match: isChainIdMatch(chainHex, targetChainId()),
        ...debug,
    };
}

async function prepareTrustProvider() {
    const trust = discoverTrustProvider();
    if (trust) {
        selectWalletProvider(trust, {
            id: 'trust-injected',
            name: 'Trust Wallet',
            rdns: 'com.trustwallet.app',
        });
        bindWalletProviderListeners();
    }
    // Wake provider after Disclaimer — accounts request first, then switch works more reliably.
    try {
        await walletRequest({ method: 'eth_requestAccounts' });
    } catch {
        // User may cancel Disclaimer; switch attempt can still follow.
    }
}

export function getNetworkGateSnapshot() {
    return { ...snapshot };
}

export function subscribeNetworkGate(fn) {
    listeners.add(fn);
    fn({ ...snapshot });
    return () => listeners.delete(fn);
}

export function isNetworkGateReady() {
    return snapshot.ready === true || snapshot.status === NETWORK_GATE_STATUS.ready;
}

export async function inspectWalletNetwork() {
    preserveAppUrl();
    setSnapshot({ status: NETWORK_GATE_STATUS.checking, readyWithoutWallet: false });
    const found = await waitForProvider();
    const live = await readLiveNetwork();
    const softMode = isTrustWalletBrowser() || live.hasTrustWallet;

    if (!found && !live.hasProvider) {
        setSnapshot({
            status: NETWORK_GATE_STATUS.ready,
            hasProvider: false,
            chainHex: '',
            chainId: 0,
            readyWithoutWallet: true,
            softMode: false,
            ...providerDebug(),
        });
        return getNetworkGateSnapshot();
    }

    if (live.match) {
        writeRejectedFlag(false);
        writeSessionFlag(AUTO_SWITCH_KEY, false);
        setSnapshot({
            status: NETWORK_GATE_STATUS.ready,
            ...fromLive(live, { softMode, manualHint: '' }),
        });
        return getNetworkGateSnapshot();
    }

    // Trust: never use rejected lock — soft banner only.
    if (softMode) {
        writeRejectedFlag(false);
        setSnapshot({
            status: NETWORK_GATE_STATUS.prompt,
            ...fromLive(live, {
                softMode: true,
                manualHint: trustManualHint(),
            }),
        });
        return getNetworkGateSnapshot();
    }

    if (readRejectedFlag()) {
        setSnapshot({
            status: NETWORK_GATE_STATUS.rejected,
            ...fromLive(live, { softMode: false }),
        });
        return getNetworkGateSnapshot();
    }

    setSnapshot({
        status: NETWORK_GATE_STATUS.prompt,
        ...fromLive(live, { softMode: false, manualHint: '' }),
    });
    return getNetworkGateSnapshot();
}

export async function requestBscNetworkSwitch() {
    if (switchInFlight) {
        return getNetworkGateSnapshot();
    }
    switchInFlight = true;
    writeRejectedFlag(false);
    writeSessionFlag(AUTO_SWITCH_KEY, false);
    preserveAppUrl();

    const softMode = isTrustWalletBrowser();
    setSnapshot({
        status: NETWORK_GATE_STATUS.waiting,
        waitingConfirm: false,
        softMode,
        message: 'Switching to BNB Smart Chain...',
    });

    const manualHint = softMode
        ? trustManualHint()
        : 'Open the wallet network list, choose BNB Smart Chain, then tap Retry.';

    try {
        if (softMode) {
            await prepareTrustProvider();
        }

        const before = await readLiveNetwork();
        if (before.match) {
            setSnapshot({
                status: NETWORK_GATE_STATUS.ready,
                waitingConfirm: false,
                ...fromLive(before, { softMode, manualHint: '' }),
            });
            return getNetworkGateSnapshot();
        }

        await switchToConfiguredNetwork(targetChainId());
        setSnapshot({
            status: NETWORK_GATE_STATUS.waiting,
            waitingConfirm: true,
            message: 'Waiting for wallet confirmation...',
            ...fromLive(before, { softMode }),
        });
        const waited = await waitUntilChainConfirmed(targetChainId(), {
            timeoutMs: softMode ? 45000 : 12000,
        });
        const afterId = parseChainIdDecimal(waited.chainHex);
        const after = { ...before, chainHex: waited.chainHex, chainId: afterId, match: waited.confirmed };
        if (!waited.confirmed) {
            setSnapshot({
                status: softMode ? NETWORK_GATE_STATUS.prompt : NETWORK_GATE_STATUS.unsupported,
                waitingConfirm: false,
                ...fromLive(after, { softMode, manualHint }),
            });
            return getNetworkGateSnapshot();
        }

        setSnapshot({
            status: NETWORK_GATE_STATUS.ready,
            waitingConfirm: false,
            ...fromLive(after, { softMode, manualHint: '' }),
        });
        return getNetworkGateSnapshot();
    } catch (error) {
        const after = await readLiveNetwork().catch(() => ({
            hasProvider: Boolean(getWalletProvider()),
            chainHex: '',
            chainId: 0,
            match: false,
            ...providerDebug(),
        }));
        if (after.match) {
            writeRejectedFlag(false);
            setSnapshot({
                status: NETWORK_GATE_STATUS.ready,
                waitingConfirm: false,
                ...fromLive(after, { softMode, manualHint: '' }),
            });
            return getNetworkGateSnapshot();
        }

        if (softMode || isTrustWalletBrowser()) {
            writeRejectedFlag(false);
            writeSessionFlag(AUTO_SWITCH_KEY, false);
            setSnapshot({
                status: NETWORK_GATE_STATUS.prompt,
                waitingConfirm: false,
                ...fromLive(after, {
                    softMode: true,
                    manualHint: `${trustDisclaimerHint()} ${manualHint}`,
                }),
            });
            return getNetworkGateSnapshot();
        }

        const rejected = /cancel|reject|denied/i.test(String(error?.message || ''));
        writeRejectedFlag(rejected);
        setSnapshot({
            status: rejected ? NETWORK_GATE_STATUS.rejected : NETWORK_GATE_STATUS.unsupported,
            waitingConfirm: false,
            ...fromLive(after, { softMode: false, manualHint: rejected ? '' : manualHint }),
        });
        return getNetworkGateSnapshot();
    } finally {
        switchInFlight = false;
    }
}

async function onProviderSignal() {
    if (switchInFlight) {
        return;
    }
    restorePersistedProvider();
    bindWalletProviderListeners();
    const live = await readLiveNetwork();
    const softMode = isTrustWalletBrowser() || live.hasTrustWallet;

    if (!live.hasProvider) {
        setSnapshot({
            status: NETWORK_GATE_STATUS.ready,
            hasProvider: false,
            chainHex: '',
            chainId: 0,
            readyWithoutWallet: true,
            softMode: false,
            ...providerDebug(),
        });
        return;
    }
    if (live.match) {
        writeRejectedFlag(false);
        setSnapshot({
            status: NETWORK_GATE_STATUS.ready,
            ...fromLive(live, { softMode, manualHint: '' }),
        });
        return;
    }
    if (softMode) {
        writeRejectedFlag(false);
        setSnapshot({
            status: NETWORK_GATE_STATUS.prompt,
            ...fromLive(live, { softMode: true, manualHint: trustManualHint() }),
        });
        return;
    }
    if (snapshot.status === NETWORK_GATE_STATUS.rejected || readRejectedFlag()) {
        setSnapshot({
            status: NETWORK_GATE_STATUS.rejected,
            ...fromLive(live, { softMode: false }),
        });
        return;
    }
    setSnapshot({
        status: NETWORK_GATE_STATUS.prompt,
        ...fromLive(live, { softMode: false }),
    });
}

function bindPageLifecycle() {
    if (visibilityBound || typeof window === 'undefined') {
        return;
    }
    visibilityBound = true;

    const recheck = () => {
        onProviderSignal().catch(() => {});
    };

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            recheck();
        }
    });
    window.addEventListener('pageshow', recheck);
    window.addEventListener('focus', recheck);
}

export async function bootNetworkGate() {
    if (booted) {
        return getNetworkGateSnapshot();
    }
    booted = true;
    bindPageLifecycle();
    providerUnsubscribe();
    providerUnsubscribe = subscribeWalletEvents({
        onChainChanged: () => {
            onProviderSignal().catch(() => {});
        },
        onAccountsChanged: () => {
            onProviderSignal().catch(() => {});
        },
        onConnect: () => {
            onProviderSignal().catch(() => {});
        },
        onDisconnect: () => {
            onProviderSignal().catch(() => {});
        },
    });

    const snap = await inspectWalletNetwork();

    // Trust: soft banner only — never auto wallet_switch on boot (Disclaimer race).
    if (isTrustWalletBrowser() || snap.softMode) {
        return getNetworkGateSnapshot();
    }

    let autoStarted = false;
    try {
        autoStarted = window.sessionStorage.getItem(AUTO_SWITCH_KEY) === '1';
    } catch {
        autoStarted = false;
    }
    if (
        snap.hasProvider
        && snap.status !== NETWORK_GATE_STATUS.ready
        && snap.status !== NETWORK_GATE_STATUS.rejected
        && isInAppWalletBrowser()
        && !autoStarted
    ) {
        writeSessionFlag(AUTO_SWITCH_KEY, true);
        await requestBscNetworkSwitch();
    }
    return getNetworkGateSnapshot();
}
