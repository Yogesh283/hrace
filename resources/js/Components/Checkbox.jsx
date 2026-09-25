export default function Checkbox({ className = '', ...props }) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'h-4 w-4 rounded border-slate-500 bg-[#0F172A] text-[#2563EB] shadow-sm focus:ring-2 focus:ring-[#38BDF8] focus:ring-offset-0 ' +
                className
            }
        />
    );
}
