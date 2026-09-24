export default function MemberEmptyState({ title = '', children, className = '' }) {
    return (
        <div className={`rx-empty ${className}`} role="status">
            {title ? <p className="rx-empty__title">{title}</p> : null}
            {children ? <p className="m-0 max-w-md">{children}</p> : null}
        </div>
    );
}
