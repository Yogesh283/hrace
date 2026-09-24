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
import { useCallback, useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';

/**
 * Tracks wallet chain vs Laravel blockchain config; exposes switch/connect helpers.
 */
export function useWalletNetwork({ expectedChainId } = {}) {
    const blockchain = usePage().props?.blockchain ?? {};
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
        if (!hasWeb3Wallet()) {
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
            setChainOk(false);
        }
    }, [targetChainId]);

    useEffect(() => {
        refreshChain();
        return subscribeWalletEvents({
            onChainChanged: refreshChain,
            onAccountsChanged: refreshChain,
        });
    }, [refreshChain]);

    const switchNetwork = useCallback(async () => {
        if (!hasWeb3Wallet()) {
            const message = 'No Web3 wallet detected. Install MetaMask or another EVM wallet.';
            setNetworkError(message);
            throw new Error(message);
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
    }, [targetChainId, refreshChain]);

    const connectWallet = useCallback(async () => {
        if (!hasWeb3Wallet()) {
            const message = 'No Web3 wallet detected. Install MetaMask or another EVM wallet.';
            setNetworkError(message);
            throw new Error(message);
        }

        setSwitching(true);
        setNetworkError('');
        try {
            const { address } = await connectWalletWithNetwork(targetChainId);
            await refreshChain();
            return address;
        } catch (error) {
            const message = error?.message || 'Wallet connection was cancelled or failed.';
            setNetworkError(message);
            throw error;
        } finally {
            setSwitching(false);
        }
    }, [targetChainId, refreshChain]);

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
