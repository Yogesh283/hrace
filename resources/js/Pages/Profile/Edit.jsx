import MemberCard from '@/Components/Member/MemberCard';
import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import ProfileInformationDisplay from './Partials/ProfileInformationDisplay';

export default function Edit({ profile = {} }) {
    return (
        <AuthenticatedLayout
            pageTitle="Profile"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Profile"
        >
            <Head title="Profile" />

            <MemberPageShell>
                <MemberPageHero kicker="Account" title="Profile" variant="pdf" icon="profile">
                    Your member ID, referral code, connected wallet, and deposit / withdrawal totals.
                </MemberPageHero>

                <MemberCard density="spacious">
                    <ProfileInformationDisplay profile={profile} />
                </MemberCard>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
