import type { SQLiteDatabase } from 'expo-sqlite';
import { SUPABASE_URL, supabaseHeaders } from './supabaseConfig';

const META_OWNER = 'trainer_cloud_owner_id';
function metaUpdatedAt(trainerId: string) {
  return 'trainer_cloud_synced_at:' + trainerId;
}
function metaHash(trainerId: string) {
  return 'trainer_cloud_payload_hash:' + trainerId;
}

type SnapshotPayload = {
  version: 1;
  members: Record<string, unknown>[];
  schedules: Record<string, unknown>[];
  trainingLogs: Record<string, unknown>[];
  trainingExercises: Record<string, unknown>[];
  trainingSets: Record<string, unknown>[];
  bodyRecords: Record<string, unknown>[];
  manualSignatures: Record<string, unknown>[];
  programDefinitions: Record<string, unknown>[];
  memberPrograms: Record<string, unknown>[];
  postureAssessments: Record<string, unknown>[];
  exerciseDefinitions: Record<string, unknown>[];
  appSettings: Record<string, unknown>[];
};

type RemoteSnapshotRow = {
  auth_user_id: string;
  payload: SnapshotPayload;
  updated_at: string;
};

const tableSpecs = [
  {
    key: 'members',
    table: 'members',
    orderBy: 'id',
    columns: ['id','name','phone','membership_start_date','membership_end_date','pt_total_sessions','pt_remaining_sessions','memo','created_at','updated_at'],
  },
  {
    key: 'schedules',
    table: 'schedules',
    orderBy: 'id',
    columns: ['id','title','date','start_time','end_time','memo','color','member_id','is_all_day','is_completed','attendance_status','session_note','signature_json','signed_at','pt_consumed','created_at','updated_at'],
  },
  {
    key: 'trainingLogs',
    table: 'member_training_logs',
    orderBy: 'id',
    columns: ['id','member_id','schedule_id','date','body_part','sleep_quality','condition_level','activity_level','diet_control','hydration','cardio_treadmill','cardio_bike','cardio_stepmill','breakfast_carbs','breakfast_protein','breakfast_fat','lunch_carbs','lunch_protein','lunch_fat','dinner_carbs','dinner_protein','dinner_fat','snack','summary','feedback','created_at','updated_at'],
  },
  {
    key: 'trainingExercises',
    table: 'member_training_exercises',
    orderBy: 'id',
    columns: ['id','log_id','exercise_order','name','created_at'],
  },
  {
    key: 'trainingSets',
    table: 'member_training_sets',
    orderBy: 'id',
    columns: ['id','exercise_id','set_number','weight','reps','created_at'],
  },
  {
    key: 'bodyRecords',
    table: 'member_body_records',
    orderBy: 'id',
    columns: ['id','member_id','measured_date','weight','skeletal_muscle','body_fat','body_fat_percentage','bmi','visceral_fat_level','created_at','updated_at'],
  },
  {
    key: 'manualSignatures',
    table: 'member_manual_signatures',
    orderBy: 'id',
    columns: ['id','member_id','date','signature_json','session_note','signed_at','created_at'],
  },
  {
    key: 'programDefinitions',
    table: 'program_definitions',
    orderBy: 'id',
    columns: ['id','category','name','tracking_mode','duration_months','session_count','sort_order','is_active','created_at','updated_at'],
  },
  {
    key: 'memberPrograms',
    table: 'member_programs',
    orderBy: 'id',
    columns: ['id','member_id','program_id','program_name','category','tracking_mode','start_date','end_date','total_sessions','remaining_sessions','is_active','created_at','updated_at'],
  },
  {
    key: 'postureAssessments',
    table: 'posture_assessments',
    orderBy: 'id',
    columns: ['id','member_id','assessed_date','front_photo_uri','side_photo_uri','back_photo_uri','front_notes','side_notes','back_notes','coach_feedback','created_at','updated_at'],
  },
  {
    key: 'exerciseDefinitions',
    table: 'exercise_definitions',
    orderBy: 'id',
    columns: ['id','category','name','sort_order','is_active','created_at','updated_at'],
  },
] as const;

type SnapshotKey = (typeof tableSpecs)[number]['key'];

function stableHash(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function ensureLocalTables(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS exercise_definitions (
      id TEXT PRIMARY KEY NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

async function readMeta(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ? LIMIT 1',
    [key],
  );
  return row?.value ?? '';
}

async function writeMeta(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    `INSERT INTO app_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

async function buildLocalSnapshot(db: SQLiteDatabase): Promise<SnapshotPayload> {
  await ensureLocalTables(db);

  const payload: SnapshotPayload = {
    version: 1,
    members: [],
    schedules: [],
    trainingLogs: [],
    trainingExercises: [],
    trainingSets: [],
    bodyRecords: [],
    manualSignatures: [],
    programDefinitions: [],
    memberPrograms: [],
    postureAssessments: [],
    exerciseDefinitions: [],
    appSettings: [],
  };

  for (const spec of tableSpecs) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT ${spec.columns.join(', ')} FROM ${spec.table} ORDER BY ${spec.orderBy}`,
    );
    (payload[spec.key] as Record<string, unknown>[]) = rows;
  }

  payload.appSettings = await db.getAllAsync<Record<string, unknown>>(
    `SELECT key, value
     FROM app_settings
     WHERE key NOT IN (
       'app_session',
       'pending_auth_flow',
       'trainer_cloud_owner_id'
     )
       AND key NOT LIKE 'trainer_cloud_synced_at:%'
       AND key NOT LIKE 'trainer_cloud_payload_hash:%'
     ORDER BY key`,
  );

  return payload;
}

async function restoreLocalSnapshot(db: SQLiteDatabase, payload: SnapshotPayload) {
  await ensureLocalTables(db);

  await db.withExclusiveTransactionAsync(async (txn) => {
    const deleteOrder = [
      'member_training_sets',
      'member_training_exercises',
      'member_training_logs',
      'member_body_records',
      'member_manual_signatures',
      'member_programs',
      'posture_assessments',
      'schedules',
      'members',
      'program_definitions',
      'exercise_definitions',
    ];
    for (const table of deleteOrder) {
      await txn.execAsync(`DELETE FROM ${table};`);
    }

    for (const spec of tableSpecs) {
      const rows = (payload[spec.key as SnapshotKey] ?? []) as Record<string, unknown>[];
      for (const row of rows) {
        const values = spec.columns.map((column) => row[column] ?? null);
        const placeholders = spec.columns.map(() => '?').join(', ');
        await txn.runAsync(
          `INSERT INTO ${spec.table} (${spec.columns.join(', ')}) VALUES (${placeholders})`,
          values as (string | number | null)[],
        );
      }
    }

    for (const setting of payload.appSettings ?? []) {
      const key = typeof setting.key === 'string' ? setting.key : '';
      const value = typeof setting.value === 'string' ? setting.value : '';
      if (!key) continue;
      await txn.runAsync(
        `INSERT INTO app_settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value],
      );
    }
  });
}

async function fetchRemoteSnapshot(accessToken: string, trainerId: string) {
  const response = await fetch(
    SUPABASE_URL +
      '/rest/v1/trainer_data_snapshots?auth_user_id=eq.' +
      encodeURIComponent(trainerId) +
      '&select=auth_user_id,payload,updated_at&limit=1',
    { headers: supabaseHeaders(accessToken) },
  );
  if (!response.ok) throw new Error('클라우드 데이터를 불러오지 못했어요.');
  const rows = (await response.json()) as RemoteSnapshotRow[];
  return rows[0] ?? null;
}

async function saveRemoteSnapshot(
  accessToken: string,
  trainerId: string,
  payload: SnapshotPayload,
) {
  const updatedAt = new Date().toISOString();
  const response = await fetch(
    SUPABASE_URL + '/rest/v1/trainer_data_snapshots?on_conflict=auth_user_id',
    {
      method: 'POST',
      headers: {
        ...supabaseHeaders(accessToken),
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        auth_user_id: trainerId,
        payload,
        updated_at: updatedAt,
      }),
    },
  );
  if (!response.ok) throw new Error('클라우드 데이터를 저장하지 못했어요.');
  const rows = (await response.json()) as RemoteSnapshotRow[];
  return rows[0] ?? { auth_user_id: trainerId, payload, updated_at: updatedAt };
}

function rowUpdatedAt(row: Record<string, unknown>) {
  const value = row.updated_at ?? row.created_at ?? row.signed_at ?? '';
  return typeof value === 'string' ? value : '';
}

function mergeRows(
  localRows: Record<string, unknown>[],
  remoteRows: Record<string, unknown>[],
) {
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of remoteRows) {
    const id = String(row.id ?? '');
    if (id) byId.set(id, row);
  }
  for (const row of localRows) {
    const id = String(row.id ?? '');
    if (!id) continue;
    const current = byId.get(id);
    if (!current || rowUpdatedAt(row) >= rowUpdatedAt(current)) {
      byId.set(id, row);
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    String(a.id ?? '').localeCompare(String(b.id ?? '')),
  );
}

function mergeSnapshots(local: SnapshotPayload, remote: SnapshotPayload): SnapshotPayload {
  const merged: SnapshotPayload = {
    version: 1,
    members: [],
    schedules: [],
    trainingLogs: [],
    trainingExercises: [],
    trainingSets: [],
    bodyRecords: [],
    manualSignatures: [],
    programDefinitions: [],
    memberPrograms: [],
    postureAssessments: [],
    exerciseDefinitions: [],
    appSettings: [],
  };

  for (const spec of tableSpecs) {
    (merged[spec.key] as Record<string, unknown>[]) = mergeRows(
      (local[spec.key] ?? []) as Record<string, unknown>[],
      (remote[spec.key] ?? []) as Record<string, unknown>[],
    );
  }

  const settings = new Map<string, Record<string, unknown>>();
  for (const row of remote.appSettings ?? []) {
    if (typeof row.key === 'string') settings.set(row.key, row);
  }
  for (const row of local.appSettings ?? []) {
    if (typeof row.key === 'string') settings.set(row.key, row);
  }
  merged.appSettings = Array.from(settings.values()).sort((a, b) =>
    String(a.key ?? '').localeCompare(String(b.key ?? '')),
  );

  return merged;
}

async function syncTrainerSelfChecks(
  db: SQLiteDatabase,
  accessToken: string,
) {
  const response = await fetch(
    SUPABASE_URL +
      '/rest/v1/member_self_checks?select=member_id,date,activity_level,cardio_treadmill,cardio_bike,cardio_stepmill,updated_at&order=updated_at.asc',
    { headers: supabaseHeaders(accessToken) },
  );
  if (!response.ok) return;
  const rows = (await response.json()) as Array<{
    member_id: string;
    date: string;
    activity_level: string | null;
    cardio_treadmill: string | null;
    cardio_bike: string | null;
    cardio_stepmill: string | null;
    updated_at: string;
  }>;

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const row of rows) {
      const member = await txn.getFirstAsync<{ id: string }>(
        'SELECT id FROM members WHERE id = ? LIMIT 1',
        [row.member_id],
      );
      if (!member) continue;
      await txn.runAsync(
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
          row.member_id,
          row.date,
          row.activity_level,
          row.cardio_treadmill,
          row.cardio_bike,
          row.cardio_stepmill,
          row.updated_at,
        ],
      );
    }
  });
}

export async function syncTrainerCloud(
  db: SQLiteDatabase,
  accessToken: string,
  trainerId: string,
) {
  if (!accessToken || !trainerId) return { changed: false, direction: 'none' as const };

  let local = await buildLocalSnapshot(db);
  let localHash = stableHash(local);
  const lastHash = await readMeta(db, metaHash(trainerId));
  const lastRemoteUpdatedAt = await readMeta(db, metaUpdatedAt(trainerId));
  const currentOwner = await readMeta(db, META_OWNER);
  const remote = await fetchRemoteSnapshot(accessToken, trainerId);

  if (currentOwner && currentOwner !== trainerId && !remote) {
    const empty: SnapshotPayload = {
      version: 1,
      members: [],
      schedules: [],
      trainingLogs: [],
      trainingExercises: [],
      trainingSets: [],
      bodyRecords: [],
      manualSignatures: [],
      programDefinitions: [],
      memberPrograms: [],
      postureAssessments: [],
      exerciseDefinitions: [],
      appSettings: [],
    };
    await restoreLocalSnapshot(db, empty);
    local = await buildLocalSnapshot(db);
    localHash = stableHash(local);
  }

  if (!remote) {
    const saved = await saveRemoteSnapshot(accessToken, trainerId, local);
    await writeMeta(db, metaHash(trainerId), localHash);
    await writeMeta(db, metaUpdatedAt(trainerId), saved.updated_at);
    await writeMeta(db, META_OWNER, trainerId);
    await syncTrainerSelfChecks(db, accessToken);
    return { changed: true, direction: 'upload' as const };
  }

  const remotePayload = remote.payload && remote.payload.version === 1
    ? remote.payload
    : ({ ...local, ...remote.payload, version: 1 } as SnapshotPayload);
  const remoteHash = stableHash(remotePayload);

  if (!lastHash && !lastRemoteUpdatedAt) {
    await restoreLocalSnapshot(db, remotePayload);
    await writeMeta(db, metaHash(trainerId), remoteHash);
    await writeMeta(db, metaUpdatedAt(trainerId), remote.updated_at);
    await writeMeta(db, META_OWNER, trainerId);
    await syncTrainerSelfChecks(db, accessToken);
    return { changed: true, direction: 'download' as const };
  }

  const localChanged = localHash !== lastHash;
  const remoteChanged = remote.updated_at !== lastRemoteUpdatedAt;

  if (localChanged && !remoteChanged) {
    const saved = await saveRemoteSnapshot(accessToken, trainerId, local);
    await writeMeta(db, metaHash(trainerId), localHash);
    await writeMeta(db, metaUpdatedAt(trainerId), saved.updated_at);
    await syncTrainerSelfChecks(db, accessToken);
    return { changed: true, direction: 'upload' as const };
  }

  if (!localChanged && remoteChanged) {
    await restoreLocalSnapshot(db, remotePayload);
    await writeMeta(db, metaHash(trainerId), remoteHash);
    await writeMeta(db, metaUpdatedAt(trainerId), remote.updated_at);
    await syncTrainerSelfChecks(db, accessToken);
    return { changed: true, direction: 'download' as const };
  }

  if (localChanged && remoteChanged) {
    const merged = mergeSnapshots(local, remotePayload);
    await restoreLocalSnapshot(db, merged);
    const saved = await saveRemoteSnapshot(accessToken, trainerId, merged);
    const mergedHash = stableHash(merged);
    await writeMeta(db, metaHash(trainerId), mergedHash);
    await writeMeta(db, metaUpdatedAt(trainerId), saved.updated_at);
    await writeMeta(db, META_OWNER, trainerId);
    await syncTrainerSelfChecks(db, accessToken);
    return { changed: true, direction: 'merge' as const };
  }

  await writeMeta(db, META_OWNER, trainerId);
  await syncTrainerSelfChecks(db, accessToken);
  return { changed: false, direction: 'none' as const };
}
