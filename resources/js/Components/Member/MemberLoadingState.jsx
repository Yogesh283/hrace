export default function MemberLoadingState({ children = 'Loading…', className = '' }) {
    return (
        <p className={`rx-loading px-1 py-3 ${className}`} role="status" aria-live="polite">
            {children}
        </p>
    );
}
