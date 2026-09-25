import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import AuthPremiumShell from '@/Components/Auth/AuthPremiumShell';
import WalletConnectAuthButton from '@/Components/WalletConnectAuthButton';
import GuestLayout from '@/Layouts/GuestLayout';
import { AUTH_GLASS_INPUT, AUTH_LABEL } from '@/lib/memberTheme';
import { Head, Link } from '@inertiajs/react';
import { useMemo, useState } from 'react';

const glassInput = AUTH_GLASS_INPUT;
const labelClass = AUTH_LABEL;

function IconKey() {
    return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
            />
        </svg>
    );
}

function normalizeJoinCode(value) {
    return String(value ?? '')
        .replace(/\s/g, '')
        .slice(0, 8)
        .toUpperCase();
}

export default function Register({
    status,
    join_code: joinCodeProp = null,
    join_code_locked: joinCodeLocked = false,
}) {
    const initialCode = useMemo(() => normalizeJoinCode(joinCodeProp), [joinCodeProp]);
    const [joinCode, setJoinCode] = useState(initialCode);
    const joinCodeValid = joinCode.length === 8;

    return (
        <GuestLayout
            hideHeader
            authPremium
            centerAuth
            mainClassName="w-full max-w-xl"
            contentClassName="max-sm:px-2 max-sm:py-3 sm:py-10"
        >
            <Head title="Create account" />

            <AuthPremiumShell
                title="Create account"
                subtitle="Enter your sponsor join code, then connect your wallet to register."
                status={status}
                footer={
                    <p className="text-center text-xs text-slate-400 sm:text-sm">
                        Already registered?{' '}
                        <Link
                            href={route('login')}
                            className="font-bold text-sky-400 transition hover:text-sky-300 hover:underline"
                        >
                            Sign in
                        </Link>
                    </p>
                }
            >
                <div className="space-y-4 sm:space-y-5">
                    <ol className="space-y-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[11px] leading-relaxed text-slate-300 sm:px-4 sm:text-xs">
                        <li>
                            <span className="font-semibold text-white">1.</span> Enter the 8-character join code
                            from your sponsor.
                        </li>
                        <li>
                            <span className="font-semibold text-white">2.</span> Connect any crypto wallet on BNB
                            Smart Chain.
                        </li>
                        <li>
                            <span className="font-semibold text-white">3.</span> Sign the message to create your
                            account.
                        </li>
                    </ol>

                    <div>
                        <InputLabel htmlFor="join_code" value="Join code" className={labelClass} />
                        <div className="relative mt-1 [&_input]:pl-10 sm:[&_input]:pl-11">
                            <span className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-[#2563EB] sm:left-3.5">
                                <IconKey />
                            </span>
                            <TextInput
                                id="join_code"
                                name="join_code"
                                value={joinCode}
                                className={`block w-full font-mono uppercase tracking-wider max-sm:!rounded-xl ${glassInput}`}
                                placeholder="XXXXXXXX"
                                required
                                readOnly={Boolean(joinCodeLocked)}
                                maxLength={8}
                                autoComplete="off"
                                isFocused={!joinCodeLocked}
                                onChange={(e) => setJoinCode(normalizeJoinCode(e.target.value))}
                            />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-300 sm:text-xs">
                            {joinCodeLocked
                                ? 'Join code locked from your invitation link.'
                                : 'Required — use the registration link or code shared by your sponsor.'}
                        </p>
                    </div>

                    <WalletConnectAuthButton
                        action="register"
                        joinCode={joinCode}
                        disabled={!joinCodeValid}
                        label="Connect wallet & register"
                    />
                </div>
            </AuthPremiumShell>
        </GuestLayout>
    );
}
