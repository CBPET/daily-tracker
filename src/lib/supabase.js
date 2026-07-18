import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Decode JWT payload without verifying (client-side sanity check only). */
function decodeJwtPayload(token) {
    try {
        const part = String(token || '').split('.')[1];
        if (!part) return null;
        const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export function getSupabaseConfigError() {
    if (!supabaseUrl || !supabaseAnonKey) {
        return 'Supabase URL or anon key is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild/redeploy.';
    }
    if (!String(supabaseUrl).startsWith('https://')) {
        return 'VITE_SUPABASE_URL looks invalid. Use https://YOUR_PROJECT.supabase.co from Project Settings → API.';
    }
    if (!String(supabaseAnonKey).startsWith('eyJ')) {
        return 'VITE_SUPABASE_ANON_KEY looks invalid. Use the anon public key (starts with eyJ), not the service_role key.';
    }
    const payload = decodeJwtPayload(supabaseAnonKey);
    if (payload?.role === 'service_role') {
        return 'VITE_SUPABASE_ANON_KEY is set to the service_role key. Use the anon public key instead, then rebuild/redeploy.';
    }
    if (payload?.role && payload.role !== 'anon') {
        return `VITE_SUPABASE_ANON_KEY has unexpected role "${payload.role}". Use the anon public key from Project Settings → API.`;
    }
    return null;
}

export function formatAuthClientError(message) {
    const configError = getSupabaseConfigError();
    if (configError) return configError;
    const text = String(message || '');
    if (/invalid api key/i.test(text)) {
        return 'Invalid API key: VITE_SUPABASE_ANON_KEY does not match this Supabase project. Update the anon public key in .env or deploy secrets, then rebuild/redeploy.';
    }
    return text || 'Authentication failed';
}

const configError = getSupabaseConfigError();
if (configError) {
    console.error(configError);
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        detectSessionInUrl: true,
        persistSession: true,
        flowType: 'implicit',
    },
});
