/**
 * Prefer the Blade meta token (always on the page). Cookie fallback can fail
 * in TokenPocket / WebView when SESSION_DOMAIN is a leading-dot host.
 */
export function getCsrfToken() {
    if (typeof document === 'undefined') {
        return '';
    }

    const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (meta) {
        return meta;
    }

    const cookies = document.cookie.split(';').map((part) => part.trim());
    const xsrf = cookies.filter((part) => part.startsWith('XSRF-TOKEN=')).pop();

    return xsrf ? decodeURIComponent(xsrf.slice('XSRF-TOKEN='.length)) : '';
}

export function csrfHeaders() {
    const headers = {
        'X-Requested-With': 'XMLHttpRequest',
    };
    const token = getCsrfToken();
    if (token) {
        headers['X-CSRF-TOKEN'] = token;
        headers['X-XSRF-TOKEN'] = token;
    }

    return headers;
}
