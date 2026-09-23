/** Shared layout + form styling for member portal and auth pages. */

export const MEMBER_PAGE_WIDTH = 'mx-auto w-full max-w-6xl';

export const MEMBER_PAGE_STACK = `${MEMBER_PAGE_WIDTH} space-y-5 sm:space-y-6`;

export const AUTH_GLASS_INPUT =
    'border-[#2563EB]/35 bg-[#0F172A]/80 text-slate-100 shadow-[0_4px_28px_-10px_rgba(37,99,235,0.25)] backdrop-blur-md placeholder:text-slate-500 caret-sky-300 focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/40';

export const AUTH_PW_GLASS_ICON =
    '[&_input]:border-[#2563EB]/35 [&_input]:bg-[#0F172A]/80 [&_input]:text-slate-100 [&_input]:shadow-[0_4px_28px_-10px_rgba(37,99,235,0.25)] [&_input]:backdrop-blur-md [&_input]:placeholder:text-slate-500 [&_input]:caret-sky-300 [&_input]:focus:border-[#38BDF8] [&_input]:focus:ring-2 [&_input]:focus:ring-[#38BDF8]/40';

export const AUTH_LABEL =
    'text-[10px] font-bold uppercase tracking-wider text-slate-400 max-sm:mb-0 sm:text-[11px] md:text-xs';

export const AUTH_CARD =
    'relative overflow-hidden rounded-2xl border border-white/90 bg-white/65 p-3.5 shadow-[0_20px_60px_-20px_rgba(37,99,235,0.25),0_0_0_1px_rgba(255,255,255,0.8)_inset] backdrop-blur-2xl max-sm:rounded-[1.15rem] sm:rounded-[1.75rem] sm:p-8';

/** Login / register on dark guest backdrop */
export const AUTH_CARD_GUEST =
    'relative overflow-hidden rounded-2xl border border-white/20 bg-[#0F172A]/55 p-3.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45),0_0_40px_rgba(37,99,235,0.12)] backdrop-blur-2xl max-sm:rounded-[1.15rem] sm:rounded-[1.75rem] sm:p-8';

export const AUTH_GLOW_BUTTON =
    'relative w-full overflow-hidden rounded-xl border border-sky-300/40 bg-gradient-to-r from-[#2563EB] via-[#3b82f6] to-[#38BDF8] py-2.5 text-xs font-extrabold text-white shadow-[0_12px_40px_-8px_rgba(37,99,235,0.5),0_0_32px_rgba(56,189,248,0.2)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-55 sm:rounded-2xl sm:py-4 sm:text-base';

export const MEMBER_CARD =
    'race-glass relative min-w-0 overflow-hidden rounded-[1.25rem] border';

export const PANEL_DENSITY = {
    default: 'p-3.5 sm:p-5 md:p-6',
    compact: 'p-3 sm:p-4',
    spacious: 'p-4 sm:p-6 md:p-8',
};
