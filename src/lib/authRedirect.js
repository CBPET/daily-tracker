const basePath = () => {
    const base = import.meta.env.BASE_URL || '/';
    return base.endsWith('/') ? base : `${base}/`;
};

/**
 * Redirect URL for Supabase auth emails.
 * Use base path only — no # fragment. Supabase appends #access_token=... itself.
 * Including a hash (e.g. #login) causes broken double-hash URLs like #login#access_token=...
 */
export function getAuthRedirectUrl() {
    return `${window.location.origin}${basePath()}`;
}

/** In-app hash route URL (invite links, manual navigation). */
export function getAppHashUrl(hash = 'login') {
    const fragment = hash.replace(/^#/, '');
    return `${window.location.origin}${basePath()}#${fragment}`;
}

/** Extract auth params from hash, including Supabase double-hash (#login#access_token=...). */
function extractHashParamString() {
    let hashRaw = window.location.hash.slice(1);
    if (!hashRaw) return '';

    if (hashRaw.includes('#')) {
        const segments = hashRaw.split('#');
        return segments.find((s) => s.includes('access_token=') || s.includes('token_hash=') || s.includes('error='))
            || segments[segments.length - 1];
    }

    const routePrefixes = ['reset-password', 'login', 'signup', 'landing', 'forgot-password', 'confirm-email'];
    for (const prefix of routePrefixes) {
        if (hashRaw === prefix) return '';
        if (hashRaw.startsWith(`${prefix}&`)) {
            return hashRaw.slice(prefix.length + 1);
        }
    }

    return hashRaw;
}

/** Parse Supabase auth callback params from hash (implicit flow). */
export function parseAuthCallback() {
    const paramString = extractHashParamString();
    const hashParams = new URLSearchParams(paramString.includes('=') ? paramString : '');
    const get = (key) => hashParams.get(key);

    return {
        type: get('type'),
        token_hash: get('token_hash'),
        access_token: get('access_token'),
        refresh_token: get('refresh_token'),
        error: get('error') || get('error_description'),
    };
}

export function isRecoveryFromUrl() {
    const hash = window.location.hash;
    const { type } = parseAuthCallback();
    return type === 'recovery' || (hash.includes('access_token') && hash.includes('type=recovery'));
}

export function isInviteFromUrl() {
    const hash = window.location.hash;
    const { type } = parseAuthCallback();
    // Signup / email confirmation must never be treated as invite
    if (type === 'signup' || type === 'email' || type === 'magiclink') return false;
    return type === 'invite' || (hash.includes('access_token') && hash.includes('type=invite'));
}

export function isSignupConfirmFromUrl() {
    const { type } = parseAuthCallback();
    const hash = window.location.hash;
    return (
        type === 'signup' ||
        type === 'email' ||
        (hash.includes('access_token') && (hash.includes('type=signup') || hash.includes('type=email')))
    );
}

export function isRecoveryCallback() {
    return isRecoveryFromUrl();
}

export function isInviteCallback() {
    return isInviteFromUrl();
}

export function isAuthCallbackUrl() {
    const { token_hash, access_token, type, error } = parseAuthCallback();
    const hash = window.location.hash;
    return Boolean(
        token_hash ||
        access_token ||
        type ||
        error ||
        hash.includes('access_token')
    );
}

export function sanitizeAuthUrl(hash = 'login') {
    const fragment = hash.replace(/^#/, '');
    window.history.replaceState(null, '', `${window.location.origin}${basePath()}#${fragment}`);
}

export function clearAuthParamsFromUrl(hash = 'login') {
    sanitizeAuthUrl(hash);
}

let inflightCallback = null;

async function doCompleteAuthCallback(supabase) {
    const callback = parseAuthCallback();

    if (callback.error) {
        return { error: callback.error, kind: callback.type || 'auth' };
    }

    if (callback.token_hash && callback.type) {
        const { error } = await supabase.auth.verifyOtp({
            type: callback.type,
            token_hash: callback.token_hash,
        });
        if (error) return { error: error.message, kind: callback.type };
    }

    if (callback.access_token) {
        const { error } = await supabase.auth.setSession({
            access_token: callback.access_token,
            refresh_token: callback.refresh_token || '',
        });
        if (error) return { error: error.message, kind: callback.type || 'session' };
    }

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) return { error: error.message, kind: null };

    if (session) {
        const callbackType = callback.type;
        const invite =
            callbackType === 'invite' ||
            (callbackType !== 'signup' &&
                callbackType !== 'email' &&
                callbackType !== 'magiclink' &&
                callbackType !== 'recovery' &&
                isInviteFromUrl());
        const recovery = callbackType === 'recovery' || isRecoveryFromUrl();
        if (invite) {
            sanitizeAuthUrl('invite-accept');
            return { kind: 'invite' };
        }
        if (recovery) {
            sanitizeAuthUrl('reset-password');
            return { kind: 'recovery' };
        }
        // signup / email confirm / generic session
        sanitizeAuthUrl('login');
        return { kind: callbackType === 'signup' || callbackType === 'email' ? 'signup' : 'session' };
    }

    return { kind: null };
}

export function completeAuthCallback(supabase) {
    if (!inflightCallback) {
        inflightCallback = doCompleteAuthCallback(supabase).finally(() => {
            inflightCallback = null;
        });
    }
    return inflightCallback;
}
