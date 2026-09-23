import GlobalFlashModal from '@/Components/GlobalFlashModal';
import RaceNetworkSite from '@/Components/RaceSite/RaceNetworkSite';
import { Head } from '@inertiajs/react';

export default function Welcome() {
    return (
        <>
            <Head title="racenetwork.live">
                <meta head-key="og:title" property="og:title" content="racenetwork.live" />
                <meta head-key="og:site_name" property="og:site_name" content="racenetwork.live" />
                <meta
                    head-key="og:description"
                    property="og:description"
                    content="RACE Network — Powering Community-Owned Digital Economies"
                />
            </Head>
            <GlobalFlashModal />
            <RaceNetworkSite />
        </>
    );
}
