import {
  isSupabaseConfigured,
  SUPABASE_URL,
  supabaseHeaders,
} from './supabaseConfig';

type VerifyResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id?: string;
    email?: string;
  };
  error_description?: string;
  msg?: string;
};

export type RemoteMemberLogin = {
  memberId: string;
  userId: string;
  email: string;
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

export async function requestMemberOtp(emailInput: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const email = emailInput.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('이메일 주소를 확인해 주세요.');

  const response = await fetch(SUPABASE_URL + '/auth/v1/otp', {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({
      email,
      create_user: true,
    }),
  });

  if (!response.ok) throw new Error(await readError(response));
  return email;
}

export async function verifyMemberOtp(emailInput: string, token: string): Promise<RemoteMemberLogin> {
  if (!isSupabaseConfigured()) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const email = emailInput.trim().toLowerCase();
  const code = token.replace(/\D/g, '');
  if (!email || !email.includes('@') || code.length < 4) {
    throw new Error('이메일 또는 인증번호를 확인해 주세요.');
  }

  const response = await fetch(SUPABASE_URL + '/auth/v1/verify', {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({
      type: 'email',
      email,
      token: code,
    }),
  });

  if (!response.ok) throw new Error(await readError(response));

  const verified = (await response.json()) as VerifyResponse;
  const accessToken = verified.access_token;
  const userId = verified.user?.id;
  if (!accessToken || !userId) throw new Error('회원 인증 정보를 확인하지 못했어요.');

  let accountResponse = await fetch(
    SUPABASE_URL +
      '/rest/v1/member_accounts?auth_user_id=eq.' +
      encodeURIComponent(userId) +
      '&select=member_id&limit=1',
    { headers: supabaseHeaders(accessToken) },
  );

  if (!accountResponse.ok) throw new Error(await readError(accountResponse));
  let accounts = (await accountResponse.json()) as Array<{ member_id: string }>;

  if (!accounts[0]?.member_id) {
    const claimResponse = await fetch(SUPABASE_URL + '/rest/v1/rpc/claim_member_account_by_email', {
      method: 'POST',
      headers: supabaseHeaders(accessToken),
      body: JSON.stringify({}),
    });

    if (claimResponse.ok) {
      accountResponse = await fetch(
        SUPABASE_URL +
          '/rest/v1/member_accounts?auth_user_id=eq.' +
          encodeURIComponent(userId) +
          '&select=member_id&limit=1',
        { headers: supabaseHeaders(accessToken) },
      );
      if (accountResponse.ok) {
        accounts = (await accountResponse.json()) as Array<{ member_id: string }>;
      }
    }
  }

  const memberId = accounts[0]?.member_id;
  if (!memberId) {
    throw new Error('이 이메일에 연결된 회원 정보가 없어요. 트레이너에게 문의해 주세요.');
  }

  return {
    memberId,
    userId,
    email,
    accessToken,
    refreshToken: verified.refresh_token ?? null,
    expiresIn: verified.expires_in ?? null,
  };
}
