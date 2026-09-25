import MemberAlert from '@/Components/Member/MemberAlert';
import MemberEmptyState from '@/Components/Member/MemberEmptyState';
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
        <AuthenticatedLayout pageTitle="Lending" mobileFintechPageTitle="Lending">
            <Head title="Lending" />
            <MemberPageShell>
                <MemberPageHero title="Lending" subtitle="Smart Lending & Smart Pro (on-chain)" />

                {blocked ? (
                    <MemberAlert variant="error" title="Lending ID blocked">
                        <p>
                            <span className="font-semibold">Reason:</span> {lending_access?.reason || '—'}
                        </p>
                        <p className="mt-1">
                            <span className="font-semibold">Status:</span> Blocked
                        </p>
                    </MemberAlert>
                ) : (
                    <MemberAlert variant="success" title="Lending ID: Active">
                        {lending_enabled
                            ? 'You may initiate new lending via the on-chain contract when available.'
                            : 'Lending contract integration is read-only until deployment.'}
                    </MemberAlert>
                )}

                {!blocked && lending_enabled ? (
                    <div className="mb-6">
                        <PrimaryButton type="button" onClick={tryCreateSmart}>
                            Request Smart Lending (access check)
                        </PrimaryButton>
                        {apiMessage ? <p className="mt-2 text-sm text-slate-200">{apiMessage}</p> : null}
                    </div>
                ) : null}

                <h2 className="rx-type-h2 mb-3">Lending history (indexed)</h2>
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
                                    <td colSpan={5} className="p-0">
                                        <MemberEmptyState>No indexed positions yet.</MemberEmptyState>
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
