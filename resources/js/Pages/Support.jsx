import PanelCard from '@/Components/PanelCard';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, usePage } from '@inertiajs/react';

const STATUS_LABELS = {
    open: 'Open',
    in_progress: 'In progress',
    resolved: 'Resolved',
    closed: 'Closed',
};

function statusClass(status) {
    switch (status) {
        case 'resolved':
            return 'bg-emerald-100 text-emerald-800';
        case 'closed':
            return 'bg-slate-100 text-slate-700';
        case 'in_progress':
            return 'bg-sky-100 text-sky-800';
        default:
            return 'bg-amber-100 text-amber-900';
    }
}

function formatDate(createdAt) {
    if (!createdAt) return '—';
    return new Date(createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function Support({ tickets = [] }) {
    const { flash } = usePage().props;
    const { data, setData, post, processing, reset, errors } = useForm({
        subject: '',
        message: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('support.store'), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <AuthenticatedLayout
            pageTitle="Support"
            memberSurface="race"
            showMobileFintechNav
            mobileFintechPageTitle="Support"
        >
            <Head title="Support" />

            <MemberPageShell contentClassName="space-y-5 sm:space-y-6">
                <MemberPageHero kicker="Member support" title="Support & complaints" variant="pdf" icon="support">
                    Submit a complaint or question. You will receive a unique ticket token — save it to track your request.
                </MemberPageHero>

                {flash?.status ? (
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/95 px-4 py-3 text-sm font-medium text-emerald-950">
                        {flash.status}
                    </div>
                ) : null}

                {flash?.error ? (
                    <div className="rounded-xl border border-red-200/80 bg-red-50/95 px-4 py-3 text-sm font-medium text-red-900">
                        {flash.error}
                    </div>
                ) : null}

                <PanelCard title="New support ticket" icon="support">
                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-fintech-ink">Subject</label>
                            <TextInput
                                value={data.subject}
                                className="mt-2 block w-full"
                                placeholder="Brief summary of your issue"
                                onChange={(e) => setData('subject', e.target.value)}
                                required
                            />
                            {errors.subject ? (
                                <p className="mt-1 text-xs text-red-600">{errors.subject}</p>
                            ) : null}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-fintech-ink">Message</label>
                            <textarea
                                value={data.message}
                                rows={5}
                                className="mt-2 block w-full rounded-xl border border-[#2563EB]/35 bg-[#0F172A]/80 px-3 py-2.5 text-sm text-slate-100 shadow-sm caret-sky-300 placeholder:text-slate-500 focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/30"
                                placeholder="Describe your complaint or question in detail…"
                                onChange={(e) => setData('message', e.target.value)}
                                required
                            />
                            {errors.message ? (
                                <p className="mt-1 text-xs text-red-600">{errors.message}</p>
                            ) : null}
                        </div>
                        <PrimaryButton
                            type="submit"
                            className="w-full justify-center py-3"
                            disabled={processing || !data.subject.trim() || !data.message.trim()}
                        >
                            {processing ? 'Creating ticket…' : 'Create ticket'}
                        </PrimaryButton>
                    </form>
                </PanelCard>

                <PanelCard title="Your tickets" icon="transactions">
                    {tickets.length === 0 ? (
                        <p className="text-sm text-fintech-muted">No tickets yet. Create one above.</p>
                    ) : (
                        <ul className="divide-y divide-fintech-line rounded-xl border border-fintech-line bg-white">
                            {tickets.map((t) => (
                                <li key={t.id} className="px-4 py-3.5">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-mono text-xs font-bold text-[#2563EB]">{t.token}</p>
                                            <p className="mt-1 text-sm font-semibold text-fintech-ink">{t.subject}</p>
                                            <p className="mt-0.5 text-xs text-fintech-muted">{formatDate(t.created_at)}</p>
                                        </div>
                                        <span
                                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClass(t.status)}`}
                                        >
                                            {STATUS_LABELS[t.status] ?? t.status}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </PanelCard>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
