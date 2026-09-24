export default function InputLabel({
    value,
    className = '',
    children,
    ...props
}) {
    return (
        <label
            {...props}
            className={
                `block text-xs font-semibold text-slate-200 sm:text-sm ` +
                className
            }
        >
            {value ? value : children}
        </label>
    );
}
