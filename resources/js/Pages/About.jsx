import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function About() {
    return (
        <AuthenticatedLayout
            pageTitle="Support"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Support"
        >
            <Head title="Support" />

            <MemberPageShell>
                <MemberPageHero kicker="Member support" title="Help & policies" variant="pdf" icon="support">
                    Programme overview and policies are on the public home page. Logged-in balances and payouts appear in
                    your member area under{' '}
                    <a href="/#plan" className="font-semibold text-white underline underline-offset-2 hover:text-sky-100">
                        Business plan
                    </a>
                    .
                </MemberPageHero>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
