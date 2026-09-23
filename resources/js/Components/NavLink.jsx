import { Link } from '@inertiajs/react';

export default function NavLink({
    active = false,
    className = '',
    children,
    ...props
}) {
    return (
        <Link
            {...props}
            className={
                'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium leading-5 transition duration-150 ease-in-out focus:outline-none ' +
                (active
                    ? 'border-l-2 border-blue-500 bg-blue-500/15 text-blue-200'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-white') +
                className
            }
        >
            {children}
        </Link>
    );
}
