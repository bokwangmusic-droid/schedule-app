import type { SQLiteDatabase } from 'expo-sqlite';
import { SUPABASE_URL, supabaseHeaders } from './supabaseConfig';
import type { WellnessLevel } from '../types/memberFitness';

export type MemberSelfCheck = {
  memberId: string;
  date: string;
  activityLevel: WellnessLevel | null;
  cardioTreadmill: string | null;
  cardioBike: string | null;
  cardioStepmill: string | null;
  updatedAt: string;
};

type RemoteSelfCheck = {
  member_id: string;
  date: string;
  activity_level: WellnessLevel | null;
  cardio_treadmill: string | null;
  cardio_bike: string | null;
  cardio_stepmill: string | null;
  updated_at: string;
};

function clean(value: string | null | undefined) {
  return value?.trim() || null;
}

export async function getLocalMemberSelfCheck(
  db: SQLiteDatabase,
  memberId: string,
  date: string,
): Promise<MemberSelfCheck | null> {
  const row = await db.getFirstAsync<{
    member_id: string;
    date: string;
    activity_level: WellnessLevel | null;
    cardio_treadmill: string | null;
    cardio_bike: string | null;
    cardio_stepmill: string | null;
    updated_at: string;
  }>(
    'SELECT * FROM member_self_checks WHERE member_id = ? AND date = ? LIMIT 1',
    [memberId, date],
  );
  return row
    ? {
        memberId: row.member_id,
        date: row.date,
        activityLevel: row.activity_level,
        cardioTreadmill: row.cardio_treadmill,
        cardioBike: row.cardio_bike,
        cardioStepmill: row.cardio_stepmill,
        updatedAt: row.updated_at,
      }
    : null;
}

export async function saveLocalMemberSelfCheck(
  db: SQLiteDatabase,
  input: Omit<MemberSelfCheck, 'updatedAt'>,
) {
  const updatedAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO member_self_checks (
      member_id, date, activity_level, cardio_treadmill, cardio_bike, cardio_stepmill, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(member_id, date) DO UPDATE SET
      activity_level = excluded.activity_level,
      cardio_treadmill = excluded.cardio_treadmill,
      cardio_bike = excluded.cardio_bike,
      cardio_stepmill = excluded.cardio_stepmill,
      updated_at = excluded.updated_at`,
    [
      input.memberId,
      input.date,
      input.activityLevel,
      clean(input.cardioTreadmill),
      clean(input.cardioBike),
      clean(input.cardioStepmill),
      updatedAt,
    ],
  );
  return updatedAt;
}

export async function saveRemoteMemberSelfCheck(
  accessToken: string,
  input: Omit<MemberSelfCheck, 'updatedAt'>,
) {
  const response = await fetch(SUPABASE_URL + '/rest/v1/member_self_checks?on_conflict=member_id,date', {
    method: 'POST',
    headers: {
      ...supabaseHeaders(accessToken),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      member_id: input.memberId,
      date: input.date,
      activity_level: input.activityLevel,
      cardio_treadmill: clean(input.cardioTreadmill),
      cardio_bike: clean(input.cardioBike),
      cardio_stepmill: clean(input.cardioStepmill),
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    let message = '회원 입력을 서버에 저장하지 못했어요.';
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {}
    throw new Error(message);
  }

  const rows = (await response.json()) as RemoteSelfCheck[];
  return rows[0] ?? null;
}
