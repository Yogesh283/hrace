/**
 * PDF slide-style section header (navy bar + gold accent line).
 */
export default function RacePdfSectionHeader({ title, subtitle, className = '' }) {
    return (
        <div className={`race-pdf-section-header px-4 py-3 sm:px-5 ${className}`}>
            <h2 className="font-poppins text-sm font-bold tracking-wide text-white sm:text-base">{title}</h2>
            {subtitle ? <p className="race-pdf-section-sub mt-0.5">{subtitle}</p> : null}
        </div>
    );
}
