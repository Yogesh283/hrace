import AuthPremiumShell from '@/Components/Auth/AuthPremiumShell';
import WalletConnectAuthButton from '@/Components/WalletConnectAuthButton';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link } from '@inertiajs/react';

export default function Login({ status }) {
    return (
        <GuestLayout
            hideHeader
            authPremium
            centerAuth
            mainClassName="w-full max-w-xl"
            contentClassName="max-sm:px-2 max-sm:py-3 sm:py-10"
        >
            <Head title="Sign in" />

            <AuthPremiumShell
                title="Sign in"
                subtitle="Connect your wallet and sign a one-time message. No password required."
                status={status}
                footer={
                    <p className="text-center text-xs text-slate-400 sm:text-sm">
                        New here?{' '}
                        <Link
                            href={route('register')}
                            className="font-bold text-sky-400 transition hover:text-sky-300 hover:underline"
                        >
                            Create an account
                        </Link>
                    </p>
                }
            >
                <div className="space-y-4">
                    <ol className="space-y-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[11px] leading-relaxed text-slate-300 sm:px-4 sm:text-xs">
                        <li>
                            <span className="font-semibold text-white">1.</span> Use any crypto wallet on BNB Smart
                            Chain — tap Connect and choose yours.
                        </li>
                        <li>
                            <span className="font-semibold text-white">2.</span> Tap the button below and approve
                            the connection.
                        </li>
                        <li>
                            <span className="font-semibold text-white">3.</span> Sign the message to enter your
                            dashboard.
                        </li>
                    </ol>

                    <WalletConnectAuthButton action="login" label="Connect wallet & sign in" />

                    <p className="text-center text-[11px] text-slate-300 sm:text-xs">
                        On phone: open this site inside TokenPocket / Trust / MetaMask DApp browser, then tap
                        Connect. Chrome or Safari alone often cannot finish wallet login.
                    </p>
                    <p className="text-center text-[11px] text-slate-300 sm:text-xs">
                        Wallet not registered yet? Use your sponsor join code on the register page first.
                    </p>
                </div>
            </AuthPremiumShell>
        </GuestLayout>
    );
}
