import {
    configureWeb3Network,
    connectWalletWithNetwork,
    getActiveChainId,
    isChainIdMatch,
    isTestnetMode,
    readWalletChainIdHex,
    switchToConfiguredNetwork,
    subscribeWalletEvents,
} from '@/lib/web3Deposit';
import { hasWeb3Wallet } from '@/lib/web3Auth';
import {
    getWalletProvider,
    hasWalletSession,
    NO_WALLET_MESSAGE,
    resolveSessionWallet,
    restorePersistedProvider,
} from '@/lib/web3Wallet';
import { useCallback, useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';

/**
 * Tracks wallet chain vs Laravel blockchain config; exposes switch/connect helpers.
 */
export function useWalletNetwork({ expectedChainId } = {}) {
    const page = usePage();
    const blockchain = page.props?.blockchain ?? {};
    const boundWallet = String(page.props?.auth?.user?.wallet_address ?? '').trim();
    const targetChainId = Number(
        expectedChainId ?? blockchain.chain_id ?? getActiveChainId(),
    );
    const testnet = targetChainId === 97 || isTestnetMode();

    useEffect(() => {
        configureWeb3Network({ chainId: targetChainId });
    }, [targetChainId]);

    const [chainHex, setChainHex] = useState(null);
    const [chainOk, setChainOk] = useState(true);
    const [switching, setSwitching] = useState(false);
    const [networkError, setNetworkError] = useState('');

    const refreshChain = useCallback(async () => {
        restorePersistedProvider();
        if (!hasWeb3Wallet() || !getWalletProvider()) {
            setChainHex(null);
            setChainOk(true);
            return;
        }

        try {
            const hex = await readWalletChainIdHex();
            setChainHex(hex);
            setChainOk(isChainIdMatch(hex, targetChainId));
        } catch {
            setChainHex(null);
            setChainOk(true);
        }
    }, [targetChainId]);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe = () => {};

        async function boot() {
            if (boundWallet) {
                await resolveSessionWallet({ boundAddress: boundWallet, allowPicker: false }).catch(() => null);
            } else {
                restorePersistedProvider();
            }
            if (cancelled) {
                return;
            }
            unsubscribe();
            unsubscribe = subscribeWalletEvents({
                onChainChanged: refreshChain,
                onAccountsChanged: refreshChain,
            });
            await refreshChain();
        }

        boot();
        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [boundWallet, refreshChain, targetChainId]);

    const switchNetwork = useCallback(async () => {
        if (!hasWeb3Wallet()) {
            const message = NO_WALLET_MESSAGE;
            setNetworkError(message);
            throw new Error(message);
        }

        if (boundWallet) {
            await resolveSessionWallet({ boundAddress: boundWallet, allowPicker: false }).catch(() => null);
        }

        setSwitching(true);
        setNetworkError('');
        try {
            await switchToConfiguredNetwork(targetChainId);
            await refreshChain();
        } catch (error) {
            const message = error?.message || 'Network switch failed.';
            setNetworkError(message);
            setChainOk(false);
            throw error;
        } finally {
            setSwitching(false);
        }
    }, [targetChainId, refreshChain, boundWallet]);

    const connectWallet = useCallback(async () => {
        setSwitching(true);
        setNetworkError('');
        try {
            const { address } = await connectWalletWithNetwork(targetChainId, {
                boundAddress: boundWallet,
                allowPicker: !boundWallet && !hasWalletSession(),
            });
            await refreshChain();
            return address;
        } catch (error) {
            const message = error?.message || 'Wallet connection was cancelled or failed.';
            setNetworkError(message);
            throw error;
        } finally {
            setSwitching(false);
        }
    }, [targetChainId, refreshChain, boundWallet]);

    return {
        targetChainId,
        isTestnet: testnet,
        chainHex,
        chainOk,
        switching,
        networkError,
        refreshChain,
        switchNetwork,
        connectWallet,
        networkLabel: testnet ? 'BSC Testnet' : 'BNB Smart Chain',
        connectedLabel: testnet ? 'Connected to BSC Testnet' : 'Connected to BNB Smart Chain',
        switchButtonLabel: testnet ? 'Switch to BSC Testnet' : 'Switch to BNB Smart Chain',
    };
}
