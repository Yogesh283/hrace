/**
 * Horizontal scroll wrapper for data tables on small screens.
 */
export default function MemberTableScroll({ children, className = '' }) {
    return (
        <div
            className={`member-table-scroll race-pdf-table-wrap -mx-1 overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:px-0 ${className}`}
        >
            {children}
        </div>
    );
}
