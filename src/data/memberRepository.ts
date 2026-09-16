import type { SQLiteDatabase } from 'expo-sqlite';
import type { CreateMemberInput, MemberItem } from '../types/member';

type MemberRow = {
  id: string;
  name: string;
  phone: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

function mapMemberRow(row: MemberRow): MemberItem {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
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

export async function createMember(db: SQLiteDatabase, input: CreateMemberInput) {
  const now = new Date().toISOString();
  const id = createId();

  await db.runAsync(
    `INSERT INTO members (id, name, phone, memo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.phone?.trim() || null,
      input.memo?.trim() || null,
      now,
      now,
    ],
  );

  return id;
}

export async function deleteMember(db: SQLiteDatabase, id: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE schedules SET member_id = NULL, updated_at = ? WHERE member_id = ?',
      [new Date().toISOString(), id],
    );
    await db.runAsync('DELETE FROM members WHERE id = ?', [id]);
  });
}
