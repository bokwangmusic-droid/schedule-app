const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const rawAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

export const SUPABASE_URL = rawUrl.replace(/\/$/, '');
export const SUPABASE_ANON_KEY = rawAnonKey;

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function normalizeKoreanPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('82')) return '+' + digits;
  if (digits.startsWith('0')) return '+82' + digits.slice(1);
  return '+82' + digits;
}

export function supabaseHeaders(accessToken?: string) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + (accessToken || SUPABASE_ANON_KEY),
    'Content-Type': 'application/json',
  };
}
