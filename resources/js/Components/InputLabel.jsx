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
                `block text-xs font-medium text-[#64748B] sm:text-sm ` +
                className
            }
        >
            {value ? value : children}
        </label>
    );
}
