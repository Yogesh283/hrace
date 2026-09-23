import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'Figtree', ...defaultTheme.fontFamily.sans],
                display: [
                    '"Clash Display"',
                    'Inter',
                    ...defaultTheme.fontFamily.sans,
                ],
                jakarta: [
                    '"Plus Jakarta Sans"',
                    'system-ui',
                    ...defaultTheme.fontFamily.sans,
                ],
                space: ['"Space Grotesk"', 'Inter', ...defaultTheme.fontFamily.sans],
                sora: ['"Sora"', 'Inter', ...defaultTheme.fontFamily.sans],
                inter: ['Inter', 'Figtree', 'system-ui', ...defaultTheme.fontFamily.sans],
                poppins: ['Poppins', 'Inter', 'system-ui', ...defaultTheme.fontFamily.sans],
            },
            colors: {
                brand: {
                    DEFAULT: '#F5B800',
                    dark: '#c99400',
                    glow: '#fde68a',
                },
                fintech: {
                    primary: '#2563EB',
                    sky: '#38BDF8',
                    surface: '#F8FAFC',
                    card: '#FFFFFF',
                    ink: '#0F172A',
                    line: '#E2E8F0',
                    muted: '#64748B',
                    soft: '#EFF6FF',
                },
                portal: {
                    bg: '#0B1120',
                    glass: 'rgba(255, 255, 255, 0.04)',
                    line: 'rgba(255, 255, 255, 0.08)',
                },
                // Rynex Premium design system tokens
                rynex: {
                    bg: '#020617',
                    surface: '#030712',
                    elevated: '#0f172a',
                    primary: '#2563eb',
                    neon: '#38bdf8',
                    glow: '#60a5fa',
                    ink: '#ffffff',
                    muted: '#94a3b8',
                    line: 'rgba(148, 163, 184, 0.14)',
                    glass: 'rgba(15, 23, 42, 0.55)',
                },
            },
            boxShadow: {
                'rx-glow-sm': '0 0 18px rgba(56, 189, 248, 0.25)',
                'rx-glow': '0 0 32px rgba(56, 189, 248, 0.35)',
                'rx-glow-lg': '0 0 60px rgba(56, 189, 248, 0.45)',
                'rx-card': '0 12px 40px rgba(2, 6, 23, 0.55), 0 0 0 1px rgba(148, 163, 184, 0.06) inset',
                'rx-btn': '0 10px 30px rgba(37, 99, 235, 0.4)',
            },
            backgroundImage: {
                'rx-grad': 'linear-gradient(135deg, #2563eb 0%, #38bdf8 55%, #60a5fa 100%)',
                'rx-grad-soft': 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(56,189,248,0.05))',
                'rx-grid':
                    'linear-gradient(rgba(56,189,248,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.06) 1px, transparent 1px)',
            },
            backgroundSize: {
                'rx-grid': '56px 56px',
            },
            animation: {
                'rx-orb': 'rx-orb 18s ease-in-out infinite',
                'rx-orb-slow': 'rx-orb 28s ease-in-out infinite',
                'rx-pulse': 'rx-pulse 2.6s ease-in-out infinite',
                'rx-shimmer': 'rx-shimmer 2.4s linear infinite',
                'rx-spin-slow': 'rx-spin 26s linear infinite',
                'rx-grid-drift': 'rx-grid-drift 60s linear infinite',
            },
            keyframes: {
                'rx-orb': {
                    '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
                    '50%': { transform: 'translate3d(28px,-40px,0) scale(1.06)' },
                },
                'rx-pulse': {
                    '0%, 100%': {
                        boxShadow: '0 0 0 0 rgba(56,189,248,0.4), 0 0 24px rgba(56,189,248,0.25)',
                    },
                    '50%': {
                        boxShadow: '0 0 0 8px rgba(56,189,248,0), 0 0 32px rgba(56,189,248,0.5)',
                    },
                },
                'rx-shimmer': {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                'rx-spin': {
                    to: { transform: 'rotate(360deg)' },
                },
                'rx-grid-drift': {
                    '0%': { transform: 'translate3d(0,0,0)' },
                    '100%': { transform: 'translate3d(-56px,-56px,0)' },
                },
            },
        },
    },

    plugins: [forms],
};
