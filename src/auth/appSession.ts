import type { SQLiteDatabase } from 'expo-sqlite';

export type AppRole = 'trainer' | 'member';

export type TrainerSession = {
  role: 'trainer';
  trainerId: string;
};

export type MemberSession = {
  role: 'member';
  memberId: string;
};

export type AppSession = TrainerSession | MemberSession;

const APP_SESSION_KEY = 'app_session';

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

  return { pathname: '/' as const };
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
