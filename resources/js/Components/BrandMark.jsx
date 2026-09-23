import { RACE_BRAND_NAME, RACE_LOGO_SRC } from '@/lib/brandAssets';
import { Link } from '@inertiajs/react';

export default function BrandMark({ className = '' }) {
    return (
        <Link
            href="/"
            className={`inline-flex items-center gap-2 font-semibold tracking-tight text-fintech-ink hover:opacity-90 ${className}`}
        >
            <img
                src={RACE_LOGO_SRC}
                alt={RACE_BRAND_NAME}
                className="h-9 w-9 object-contain"
            />
        </Link>
    );
}
