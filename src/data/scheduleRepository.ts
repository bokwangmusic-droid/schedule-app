import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  CreateScheduleInput,
  ScheduleItem,
  UpdateScheduleInput,
  AttendanceStatus,
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
  member_pt_total_sessions: number | null;
  member_pt_remaining_sessions: number | null;
  member_pt_projected_remaining_sessions: number | null;
  is_all_day: number;
  is_completed: number;
  attendance_status: AttendanceStatus | null;
  session_note: string | null;
  signature_json: string | null;
  signed_at: string | null;
  pt_consumed: number;
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
    memberPtTotalSessions: row.member_pt_total_sessions,
    memberPtRemainingSessions: row.member_pt_remaining_sessions,
    memberPtProjectedRemainingSessions: row.member_pt_projected_remaining_sessions,
    isAllDay: row.is_all_day === 1,
    isCompleted: row.is_completed === 1,
    attendanceStatus: row.attendance_status,
    sessionNote: row.session_note,
    signatureJson: row.signature_json,
    signedAt: row.signed_at,
    ptConsumed: row.pt_consumed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const scheduleSelect = `
  SELECT
    s.*,
    m.name AS member_name,
    m.pt_total_sessions AS member_pt_total_sessions,
    m.pt_remaining_sessions AS member_pt_remaining_sessions,
    m.pt_remaining_sessions AS member_pt_projected_remaining_sessions
  FROM schedules s
  LEFT JOIN members m ON m.id = s.member_id
`;

const scheduleSelectWithProjection = `
  SELECT
    s.*,
    m.name AS member_name,
    m.pt_total_sessions AS member_pt_total_sessions,
    m.pt_remaining_sessions AS member_pt_remaining_sessions,
    CASE
      WHEN m.pt_remaining_sessions IS NULL OR s.member_id IS NULL THEN NULL
      WHEN s.date < ? THEN m.pt_remaining_sessions
      ELSE MAX(
        m.pt_remaining_sessions - (
          SELECT COUNT(*)
          FROM schedules p
          WHERE p.member_id = s.member_id
            AND p.is_all_day = 0
            AND COALESCE(p.pt_consumed, 0) = 0
            AND COALESCE(p.attendance_status, '') NOT IN ('canceled', 'no_show')
            AND p.date >= ?
            AND (
              p.date < s.date
              OR (
                p.date = s.date
                AND COALESCE(p.start_time, '00:00') < COALESCE(s.start_time, '00:00')
              )
              OR (
                p.date = s.date
                AND COALESCE(p.start_time, '00:00') = COALESCE(s.start_time, '00:00')
                AND p.created_at <= s.created_at
              )
            )
        ),
        0
      )
    END AS member_pt_projected_remaining_sessions
  FROM schedules s
  LEFT JOIN members m ON m.id = s.member_id
`;

export async function listSchedulesForDate(
  db: SQLiteDatabase,
  date: string,
  projectionBaseDate = date,
) {
  const rows = await db.getAllAsync<ScheduleRow>(
    `${scheduleSelectWithProjection}
     WHERE s.date = ?
     ORDER BY s.is_completed ASC,
              CASE WHEN s.is_all_day = 1 THEN 0 ELSE 1 END ASC,
              s.start_time ASC,
              s.created_at ASC`,
    [projectionBaseDate, projectionBaseDate, date],
  );

  return rows.map(mapScheduleRow);
}

export async function listSchedulesForRange(
  db: SQLiteDatabase,
  startDate: string,
  endDate: string,
  projectionBaseDate = startDate,
) {
  const rows = await db.getAllAsync<ScheduleRow>(
    `${scheduleSelectWithProjection}
     WHERE s.date >= ? AND s.date <= ?
     ORDER BY s.date ASC,
              CASE WHEN s.is_all_day = 1 THEN 0 ELSE 1 END ASC,
              s.start_time ASC,
              s.created_at ASC`,
    [projectionBaseDate, projectionBaseDate, startDate, endDate],
  );

  return rows.map(mapScheduleRow);
}

export async function listMemberUpcomingSchedules(
  db: SQLiteDatabase,
  memberId: string,
  fromDate: string,
  limit = 20,
) {
  const rows = await db.getAllAsync<ScheduleRow>(
    `${scheduleSelect}
     WHERE s.member_id = ?
       AND s.date >= ?
       AND s.is_completed = 0
       AND COALESCE(s.attendance_status, '') NOT IN ('completed', 'canceled', 'no_show')
     ORDER BY s.date ASC,
              CASE WHEN s.is_all_day = 1 THEN 0 ELSE 1 END ASC,
              COALESCE(s.start_time, '00:00') ASC,
              s.created_at ASC
     LIMIT ?`,
    [memberId, fromDate, limit],
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

export async function getLatestMemberSessionNote(
  db: SQLiteDatabase,
  memberId: string,
  excludeScheduleId?: string,
) {
  const row = await db.getFirstAsync<{ session_note: string | null; date: string; start_time: string | null }>(
    `SELECT session_note, date, start_time
     FROM schedules
     WHERE member_id = ?
       AND attendance_status = 'completed'
       AND session_note IS NOT NULL
       AND TRIM(session_note) <> ''
       ${excludeScheduleId ? 'AND id <> ?' : ''}
     ORDER BY date DESC, COALESCE(start_time, '00:00') DESC, signed_at DESC
     LIMIT 1`,
    excludeScheduleId ? [memberId, excludeScheduleId] : [memberId],
  );

  return row
    ? {
        note: row.session_note ?? '',
        date: row.date,
        startTime: row.start_time,
      }
    : null;
}

export async function setScheduleAttendanceStatus(
  db: SQLiteDatabase,
  id: string,
  status: Exclude<AttendanceStatus, 'completed'>,
) {
  const schedule = await db.getFirstAsync<{ pt_consumed: number }>(
    'SELECT pt_consumed FROM schedules WHERE id = ? LIMIT 1',
    [id],
  );

  if (!schedule) {
    throw new Error('SCHEDULE_NOT_FOUND');
  }
  if (schedule.pt_consumed === 1) {
    throw new Error('PT_ALREADY_CONSUMED');
  }

  await db.runAsync(
    `UPDATE schedules
     SET attendance_status = ?,
         is_completed = 0,
         session_note = NULL,
         signature_json = NULL,
         signed_at = NULL,
         updated_at = ?
     WHERE id = ?`,
    [status, new Date().toISOString(), id],
  );
}

export async function completeMemberSessionWithSignature(
  db: SQLiteDatabase,
  id: string,
  signatureJson: string,
  sessionNote?: string | null,
): Promise<{ remainingSessions: number; signedAt: string }> {
  const now = new Date().toISOString();
  let completionResult: { remainingSessions: number; signedAt: string } | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const schedule = await txn.getFirstAsync<{
      member_id: string | null;
      pt_consumed: number;
      attendance_status: string | null;
    }>(
      'SELECT member_id, pt_consumed, attendance_status FROM schedules WHERE id = ? LIMIT 1',
      [id],
    );

    if (!schedule) {
      throw new Error('SCHEDULE_NOT_FOUND');
    }
    if (!schedule.member_id) {
      throw new Error('MEMBER_REQUIRED');
    }
    if (schedule.pt_consumed === 1 || schedule.attendance_status === 'completed') {
      throw new Error('PT_ALREADY_CONSUMED');
    }

    const member = await txn.getFirstAsync<{
      pt_remaining_sessions: number | null;
    }>(
      'SELECT pt_remaining_sessions FROM members WHERE id = ? LIMIT 1',
      [schedule.member_id],
    );

    if (!member) {
      throw new Error('MEMBER_NOT_FOUND');
    }
    if (member.pt_remaining_sessions === null) {
      throw new Error('PT_BALANCE_NOT_SET');
    }
    if (member.pt_remaining_sessions <= 0) {
      throw new Error('NO_PT_REMAINING');
    }

    const nextRemaining = member.pt_remaining_sessions - 1;

    await txn.runAsync(
      `UPDATE members
       SET pt_remaining_sessions = ?, updated_at = ?
       WHERE id = ?`,
      [nextRemaining, now, schedule.member_id],
    );

    await txn.runAsync(
      `UPDATE schedules
       SET attendance_status = 'completed',
           is_completed = 1,
           session_note = ?,
           signature_json = ?,
           signed_at = ?,
           pt_consumed = 1,
           updated_at = ?
       WHERE id = ?`,
      [sessionNote?.trim() || null, signatureJson, now, now, id],
    );

    completionResult = { remainingSessions: nextRemaining, signedAt: now };
  });

  if (!completionResult) {
    throw new Error('PT_COMPLETION_FAILED');
  }

  return completionResult;
}


export type SignedMemberSession = {
  id: string;
  sessionNumber: number;
  date: string;
  startTime: string | null;
  endTime: string | null;
  sessionNote: string | null;
  signatureJson: string;
  signedAt: string;
};

export async function listSignedMemberSessions(
  db: SQLiteDatabase,
  memberId: string,
): Promise<SignedMemberSession[]> {
  const [rows, member] = await Promise.all([
    db.getAllAsync<{
      id: string;
      date: string;
      start_time: string | null;
      end_time: string | null;
      session_note: string | null;
      signature_json: string;
      signed_at: string;
    }>(
      `SELECT
         id,
         date,
         start_time,
         end_time,
         session_note,
         signature_json,
         signed_at
       FROM schedules
       WHERE member_id = ?
         AND attendance_status = 'completed'
         AND pt_consumed = 1
         AND signature_json IS NOT NULL
         AND signed_at IS NOT NULL
       ORDER BY date ASC, COALESCE(start_time, '00:00') ASC, signed_at ASC`,
      [memberId],
    ),
    db.getFirstAsync<{
      pt_total_sessions: number | null;
      pt_remaining_sessions: number | null;
    }>(
      `SELECT pt_total_sessions, pt_remaining_sessions
       FROM members
       WHERE id = ?
       LIMIT 1`,
      [memberId],
    ),
  ]);

  const completedCount =
    member?.pt_total_sessions !== null &&
    member?.pt_total_sessions !== undefined &&
    member?.pt_remaining_sessions !== null &&
    member?.pt_remaining_sessions !== undefined
      ? Math.max(member.pt_total_sessions - member.pt_remaining_sessions, rows.length)
      : rows.length;
  const firstSessionNumber = Math.max(completedCount - rows.length + 1, 1);

  return rows
    .map((row, index) => ({
      id: row.id,
      sessionNumber: firstSessionNumber + index,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      sessionNote: row.session_note,
      signatureJson: row.signature_json,
      signedAt: row.signed_at,
    }))
    .reverse();
}
