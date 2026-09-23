<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

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
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link
            href="https://fonts.bunny.net/css?family=figtree:400,500,600|inter:400,500,600,700|poppins:500,600,700&display=swap"
            rel="stylesheet"
        />

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
