import type { SQLiteDatabase } from 'expo-sqlite';
import type { CreateTrainingLogInput } from '../types/memberFitness';

type DraftRow = {
  payload_json: string;
  updated_at: string;
};

export function trainingLogDraftKey(
  memberId: string,
  scheduleId?: string | null,
  logId?: string | null,
) {
  if (logId) return `training-log:edit:${logId}`;
  if (scheduleId) return `training-log:schedule:${scheduleId}`;
  return `training-log:member:${memberId}:new`;
}

export async function loadTrainingLogDraft(
  db: SQLiteDatabase,
  draftKey: string,
): Promise<{ input: CreateTrainingLogInput; updatedAt: string } | null> {
  const row = await db.getFirstAsync<DraftRow>(
    `SELECT payload_json, updated_at
     FROM member_training_log_drafts
     WHERE draft_key = ?
     LIMIT 1`,
    [draftKey],
  );
  if (!row) return null;

  try {
    return {
      input: JSON.parse(row.payload_json) as CreateTrainingLogInput,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}

export async function saveTrainingLogDraft(
  db: SQLiteDatabase,
  draftKey: string,
  memberId: string,
  input: CreateTrainingLogInput,
) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO member_training_log_drafts (
       draft_key, member_id, payload_json, updated_at
     ) VALUES (?, ?, ?, ?)
     ON CONFLICT(draft_key) DO UPDATE SET
       member_id = excluded.member_id,
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at`,
    [draftKey, memberId, JSON.stringify(input), now],
  );
  return now;
}

export async function deleteTrainingLogDraft(
  db: SQLiteDatabase,
  draftKey: string,
) {
  await db.runAsync(
    'DELETE FROM member_training_log_drafts WHERE draft_key = ?',
    [draftKey],
  );
}
