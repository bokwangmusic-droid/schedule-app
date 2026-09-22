import type { SQLiteDatabase } from 'expo-sqlite';
import { SUPABASE_URL, supabaseHeaders } from './supabaseConfig';

type RemoteMember = {
  id: string;
  name: string;
  phone: string | null;
  membership_start_date: string | null;
  membership_end_date: string | null;
  pt_total_sessions: number | null;
  pt_remaining_sessions: number | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type RemoteSchedule = {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  memo: string | null;
  color: string | null;
  member_id: string | null;
  is_all_day: boolean;
  is_completed: boolean;
  attendance_status: string | null;
  session_note: string | null;
  signature_json: string | null;
  signed_at: string | null;
  pt_consumed: boolean;
  created_at: string;
  updated_at: string;
};

type RemoteLog = {
  id: string;
  member_id: string;
  schedule_id: string | null;
  date: string;
  body_part: string | null;
  sleep_quality: string | null;
  condition_level: string | null;
  activity_level: string | null;
  diet_control: boolean;
  hydration: boolean;
  cardio_treadmill: string | null;
  cardio_bike: string | null;
  cardio_stepmill: string | null;
  breakfast_carbs: string | null;
  breakfast_protein: string | null;
  breakfast_fat: string | null;
  lunch_carbs: string | null;
  lunch_protein: string | null;
  lunch_fat: string | null;
  dinner_carbs: string | null;
  dinner_protein: string | null;
  dinner_fat: string | null;
  snack: string | null;
  summary: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
};

type RemoteExercise = {
  id: string;
  log_id: string;
  exercise_order: number;
  name: string;
  created_at: string;
};

type RemoteSet = {
  id: string;
  exercise_id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  created_at: string;
};

type RemoteBody = {
  id: string;
  member_id: string;
  measured_date: string;
  weight: number | null;
  skeletal_muscle: number | null;
  body_fat: number | null;
  body_fat_percentage: number | null;
  created_at: string;
  updated_at: string;
};

async function fetchRows<T>(path: string, accessToken: string): Promise<T[]> {
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    headers: {
      ...supabaseHeaders(accessToken),
      Prefer: 'return=representation',
    },
  });

  if (!response.ok) {
    let message = '회원 데이터를 동기화하지 못했어요.';
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {}
    throw new Error(message);
  }

  return (await response.json()) as T[];
}

function inFilter(values: string[]) {
  return values.map((value) => '"' + value.replace(/"/g, '') + '"').join(',');
}

export async function syncMemberSnapshot(
  db: SQLiteDatabase,
  accessToken: string,
  memberId: string,
) {
  const encodedMemberId = encodeURIComponent(memberId);
  const [members, schedules, logs, bodyRecords] = await Promise.all([
    fetchRows<RemoteMember>(
      'members?id=eq.' + encodedMemberId + '&select=*',
      accessToken,
    ),
    fetchRows<RemoteSchedule>(
      'schedules?member_id=eq.' + encodedMemberId + '&select=*&order=date.desc',
      accessToken,
    ),
    fetchRows<RemoteLog>(
      'member_training_logs?member_id=eq.' + encodedMemberId + '&select=*&order=date.desc',
      accessToken,
    ),
    fetchRows<RemoteBody>(
      'member_body_records?member_id=eq.' + encodedMemberId + '&select=*&order=measured_date.desc',
      accessToken,
    ),
  ]);

  const member = members[0];
  if (!member) throw new Error('서버에서 회원 정보를 찾지 못했어요.');

  const logIds = logs.map((row) => row.id);
  const exercises =
    logIds.length > 0
      ? await fetchRows<RemoteExercise>(
          'member_training_exercises?log_id=in.(' +
            encodeURIComponent(inFilter(logIds)) +
            ')&select=*&order=exercise_order.asc',
          accessToken,
        )
      : [];

  const exerciseIds = exercises.map((row) => row.id);
  const sets =
    exerciseIds.length > 0
      ? await fetchRows<RemoteSet>(
          'member_training_sets?exercise_id=in.(' +
            encodeURIComponent(inFilter(exerciseIds)) +
            ')&select=*&order=set_number.asc',
          accessToken,
        )
      : [];

  await db.withTransactionAsync(async () => {
    const oldExerciseIds = await db.getAllAsync<{ id: string }>(
      `SELECT e.id
       FROM member_training_exercises e
       JOIN member_training_logs l ON l.id = e.log_id
       WHERE l.member_id = ?`,
      [memberId],
    );

    for (const row of oldExerciseIds) {
      await db.runAsync('DELETE FROM member_training_sets WHERE exercise_id = ?', [row.id]);
    }

    await db.runAsync(
      `DELETE FROM member_training_exercises
       WHERE log_id IN (SELECT id FROM member_training_logs WHERE member_id = ?)`,
      [memberId],
    );
    await db.runAsync('DELETE FROM member_training_logs WHERE member_id = ?', [memberId]);
    await db.runAsync('DELETE FROM member_body_records WHERE member_id = ?', [memberId]);
    await db.runAsync('DELETE FROM schedules WHERE member_id = ?', [memberId]);

    await db.runAsync(
      `INSERT INTO members (
        id, name, phone, membership_start_date, membership_end_date,
        pt_total_sessions, pt_remaining_sessions, memo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        phone = excluded.phone,
        membership_start_date = excluded.membership_start_date,
        membership_end_date = excluded.membership_end_date,
        pt_total_sessions = excluded.pt_total_sessions,
        pt_remaining_sessions = excluded.pt_remaining_sessions,
        memo = excluded.memo,
        updated_at = excluded.updated_at`,
      [
        member.id,
        member.name,
        member.phone,
        member.membership_start_date,
        member.membership_end_date,
        member.pt_total_sessions,
        member.pt_remaining_sessions,
        member.memo,
        member.created_at,
        member.updated_at,
      ],
    );

    for (const row of schedules) {
      await db.runAsync(
        `INSERT INTO schedules (
          id, title, date, start_time, end_time, memo, color, member_id,
          is_all_day, is_completed, attendance_status, session_note,
          signature_json, signed_at, pt_consumed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.title,
          row.date,
          row.start_time,
          row.end_time,
          row.memo,
          row.color,
          row.member_id,
          row.is_all_day ? 1 : 0,
          row.is_completed ? 1 : 0,
          row.attendance_status,
          row.session_note,
          row.signature_json,
          row.signed_at,
          row.pt_consumed ? 1 : 0,
          row.created_at,
          row.updated_at,
        ],
      );
    }

    for (const row of logs) {
      await db.runAsync(
        `INSERT INTO member_training_logs (
          id, member_id, schedule_id, date, body_part, sleep_quality,
          condition_level, activity_level, diet_control, hydration,
          cardio_treadmill, cardio_bike, cardio_stepmill,
          breakfast_carbs, breakfast_protein, breakfast_fat,
          lunch_carbs, lunch_protein, lunch_fat,
          dinner_carbs, dinner_protein, dinner_fat,
          snack, summary, feedback, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.member_id,
          row.schedule_id,
          row.date,
          row.body_part,
          row.sleep_quality,
          row.condition_level,
          row.activity_level,
          row.diet_control ? 1 : 0,
          row.hydration ? 1 : 0,
          row.cardio_treadmill,
          row.cardio_bike,
          row.cardio_stepmill,
          row.breakfast_carbs,
          row.breakfast_protein,
          row.breakfast_fat,
          row.lunch_carbs,
          row.lunch_protein,
          row.lunch_fat,
          row.dinner_carbs,
          row.dinner_protein,
          row.dinner_fat,
          row.snack,
          row.summary,
          row.feedback,
          row.created_at,
          row.updated_at,
        ],
      );
    }

    for (const row of exercises) {
      await db.runAsync(
        `INSERT INTO member_training_exercises (
          id, log_id, exercise_order, name, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [row.id, row.log_id, row.exercise_order, row.name, row.created_at],
      );
    }

    for (const row of sets) {
      await db.runAsync(
        `INSERT INTO member_training_sets (
          id, exercise_id, set_number, weight, reps, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.exercise_id, row.set_number, row.weight, row.reps, row.created_at],
      );
    }

    for (const row of bodyRecords) {
      await db.runAsync(
        `INSERT INTO member_body_records (
          id, member_id, measured_date, weight, skeletal_muscle,
          body_fat, body_fat_percentage, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.member_id,
          row.measured_date,
          row.weight,
          row.skeletal_muscle,
          row.body_fat,
          row.body_fat_percentage,
          row.created_at,
          row.updated_at,
        ],
      );
    }
  });
}
