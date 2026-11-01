import {
    BSC_MAINNET_CHAIN_ID,
    BSC_TESTNET_CHAIN_ID,
    bindWalletProviderListeners,
    getActiveChainId,
    isChainIdMatch,
    isInAppWalletBrowser,
    isTrustWalletBrowser,
    parseChainIdDecimal,
    readWalletChainIdHex,
    subscribeWalletEvents,
    switchToConfiguredNetwork,
} from '@/lib/web3Deposit';
import { getWalletProvider, restorePersistedProvider } from '@/lib/web3Wallet';

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
};

function targetChainId() {
    return getActiveChainId() || BSC_MAINNET_CHAIN_ID;
}

function networkTitle() {
    return targetChainId() === BSC_TESTNET_CHAIN_ID ? 'BSC Testnet' : 'BSC Mainnet';
}

function messageFor(status) {
    switch (status) {
        case NETWORK_GATE_STATUS.checking:
            return 'Checking wallet network...';
        case NETWORK_GATE_STATUS.prompt:
            return `Please switch to ${networkTitle()}.`;
        case NETWORK_GATE_STATUS.waiting:
            return 'Waiting for wallet approval...';
        case NETWORK_GATE_STATUS.ready:
            return `${networkTitle()} connected successfully.`;
        case NETWORK_GATE_STATUS.rejected:
            return 'Network switch rejected. Please retry.';
        case NETWORK_GATE_STATUS.unsupported:
            return 'Unsupported network.';
        default:
            return 'Checking wallet network...';
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
    if (patch.status && patch.message === undefined) {
        next.message = messageFor(patch.status);
    }
    next.ready = next.status === NETWORK_GATE_STATUS.ready;
    snapshot = next;
    emit();
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

async function waitForProvider(maxMs = 2000) {
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
    const hasProvider = Boolean(getWalletProvider());
    if (!hasProvider) {
        return { hasProvider: false, chainHex: '', chainId: 0, match: false };
    }
    bindWalletProviderListeners();
    const chainHex = await readWalletChainIdHex().catch(() => '');
    const chainId = parseChainIdDecimal(chainHex);
    return {
        hasProvider: true,
        chainHex,
        chainId,
        match: isChainIdMatch(chainHex, targetChainId()),
    };
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
    return snapshot.status === NETWORK_GATE_STATUS.ready;
}

export async function inspectWalletNetwork() {
    setSnapshot({ status: NETWORK_GATE_STATUS.checking, readyWithoutWallet: false });
    const found = await waitForProvider();
    const live = await readLiveNetwork();

    if (!found && !live.hasProvider) {
        setSnapshot({
            status: NETWORK_GATE_STATUS.ready,
            hasProvider: false,
            chainHex: '',
            chainId: 0,
            readyWithoutWallet: true,
        });
        return getNetworkGateSnapshot();
    }

    if (live.match) {
        writeRejectedFlag(false);
        writeSessionFlag(AUTO_SWITCH_KEY, false);
        setSnapshot({
            status: NETWORK_GATE_STATUS.ready,
            hasProvider: true,
            chainHex: live.chainHex,
            chainId: live.chainId,
            readyWithoutWallet: false,
        });
        return getNetworkGateSnapshot();
    }

    if (readRejectedFlag()) {
        setSnapshot({
            status: NETWORK_GATE_STATUS.rejected,
            hasProvider: true,
            chainHex: live.chainHex,
            chainId: live.chainId,
            readyWithoutWallet: false,
        });
        return getNetworkGateSnapshot();
    }

    setSnapshot({
        status: live.chainId ? NETWORK_GATE_STATUS.unsupported : NETWORK_GATE_STATUS.prompt,
        hasProvider: true,
        chainHex: live.chainHex,
        chainId: live.chainId,
        readyWithoutWallet: false,
    });
    return getNetworkGateSnapshot();
}

export async function requestBscNetworkSwitch() {
    if (switchInFlight) {
        return getNetworkGateSnapshot();
    }
    switchInFlight = true;
    writeRejectedFlag(false);
    setSnapshot({ status: NETWORK_GATE_STATUS.waiting });

    try {
        const before = await readLiveNetwork();
        if (before.match) {
            setSnapshot({
                status: NETWORK_GATE_STATUS.ready,
                hasProvider: true,
                chainHex: before.chainHex,
                chainId: before.chainId,
                readyWithoutWallet: false,
            });
            return getNetworkGateSnapshot();
        }

        await switchToConfiguredNetwork(targetChainId());
        const after = await readLiveNetwork();
        if (!after.match) {
            setSnapshot({
                status: NETWORK_GATE_STATUS.unsupported,
                hasProvider: after.hasProvider,
                chainHex: after.chainHex,
                chainId: after.chainId,
                readyWithoutWallet: false,
            });
            return getNetworkGateSnapshot();
        }

        setSnapshot({
            status: NETWORK_GATE_STATUS.ready,
            hasProvider: true,
            chainHex: after.chainHex,
            chainId: after.chainId,
            readyWithoutWallet: false,
        });
        return getNetworkGateSnapshot();
    } catch (error) {
        const after = await readLiveNetwork().catch(() => ({
            hasProvider: Boolean(getWalletProvider()),
            chainHex: '',
            chainId: 0,
            match: false,
        }));
        if (after.match) {
            writeRejectedFlag(false);
            setSnapshot({
                status: NETWORK_GATE_STATUS.ready,
                hasProvider: true,
                chainHex: after.chainHex,
                chainId: after.chainId,
                readyWithoutWallet: false,
            });
            return getNetworkGateSnapshot();
        }

        const rejected = /cancel|reject|denied/i.test(String(error?.message || ''));
        writeRejectedFlag(rejected);
        setSnapshot({
            status: rejected ? NETWORK_GATE_STATUS.rejected : NETWORK_GATE_STATUS.unsupported,
            hasProvider: after.hasProvider,
            chainHex: after.chainHex,
            chainId: after.chainId,
            readyWithoutWallet: false,
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
    const live = await readLiveNetwork();
    if (!live.hasProvider) {
        setSnapshot({
            status: NETWORK_GATE_STATUS.ready,
            hasProvider: false,
            chainHex: '',
            chainId: 0,
            readyWithoutWallet: true,
        });
        return;
    }
    if (live.match) {
        writeRejectedFlag(false);
        setSnapshot({
            status: NETWORK_GATE_STATUS.ready,
            hasProvider: true,
            chainHex: live.chainHex,
            chainId: live.chainId,
            readyWithoutWallet: false,
        });
        return;
    }
    if (snapshot.status === NETWORK_GATE_STATUS.rejected || readRejectedFlag()) {
        setSnapshot({
            status: NETWORK_GATE_STATUS.rejected,
            hasProvider: true,
            chainHex: live.chainHex,
            chainId: live.chainId,
            readyWithoutWallet: false,
        });
        return;
    }
    setSnapshot({
        status: live.chainId ? NETWORK_GATE_STATUS.unsupported : NETWORK_GATE_STATUS.prompt,
        hasProvider: true,
        chainHex: live.chainHex,
        chainId: live.chainId,
        readyWithoutWallet: false,
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
    let autoStarted = false;
    try {
        autoStarted = window.sessionStorage.getItem(AUTO_SWITCH_KEY) === '1';
    } catch {
        autoStarted = false;
    }
    if (
        snap.hasProvider
        && !snap.ready
        && snap.status !== NETWORK_GATE_STATUS.rejected
        && (isTrustWalletBrowser() || isInAppWalletBrowser())
        && !autoStarted
    ) {
        writeSessionFlag(AUTO_SWITCH_KEY, true);
        await requestBscNetworkSwitch();
    }
    return getNetworkGateSnapshot();
}
