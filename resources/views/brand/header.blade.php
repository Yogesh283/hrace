@push('head')
    <meta name="robots" content="noindex"/>
    <meta name="google" content="notranslate">
    <link href="{{ asset('images/Race  Logo.png') }}" type="image/png" id="favicon" rel="icon">
    <meta name="theme-color" content="#0f172a">
@endpush

<div class="h2 d-flex align-items-center gap-2">
    @auth
        <x-orchid-icon path="bs.house" class="d-inline d-lg-none"/>
    @endauth

    <a href="{{ route(config('platform.index')) }}" class="my-0 d-inline-flex align-items-center gap-2 text-decoration-none text-body {{ auth()->check() ? 'd-none d-lg-inline-flex' : '' }}">
        <img src="{{ asset('images/Race  Logo.png') }}" alt="{{ config('app.name') }}" width="32" height="32" class="rounded">
        <span>{{ config('app.name') }}</span>
    </a>
</div>
