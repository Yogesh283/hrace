import Modal from '@/Components/Modal';
import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

function flattenErrors(errors) {
    if (!errors || typeof errors !== 'object') {
        return [];
    }
    const out = [];
    for (const v of Object.values(errors)) {
        if (Array.isArray(v)) {
            out.push(...v.map(String));
        } else if (typeof v === 'string') {
            out.push(v);
        } else if (v && typeof v === 'object') {
            out.push(...flattenErrors(v));
        }
    }
    return out;
}

function errorLines(page) {
    const errors = page.props.errors ?? {};
    const flash = page.props.flash ?? {};
    const lines = flattenErrors(errors);
    if (flash.error) {
        lines.unshift(String(flash.error));
    }
    return lines;
}

/**
 * All success / error / validation feedback goes through this modal only
 * (no inline banners or field error text elsewhere).
 */
export default function GlobalFlashModal() {
    const page = usePage();
    const [open, setOpen] = useState(false);
    const [variant, setVariant] = useState('error');
    const [title, setTitle] = useState('Notice');
    const [messages, setMessages] = useState([]);
    const dismissedKey = useRef('');

    const showPopup = useCallback((nextVariant, nextTitle, nextMessages) => {
        const key = `${nextVariant}:${JSON.stringify(nextMessages)}`;
        if (nextMessages.length === 0 || key === dismissedKey.current) {
            return;
        }
        setVariant(nextVariant);
        setTitle(nextTitle);
        setMessages(nextMessages);
        setOpen(true);
    }, []);

    useEffect(() => {
        const onInertiaFinish = () => {
            dismissedKey.current = '';
        };
        document.addEventListener('inertia:finish', onInertiaFinish);
        return () => {
            document.removeEventListener('inertia:finish', onInertiaFinish);
        };
    }, []);

    const errorsKey = JSON.stringify(page.props.errors ?? {});

    useEffect(() => {
        const lines = errorLines(page);
        if (lines.length > 0) {
            const flash = page.props.flash ?? {};
            const t = flash.error ? 'Error' : 'Please check the following';
            showPopup('error', t, lines);
            return;
        }

        const status = page.props.flash?.status;
        if (status) {
            const msg = [String(status)];
            const dismissKey = `success:${JSON.stringify(msg)}`;
            if (dismissKey !== dismissedKey.current) {
                showPopup('success', 'Success', msg);
            }
        }
    }, [errorsKey, page, page.props.flash?.error, page.props.flash?.status, page.url, showPopup]);

    useEffect(() => {
        const onException = (e) => {
            const x = e.detail?.exception;
            if (!x) {
                return;
            }
            const msg =
                typeof x === 'string'
                    ? x
                    : x?.message || 'An unexpected error occurred.';
            showPopup('error', 'Error', [msg]);
        };
        const onInvalid = (e) => {
            const r = e.detail?.response;
            if (!r || r.status < 400) {
                return;
            }
            showPopup('error', 'Request failed', [
                `${r.status} ${r.statusText || 'The request could not be completed.'}`,
            ]);
        };
        const onNotify = (e) => {
            const d = e.detail ?? {};
            const v = d.variant === 'success' ? 'success' : 'error';
            const msg = d.message != null ? String(d.message) : '';
            if (!msg) {
                return;
            }
            dismissedKey.current = '';
            showPopup(v, d.title || (v === 'success' ? 'Success' : 'Notice'), [msg]);
        };
        document.addEventListener('inertia:exception', onException);
        document.addEventListener('inertia:invalid', onInvalid);
        document.addEventListener('app:notify', onNotify);
        return () => {
            document.removeEventListener('inertia:exception', onException);
            document.removeEventListener('inertia:invalid', onInvalid);
            document.removeEventListener('app:notify', onNotify);
        };
    }, [showPopup]);

    const close = () => {
        dismissedKey.current = `${variant}:${JSON.stringify(messages)}`;
        setOpen(false);
    };

    const isSuccess = variant === 'success';
    const borderClass = isSuccess ? 'border-emerald-400/40' : 'border-red-400/40';
    const titleClass = isSuccess ? 'text-emerald-200' : 'text-red-200';
    const btnClass = isSuccess
        ? 'from-emerald-600 to-emerald-500 hover:brightness-105'
        : 'from-[#1D4ED8] to-[#0369A1] hover:brightness-105';

    return (
        <Modal show={open} onClose={close} maxWidth="md">
            <div
                className={`rounded-2xl border bg-[#0F172A] p-5 text-slate-100 shadow-lg sm:p-6 ${borderClass}`}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="global-flash-title"
            >
                <h3 id="global-flash-title" className={`font-poppins text-lg font-semibold ${titleClass}`}>
                    {title}
                </h3>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-200">
                    {messages.map((m, i) => (
                        <li key={i}>{m}</li>
                    ))}
                </ul>
                <button
                    type="button"
                    className={`mt-6 w-full rounded-xl border border-transparent bg-gradient-to-r py-2.5 text-sm font-semibold text-white shadow-md ${btnClass}`}
                    onClick={close}
                >
                    OK
                </button>
            </div>
        </Modal>
    );
}
