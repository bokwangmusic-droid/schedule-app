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
  member_id: string | null;
  member_name: string | null;
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
    memberId: row.member_id,
    memberName: row.member_name,
    isAllDay: row.is_all_day === 1,
    isCompleted: row.is_completed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const scheduleSelect = `
  SELECT s.*, m.name AS member_name
  FROM schedules s
  LEFT JOIN members m ON m.id = s.member_id
`;

export async function listSchedulesForDate(db: SQLiteDatabase, date: string) {
  const rows = await db.getAllAsync<ScheduleRow>(
    `${scheduleSelect}
     WHERE s.date = ?
     ORDER BY s.is_completed ASC,
              CASE WHEN s.is_all_day = 1 THEN 0 ELSE 1 END ASC,
              s.start_time ASC,
              s.created_at ASC`,
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
    `${scheduleSelect}
     WHERE s.date >= ? AND s.date <= ?
     ORDER BY s.date ASC,
              CASE WHEN s.is_all_day = 1 THEN 0 ELSE 1 END ASC,
              s.start_time ASC,
              s.created_at ASC`,
    [startDate, endDate],
  );

  return rows.map(mapScheduleRow);
}

export async function getScheduleById(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<ScheduleRow>(
    `${scheduleSelect} WHERE s.id = ? LIMIT 1`,
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
      member_id,
      is_all_day,
      is_completed,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      input.title.trim(),
      input.date,
      input.startTime ?? null,
      input.endTime ?? null,
      input.memo?.trim() || null,
      input.color ?? null,
      input.memberId ?? null,
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
         member_id = ?,
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
      input.memberId ?? null,
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
