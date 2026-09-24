export default function MemberPageIntro({ children, className = '' }) {
    return (
        <p
            className={`mb-4 max-w-2xl text-xs leading-relaxed text-slate-300 sm:mb-5 sm:text-sm ${className}`}
        >
            {children}
        </p>
    );
}
