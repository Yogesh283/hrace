import WalletSelectModal from '@/Components/WalletSelectModal';
import { openWalletDeepLink, selectWalletProvider } from '@/lib/web3Wallet';
import { useEffect, useState } from 'react';

export default function WalletPickerHost() {
    const [open, setOpen] = useState(false);
    const [wallets, setWallets] = useState([]);

    useEffect(() => {
        const onPick = (event) => {
            const detail = event.detail || {};
            setWallets(detail.wallets || []);
            setOpen(true);
            window.__raceWalletPickResolve = detail.resolve;
        };
        window.addEventListener('race:pick-wallet', onPick);
        return () => window.removeEventListener('race:pick-wallet', onPick);
    }, []);

    const finish = (wallet) => {
        setOpen(false);
        const resolve = window.__raceWalletPickResolve;
        window.__raceWalletPickResolve = null;
        resolve?.(wallet || null);
    };

    const handlePick = (wallet) => {
        if (wallet?.provider) {
            selectWalletProvider(wallet.provider, wallet);
            finish(wallet);
            return;
        }
        if (wallet?.id) {
            openWalletDeepLink(wallet);
            finish({
                id: wallet.id,
                name: wallet.name,
                openedApp: true,
            });
            return;
        }
        finish(null);
    };

    return (
        <WalletSelectModal
            open={open}
            wallets={wallets}
            onPick={handlePick}
            onClose={() => finish(null)}
        />
    );
}
