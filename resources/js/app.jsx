import '../css/app.css';
import './bootstrap';

import NavigationLoader from '@/Components/NavigationLoader';
import { configureWeb3Network, resolvePageChainId } from '@/lib/web3Deposit';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { Fragment } from 'react';

const appName = import.meta.env.VITE_APP_NAME || 'racenetwork.live';

function syncWeb3NetworkFromPage(page) {
    const blockchain = page?.props?.blockchain;
    if (!blockchain) {
        return;
    }

    configureWeb3Network({
        chainId: resolvePageChainId(blockchain),
        usdtContract: blockchain.contracts?.usdt || blockchain.web3?.usdt_contract,
        rpcUrl: blockchain.rpc_url,
    });

    if (import.meta.env.DEV) {
        const ico = blockchain.ico ?? {};
        console.log('[web3:sync]', {
            chainId: blockchain.chain_id,
            isTestnet: blockchain.is_testnet,
            onChainMode: ico.on_chain_enabled,
            raceCommunityEngine: ico.community_engine ?? ico.contracts?.community_engine,
            raceIco: ico.ico_contract ?? ico.contracts?.ico,
            usdt: ico.usdt_contract ?? ico.contracts?.usdt ?? blockchain.contracts?.usdt,
            icoReady: ico.ico_ready,
        });
    }
}

// Session / CSRF expired — reload so Laravel serves the HTML shell again.
router.on('invalid', (event) => {
    const status = event.detail.response?.status;
    if (status === 419 || status === 409) {
        window.location.reload();
    }
});

router.on('success', (event) => {
    syncWeb3NetworkFromPage(event.detail.page);
});

// Mobile browsers restore inactive tabs from cache; reload to rehydrate Inertia.
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        window.location.reload();
    }
});

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        syncWeb3NetworkFromPage(props.initialPage);
        const root = createRoot(el);

        root.render(
            <Fragment>
                <NavigationLoader />
                <App {...props} />
            </Fragment>,
        );
    },
    progress: false,
});
