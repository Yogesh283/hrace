import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import MemberTableScroll from '@/Components/Member/MemberTableScroll';
import PrimaryButton from '@/Components/PrimaryButton';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import { useState } from 'react';

function formatUsd(value) {
    const n = Number(value);
    if (Number.isNaN(n)) {
        return '—';
    }
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n);
}

export default function Lending({ lending_access, positions = [], lending_enabled = false }) {
    const blocked = lending_access?.blocked === true;
    const [apiMessage, setApiMessage] = useState('');

    const tryCreateSmart = async () => {
        setApiMessage('');
        try {
            const { data } = await axios.post(route('lending.smart.store'), { selected_amount: 100 });
            setApiMessage(data.message || 'OK');
        } catch (err) {
            const payload = err.response?.data;
            setApiMessage(payload?.message || 'Request failed');
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Lending" />
            <MemberPageShell>
                <MemberPageHero title="Lending" subtitle="Smart Lending & Smart Pro (on-chain)" />

                {blocked ? (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
                        <p className="text-sm font-semibold uppercase tracking-wide">Lending ID: BLOCKED</p>
                        <p className="mt-2 text-lg font-bold">Lending ID Blocked</p>
                        <p className="mt-3 text-sm">
                            <span className="font-semibold">Reason:</span> {lending_access?.reason || '—'}
                        </p>
                        <p className="mt-1 text-sm">
                            <span className="font-semibold">Status:</span> Blocked
                        </p>
                    </div>
                ) : (
                    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                        <p className="text-sm font-semibold">LENDING ID: ACTIVE</p>
                        <p className="mt-1 text-sm text-emerald-800">
                            {lending_enabled
                                ? 'You may initiate new lending via the on-chain contract when available.'
                                : 'Lending contract integration is read-only until deployment.'}
                        </p>
                    </div>
                )}

                {!blocked && lending_enabled ? (
                    <div className="mb-6">
                        <PrimaryButton type="button" onClick={tryCreateSmart}>
                            Request Smart Lending (access check)
                        </PrimaryButton>
                        {apiMessage ? <p className="mt-2 text-sm text-slate-600">{apiMessage}</p> : null}
                    </div>
                ) : null}

                <h2 className="mb-3 text-lg font-semibold text-slate-900">Lending history (indexed)</h2>
                <MemberTableScroll>
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b text-left text-slate-500">
                                <th className="py-2 pr-4">Position</th>
                                <th className="py-2 pr-4">Product</th>
                                <th className="py-2 pr-4">Selected</th>
                                <th className="py-2 pr-4">Security</th>
                                <th className="py-2 pr-4">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-6 text-slate-500">
                                        No indexed positions yet.
                                    </td>
                                </tr>
                            ) : (
                                positions.map((row) => (
                                    <tr key={row.position_id} className="border-b border-slate-100">
                                        <td className="py-2 pr-4">#{row.position_id}</td>
                                        <td className="py-2 pr-4">{row.product_type}</td>
                                        <td className="py-2 pr-4">{formatUsd(row.selected_amount)}</td>
                                        <td className="py-2 pr-4">{formatUsd(row.security_amount)}</td>
                                        <td className="py-2 pr-4">{row.status}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </MemberTableScroll>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
