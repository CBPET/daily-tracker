/**
 * Derive a human display name from an email local-part.
 * jane.doe+tag@co.com → "Jane Doe"
 */
export function deriveDisplayNameFromEmail(email) {
    if (!email || typeof email !== 'string') return '';
    const local = email.trim().split('@')[0] || '';
    if (!local) return '';
    const withoutPlus = local.split('+')[0];
    return withoutPlus
        .replace(/[._-]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}
