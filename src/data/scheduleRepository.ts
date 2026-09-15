import type { SQLiteDatabase } from 'expo-sqlite';
import type { CreateScheduleInput, ScheduleItem } from '../types/schedule';

type ScheduleRow = {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  memo: string | null;
  is_all_day: number;
  is_completed: number;
  created_at: string;
  updated_at: string;
};

function mapScheduleRow(row: ScheduleRow): ScheduleItem {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    memo: row.memo,
    isAllDay: row.is_all_day === 1,
    isCompleted: row.is_completed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listSchedulesForDate(db: SQLiteDatabase, date: string) {
  const rows = await db.getAllAsync<ScheduleRow>(
    `SELECT *
     FROM schedules
     WHERE date = ?
     ORDER BY is_completed ASC,
              CASE WHEN is_all_day = 1 THEN 0 ELSE 1 END ASC,
              start_time ASC,
              created_at ASC`,
    [date],
  );

  return rows.map(mapScheduleRow);
}

export async function createSchedule(
  db: SQLiteDatabase,
  input: CreateScheduleInput,
) {
  const now = new Date().toISOString();
  const id = createId();

  await db.runAsync(
    `INSERT INTO schedules (
      id,
      title,
      date,
      start_time,
      end_time,
      memo,
      is_all_day,
      is_completed,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      input.title.trim(),
      input.date,
      input.startTime ?? null,
      input.endTime ?? null,
      input.memo?.trim() || null,
      input.isAllDay ? 1 : 0,
      now,
      now,
    ],
  );

  return id;
}

export async function setScheduleCompleted(
  db: SQLiteDatabase,
  id: string,
  completed: boolean,
) {
  await db.runAsync(
    `UPDATE schedules
     SET is_completed = ?, updated_at = ?
     WHERE id = ?`,
    [completed ? 1 : 0, new Date().toISOString(), id],
  );
}
