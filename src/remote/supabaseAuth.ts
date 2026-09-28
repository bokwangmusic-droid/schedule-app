import {
  isSupabaseConfigured,
  SUPABASE_URL,
  supabaseHeaders,
} from './supabaseConfig';

type AuthUser = {
  id?: string;
  email?: string;
};

export type RemoteMemberLogin = {
  memberId: string;
  userId: string;
  email: string;
  accessToken: string;
};

async function readError(response: Response) {
  try {
    const body = (await response.json()) as {
      msg?: string;
      error_description?: string;
      message?: string;
    };
    return body.msg || body.error_description || body.message || '서버 요청에 실패했어요.';
  } catch {
    return '서버 요청에 실패했어요.';
  }
}

async function resolveMemberAccount(
  accessToken: string,
  user: AuthUser,
): Promise<RemoteMemberLogin> {
  const userId = user.id;
  const email = user.email?.trim().toLowerCase() ?? '';
  if (!userId || !email) throw new Error('회원 인증 정보를 확인하지 못했어요.');

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
    const claimResponse = await fetch(
      SUPABASE_URL + '/rest/v1/rpc/claim_member_account_by_email',
      {
        method: 'POST',
        headers: supabaseHeaders(accessToken),
        body: JSON.stringify({}),
      },
    );

    if (!claimResponse.ok) throw new Error(await readError(claimResponse));

    accountResponse = await fetch(
      SUPABASE_URL +
        '/rest/v1/member_accounts?auth_user_id=eq.' +
        encodeURIComponent(userId) +
        '&select=member_id&limit=1',
      { headers: supabaseHeaders(accessToken) },
    );

    if (!accountResponse.ok) throw new Error(await readError(accountResponse));
    accounts = (await accountResponse.json()) as Array<{ member_id: string }>;
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
  };
}

export async function requestMemberMagicLink(emailInput: string) {
  if (!isSupabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');

  const email = emailInput.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('이메일 주소를 확인해 주세요.');

  const response = await fetch(SUPABASE_URL + '/auth/v1/otp', {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({
      email,
      create_user: true,
      email_redirect_to: 'scheduleapp://auth-callback',
    }),
  });

  if (!response.ok) throw new Error(await readError(response));
  return email;
}

export async function completeMemberMagicLink(accessToken: string) {
  if (!isSupabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  if (!accessToken) throw new Error('로그인 링크에서 인증 정보를 찾지 못했어요.');

  const response = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: supabaseHeaders(accessToken),
  });

  if (!response.ok) throw new Error(await readError(response));
  const user = (await response.json()) as AuthUser;
  return resolveMemberAccount(accessToken, user);
}
