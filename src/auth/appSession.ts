import type { SQLiteDatabase } from 'expo-sqlite';

export type AppRole = 'trainer' | 'member';

export type TrainerSession = {
  role: 'trainer';
  trainerId: string;
  accessToken?: string;
  refreshToken?: string;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  verificationSubmittedAt?: string | null;
  email?: string;
  passwordReady?: boolean;
};

export type MemberSession = {
  role: 'member';
  memberId: string;
  accessToken?: string;
  refreshToken?: string;
  passwordReady?: boolean;
};

export type AppSession = TrainerSession | MemberSession;

const APP_SESSION_KEY = 'app_session';
const AUTH_FLOW_KEY = 'pending_auth_flow';

export type PendingAuthFlow = {
  role: AppRole;
  codeVerifier: string;
  requestedAt: string;
};

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  trainer: '강사',
  member: '회원',
};

export function memberHomeRoute(memberId: string) {
  return {
    pathname: '/member-view/[id]' as const,
    params: { id: memberId },
  };
}

export function roleHomeRoute(session: AppSession) {
  if (session.role === 'member') {
    return memberHomeRoute(session.memberId);
  }

  return { pathname: '/trainer' as const };
}

export async function getAppSession(db: SQLiteDatabase): Promise<AppSession | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ? LIMIT 1',
    [APP_SESSION_KEY],
  );

  if (!row?.value) return null;

  try {
    const parsed = JSON.parse(row.value) as Partial<AppSession> | null;
    if (
      parsed?.role === 'trainer' &&
      typeof (parsed as Partial<TrainerSession>).trainerId === 'string'
    ) {
      return parsed as TrainerSession;
    }
    if (
      parsed?.role === 'member' &&
      typeof (parsed as Partial<MemberSession>).memberId === 'string'
    ) {
      return parsed as MemberSession;
    }
  } catch {
    return null;
  }

  return null;
}

export async function saveAppSession(db: SQLiteDatabase, session: AppSession) {
  await db.runAsync(
    `INSERT INTO app_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [APP_SESSION_KEY, JSON.stringify(session)],
  );
}

export async function clearAppSession(db: SQLiteDatabase) {
  await db.runAsync('DELETE FROM app_settings WHERE key = ?', [APP_SESSION_KEY]);
}


let launchAuthenticated = false;

export function authorizeCurrentLaunch() {
  launchAuthenticated = true;
}

export function isCurrentLaunchAuthorized() {
  return launchAuthenticated;
}


export async function savePendingAuthFlow(
  db: SQLiteDatabase,
  flow: PendingAuthFlow,
) {
  await db.runAsync(
    `INSERT INTO app_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [AUTH_FLOW_KEY, JSON.stringify(flow)],
  );
}

export async function getPendingAuthFlow(
  db: SQLiteDatabase,
): Promise<PendingAuthFlow | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ? LIMIT 1',
    [AUTH_FLOW_KEY],
  );
  if (!row?.value) return null;
  try {
    const parsed = JSON.parse(row.value) as Partial<PendingAuthFlow>;
    if (
      (parsed.role === 'trainer' || parsed.role === 'member') &&
      typeof parsed.codeVerifier === 'string' &&
      parsed.codeVerifier.length >= 43
    ) {
      return {
        role: parsed.role,
        codeVerifier: parsed.codeVerifier,
        requestedAt: typeof parsed.requestedAt === 'string' ? parsed.requestedAt : '',
      };
    }
  } catch {}
  return null;
}

export async function clearPendingAuthFlow(db: SQLiteDatabase) {
  await db.runAsync('DELETE FROM app_settings WHERE key = ?', [AUTH_FLOW_KEY]);
}
