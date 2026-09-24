<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">

        <title inertia>{{ config('app.name', 'racenetwork.live') }}</title>

        {{-- Social / WhatsApp link preview (crawlers read this without JS) --}}
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="racenetwork.live">
        <meta property="og:title" content="racenetwork.live">
        <meta property="og:description" content="RACE Network — Powering Community-Owned Digital Economies">
        <meta property="og:url" content="{{ url()->current() }}">
        <meta property="og:image" content="{{ url('/images/race-network-hero-banner.png') }}">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="racenetwork.live">
        <meta name="twitter:description" content="RACE Network — Powering Community-Owned Digital Economies">
        <meta name="twitter:image" content="{{ url('/images/race-network-hero-banner.png') }}">
        <meta name="application-name" content="racenetwork.live">

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Poppins:wght@500;600;700;800;900&display=swap"
            rel="stylesheet"
        />
        <meta name="theme-color" content="#0b1120">

        <!-- Scripts -->
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.jsx', "resources/js/Pages/{$page['component']}.jsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
