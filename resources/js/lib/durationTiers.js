/**
 * Find a lock-duration tier row by days value.
 * @param {string|number} durationDays
 * @param {Array<{ days: number|string }>} tiers
 * @returns {object|null}
 */
export function durationTiersForDays(durationDays, tiers) {
    const days = Number(durationDays);
    if (!Number.isFinite(days) || days < 0) return null;
    return (tiers ?? []).find((row) => Number(row.days) === days) ?? null;
}
