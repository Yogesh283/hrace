export const MEMBER_CODE_PREFIX = 'RC';

/**
 * @param {number|string|null|undefined} memberNumber
 * @param {{ withHash?: boolean }} [options]
 */
export function formatMemberCode(memberNumber, { withHash = false } = {}) {
    if (memberNumber == null || memberNumber === '') {
        return `${withHash ? '#' : ''}${MEMBER_CODE_PREFIX}—`;
    }

    const code = `${MEMBER_CODE_PREFIX}${String(memberNumber).padStart(4, '0')}`;

    return withHash ? `#${code}` : code;
}
