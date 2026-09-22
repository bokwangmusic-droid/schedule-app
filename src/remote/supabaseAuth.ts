import {
  isSupabaseConfigured,
  normalizeKoreanPhone,
  SUPABASE_URL,
  supabaseHeaders,
} from './supabaseConfig';

type VerifyResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id?: string;
    phone?: string;
  };
  error_description?: string;
  msg?: string;
};

export type RemoteMemberLogin = {
  memberId: string;
  userId: string;
  phone: string;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
};

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { msg?: string; error_description?: string; message?: string };
    return body.msg || body.error_description || body.message || '서버 요청에 실패했어요.';
  } catch {
    return '서버 요청에 실패했어요.';
  }
}

export async function requestMemberOtp(phoneInput: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const phone = normalizeKoreanPhone(phoneInput);
  if (!phone) throw new Error('휴대폰 번호를 확인해 주세요.');

  const response = await fetch(SUPABASE_URL + '/auth/v1/otp', {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({
      phone,
      create_user: false,
    }),
  });

  if (!response.ok) throw new Error(await readError(response));
  return phone;
}

export async function verifyMemberOtp(phoneInput: string, token: string): Promise<RemoteMemberLogin> {
  if (!isSupabaseConfigured()) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const phone = normalizeKoreanPhone(phoneInput);
  const code = token.replace(/\D/g, '');
  if (!phone || code.length < 4) throw new Error('인증번호를 확인해 주세요.');

  const response = await fetch(SUPABASE_URL + '/auth/v1/verify', {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({
      type: 'sms',
      phone,
      token: code,
    }),
  });

  if (!response.ok) throw new Error(await readError(response));

  const verified = (await response.json()) as VerifyResponse;
  const accessToken = verified.access_token;
  const userId = verified.user?.id;
  if (!accessToken || !userId) throw new Error('회원 인증 정보를 확인하지 못했어요.');

  const accountResponse = await fetch(
    SUPABASE_URL +
      '/rest/v1/member_accounts?auth_user_id=eq.' +
      encodeURIComponent(userId) +
      '&select=member_id&limit=1',
    {
      headers: supabaseHeaders(accessToken),
    },
  );

  if (!accountResponse.ok) throw new Error(await readError(accountResponse));
  const accounts = (await accountResponse.json()) as Array<{ member_id: string }>;
  const memberId = accounts[0]?.member_id;
  if (!memberId) {
    throw new Error('이 휴대폰 번호에 연결된 회원 정보가 없어요. 트레이너에게 문의해 주세요.');
  }

  return {
    memberId,
    userId,
    phone,
    accessToken,
    refreshToken: verified.refresh_token ?? null,
    expiresIn: verified.expires_in ?? null,
  };
}
