import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  CreateScheduleInput,
  ScheduleItem,
  UpdateScheduleInput,
} from '../types/schedule';

type ScheduleRow = {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  memo: string | null;
  color: string | null;
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
    color: row.color,
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

export async function listSchedulesForRange(
  db: SQLiteDatabase,
  startDate: string,
  endDate: string,
) {
  const rows = await db.getAllAsync<ScheduleRow>(
    `SELECT *
     FROM schedules
     WHERE date >= ? AND date <= ?
     ORDER BY date ASC,
              CASE WHEN is_all_day = 1 THEN 0 ELSE 1 END ASC,
              start_time ASC,
              created_at ASC`,
    [startDate, endDate],
  );

  return rows.map(mapScheduleRow);
}

export async function getScheduleById(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<ScheduleRow>(
    'SELECT * FROM schedules WHERE id = ? LIMIT 1',
    [id],
  );

  return row ? mapScheduleRow(row) : null;
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
      color,
      is_all_day,
      is_completed,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      input.title.trim(),
      input.date,
      input.startTime ?? null,
      input.endTime ?? null,
      input.memo?.trim() || null,
      input.color ?? null,
      input.isAllDay ? 1 : 0,
      now,
      now,
    ],
  );

  return id;
}

export async function updateSchedule(
  db: SQLiteDatabase,
  id: string,
  input: UpdateScheduleInput,
) {
  await db.runAsync(
    `UPDATE schedules
     SET title = ?,
         date = ?,
         start_time = ?,
         end_time = ?,
         memo = ?,
         color = ?,
         is_all_day = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      input.title.trim(),
      input.date,
      input.startTime ?? null,
      input.endTime ?? null,
      input.memo?.trim() || null,
      input.color ?? null,
      input.isAllDay ? 1 : 0,
      new Date().toISOString(),
      id,
    ],
  );
}

export async function deleteSchedule(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM schedules WHERE id = ?', [id]);
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
