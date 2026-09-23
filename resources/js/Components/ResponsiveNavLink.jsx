import { Link } from '@inertiajs/react';

export default function ResponsiveNavLink({
    active = false,
    className = '',
    children,
    ...props
}) {
    return (
        <Link
            {...props}
            className={`flex w-full items-start rounded-md py-2 pe-4 ps-3 ${
                active
                    ? 'border-l-2 border-blue-500 bg-blue-500/15 text-blue-200'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
            } text-base font-medium transition duration-150 ease-in-out focus:outline-none ${className}`}
        >
            {children}
        </Link>
    );
}
