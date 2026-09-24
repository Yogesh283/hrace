export default function MemberAlert({
    variant = 'info',
    title = '',
    children,
    className = '',
}) {
    const tone = ['success', 'error', 'warning'].includes(variant) ? variant : 'info';

    return (
        <div
            className={`rx-alert ${tone === 'info' ? '' : `rx-alert--${tone}`} ${className}`}
            role="status"
        >
            {title ? <p className="rx-alert__title">{title}</p> : null}
            {children}
        </div>
    );
}
