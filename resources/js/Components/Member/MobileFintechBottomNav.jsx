import { Link } from '@inertiajs/react';

function routeHref(name) {
    try {
        return route(name);
    } catch {
        return '#';
    }
}

function routeActive(name) {
    try {
        return route().current(name);
    } catch {
        return false;
    }
}

const navItems = [
    { routeKey: 'dashboard', label: 'Home' },
    { routeKey: 'investment', label: 'Staking' },
    { routeKey: 'team', label: 'Team' },
    { routeKey: 'profile.edit', label: 'Profile' },
];

function NavIcon({ name, active }) {
    const props = {
        fill: 'none',
        viewBox: '0 0 24 24',
        stroke: 'currentColor',
        strokeWidth: active ? 2 : 1.7,
        'aria-hidden': true,
    };

    switch (name) {
        case 'dashboard':
            return (
                <svg {...props}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                    />
                </svg>
            );
        case 'investment':
            return (
                <svg {...props}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
            );
        case 'team':
            return (
                <svg {...props}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                    />
                </svg>
            );
        case 'profile.edit':
            return (
                <svg {...props}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                </svg>
            );
        default:
            return null;
    }
}

export default function MobileFintechBottomNav() {
    return (
        <nav className="rx-bottomnav rx-mobile-bottomnav rx-dark-scope lg:hidden" aria-label="Primary">
            <ul className="rx-bottomnav__list" style={{ '--rx-bottomnav-cols': navItems.length }}>
                {navItems.map((item) => {
                    const active = routeActive(item.routeKey);
                    return (
                        <li key={item.routeKey} className="min-w-0">
                            <Link
                                href={routeHref(item.routeKey)}
                                prefetch
                                className="rx-bottomnav__item"
                                aria-label={item.label}
                                aria-current={active ? 'page' : undefined}
                            >
                                <span className="rx-bottomnav__icon">
                                    <NavIcon name={item.routeKey} active={active} />
                                </span>
                                <span className="rx-bottomnav__label">{item.label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
