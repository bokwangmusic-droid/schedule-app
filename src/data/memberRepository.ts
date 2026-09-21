import type { SQLiteDatabase } from 'expo-sqlite';
import type { CreateMemberInput, MemberItem, UpdateMemberInput } from '../types/member';

type MemberRow = {
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

function mapMemberRow(row: MemberRow): MemberItem {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    membershipStartDate: row.membership_start_date,
    membershipEndDate: row.membership_end_date,
    ptTotalSessions: row.pt_total_sessions,
    ptRemainingSessions: row.pt_remaining_sessions,
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listMembers(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<MemberRow>(
    `SELECT *
     FROM members
     ORDER BY name COLLATE NOCASE ASC, created_at ASC`,
  );

  return rows.map(mapMemberRow);
}

export async function getMemberById(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<MemberRow>(
    `SELECT *
     FROM members
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  return row ? mapMemberRow(row) : null;
}

export async function createMember(db: SQLiteDatabase, input: CreateMemberInput) {
  const now = new Date().toISOString();
  const id = createId();

  await db.runAsync(
    `INSERT INTO members (
      id,
      name,
      phone,
      membership_start_date,
      membership_end_date,
      pt_total_sessions,
      pt_remaining_sessions,
      memo,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.phone?.trim() || null,
      input.membershipStartDate?.trim() || null,
      input.membershipEndDate?.trim() || null,
      input.ptTotalSessions ?? null,
      input.ptRemainingSessions ?? null,
      input.memo?.trim() || null,
      now,
      now,
    ],
  );

  return id;
}

export async function updateMember(
  db: SQLiteDatabase,
  id: string,
  input: UpdateMemberInput,
) {
  await db.runAsync(
    `UPDATE members
     SET name = ?,
         phone = ?,
         membership_start_date = ?,
         membership_end_date = ?,
         pt_total_sessions = ?,
         pt_remaining_sessions = ?,
         memo = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      input.name.trim(),
      input.phone?.trim() || null,
      input.membershipStartDate?.trim() || null,
      input.membershipEndDate?.trim() || null,
      input.ptTotalSessions ?? null,
      input.ptRemainingSessions ?? null,
      input.memo?.trim() || null,
      new Date().toISOString(),
      id,
    ],
  );
}

export async function deleteMember(db: SQLiteDatabase, id: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE schedules SET member_id = NULL, updated_at = ? WHERE member_id = ?',
      [new Date().toISOString(), id],
    );
    await db.runAsync(
      `DELETE FROM member_training_sets
       WHERE exercise_id IN (
         SELECT e.id
         FROM member_training_exercises e
         INNER JOIN member_training_logs l ON l.id = e.log_id
         WHERE l.member_id = ?
       )`,
      [id],
    );
    await db.runAsync(
      `DELETE FROM member_training_exercises
       WHERE log_id IN (
         SELECT id FROM member_training_logs WHERE member_id = ?
       )`,
      [id],
    );
    await db.runAsync('DELETE FROM member_training_logs WHERE member_id = ?', [id]);
    await db.runAsync('DELETE FROM member_body_records WHERE member_id = ?', [id]);
    await db.runAsync('DELETE FROM members WHERE id = ?', [id]);
  });
}
