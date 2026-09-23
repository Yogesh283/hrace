/**
 * PDF-style glass panel with neon blue border + gold inner glow.
 */
export default function RacePdfPanel({ children, className = '', bodyClassName = '' }) {
    return (
        <div className={`race-pdf-panel overflow-hidden rounded-xl shadow-sm ${className}`}>
            {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
        </div>
    );
}
