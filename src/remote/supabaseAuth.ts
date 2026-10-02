import type { SQLiteDatabase } from 'expo-sqlite';
import {
  isSupabaseConfigured,
  SUPABASE_URL,
  supabaseHeaders,
} from './supabaseConfig';
import { savePendingAuthFlow, type AppRole } from '../auth/appSession';

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

function createCodeVerifier(length = 64) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(length);
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.getRandomValues) {
    cryptoObject.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

async function requestMagicLink(
  db: SQLiteDatabase,
  emailInput: string,
  role: AppRole,
) {
  if (!isSupabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const email = emailInput.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('이메일 주소를 확인해 주세요.');

  const codeVerifier = createCodeVerifier();
  const redirectTo =
    role === 'trainer'
      ? 'scheduleapp://auth-callback?role=trainer'
      : 'scheduleapp://auth-callback?role=member';

  await savePendingAuthFlow(db, {
    role,
    codeVerifier,
    requestedAt: new Date().toISOString(),
  });

  const response = await fetch(
    SUPABASE_URL + '/auth/v1/otp?redirect_to=' + encodeURIComponent(redirectTo),
    {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify({
        email,
        create_user: true,
        code_challenge: codeVerifier,
        code_challenge_method: 'plain',
      }),
    },
  );

  if (!response.ok) throw new Error(await readError(response));
  return email;
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

export async function requestMemberMagicLink(
  db: SQLiteDatabase,
  emailInput: string,
) {
  return requestMagicLink(db, emailInput, 'member');
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


export type RemoteTrainerLogin = {
  trainerId: string;
  userId: string;
  email: string;
  accessToken: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
};

export async function requestTrainerMagicLink(
  db: SQLiteDatabase,
  emailInput: string,
) {
  return requestMagicLink(db, emailInput, 'trainer');
}

export async function completeTrainerMagicLink(accessToken: string): Promise<RemoteTrainerLogin> {
  if (!isSupabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const userResponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: supabaseHeaders(accessToken),
  });
  if (!userResponse.ok) throw new Error(await readError(userResponse));
  const user = (await userResponse.json()) as AuthUser;
  const userId = user.id;
  const email = user.email?.trim().toLowerCase() ?? '';
  if (!userId || !email) throw new Error('강사 인증 정보를 확인하지 못했어요.');

  const response = await fetch(
    SUPABASE_URL + '/rest/v1/trainers?auth_user_id=eq.' + encodeURIComponent(userId) +
      '&select=auth_user_id,verification_status,verification_rejection_reason&limit=1',
    { headers: supabaseHeaders(accessToken) },
  );
  if (!response.ok) throw new Error(await readError(response));
  const rows = (await response.json()) as Array<{
    auth_user_id: string;
    verification_status?: 'pending' | 'approved' | 'rejected';
    verification_rejection_reason?: string | null;
  }>;
  const trainer = rows[0];
  if (!trainer) {
    return { trainerId: userId, userId, email, accessToken, verificationStatus: 'pending' };
  }
  return {
    trainerId: trainer.auth_user_id,
    userId,
    email,
    accessToken,
    verificationStatus: trainer.verification_status ?? 'pending',
    rejectionReason: trainer.verification_rejection_reason,
  };
}


export async function refreshAuthSession(refreshToken: string) {
  if (!isSupabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  if (!refreshToken) throw new Error('REFRESH_TOKEN_MISSING');

  const response = await fetch(
    SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token',
    {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  );

  if (!response.ok) throw new Error(await readError(response));

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
  };

  if (!body.access_token) throw new Error('새 로그인 세션을 만들지 못했어요.');

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? refreshToken,
  };
}
