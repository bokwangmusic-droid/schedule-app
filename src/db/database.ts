import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'schedule.db';

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      membership_start_date TEXT,
      membership_end_date TEXT,
      pt_total_sessions INTEGER,
      pt_remaining_sessions INTEGER,
      memo TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      memo TEXT,
      color TEXT,
      member_id TEXT,
      is_all_day INTEGER NOT NULL DEFAULT 0,
      is_completed INTEGER NOT NULL DEFAULT 0,
      attendance_status TEXT,
      session_note TEXT,
      signature_json TEXT,
      signed_at TEXT,
      pt_consumed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );


    CREATE TABLE IF NOT EXISTS member_training_logs (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL,
      schedule_id TEXT,
      date TEXT NOT NULL,
      body_part TEXT,
      sleep_quality TEXT,
      condition_level TEXT,
      activity_level TEXT,
      diet_control INTEGER NOT NULL DEFAULT 0,
      hydration INTEGER NOT NULL DEFAULT 0,
      cardio_treadmill TEXT,
      cardio_bike TEXT,
      cardio_stepmill TEXT,
      breakfast_carbs TEXT,
      breakfast_protein TEXT,
      breakfast_fat TEXT,
      lunch_carbs TEXT,
      lunch_protein TEXT,
      lunch_fat TEXT,
      dinner_carbs TEXT,
      dinner_protein TEXT,
      dinner_fat TEXT,
      snack TEXT,
      summary TEXT,
      feedback TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS member_training_exercises (
      id TEXT PRIMARY KEY NOT NULL,
      log_id TEXT NOT NULL,
      exercise_order INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS member_training_sets (
      id TEXT PRIMARY KEY NOT NULL,
      exercise_id TEXT NOT NULL,
      set_number INTEGER NOT NULL,
      weight REAL,
      reps INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS member_body_records (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL,
      measured_date TEXT NOT NULL,
      weight REAL,
      skeletal_muscle REAL,
      body_fat REAL,
      body_fat_percentage REAL,
      bmi REAL,
      visceral_fat_level INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS member_manual_signatures (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL,
      date TEXT NOT NULL,
      signature_json TEXT NOT NULL,
      session_note TEXT,
      signed_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_manual_signatures_member_date
      ON member_manual_signatures(member_id, date, signed_at);

    CREATE TABLE IF NOT EXISTS member_training_log_drafts (
      draft_key TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_training_log_drafts_member
      ON member_training_log_drafts(member_id, updated_at);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS program_definitions (
      id TEXT PRIMARY KEY NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      tracking_mode TEXT NOT NULL,
      duration_months INTEGER,
      session_count INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_program_definitions_sort
      ON program_definitions(is_active, category, sort_order);

    CREATE TABLE IF NOT EXISTS member_programs (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL,
      program_id TEXT NOT NULL,
      program_name TEXT NOT NULL,
      category TEXT NOT NULL,
      tracking_mode TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      total_sessions INTEGER,
      remaining_sessions INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_member_programs_member
      ON member_programs(member_id, is_active, created_at);

    CREATE INDEX IF NOT EXISTS idx_schedules_date
      ON schedules(date);

    CREATE INDEX IF NOT EXISTS idx_schedules_date_start_time
      ON schedules(date, start_time);

    CREATE INDEX IF NOT EXISTS idx_members_name
      ON members(name);

    CREATE INDEX IF NOT EXISTS idx_training_logs_member_date
      ON member_training_logs(member_id, date);

    CREATE INDEX IF NOT EXISTS idx_training_logs_schedule
      ON member_training_logs(schedule_id);

    CREATE INDEX IF NOT EXISTS idx_training_exercises_log
      ON member_training_exercises(log_id, exercise_order);

    CREATE INDEX IF NOT EXISTS idx_training_sets_exercise
      ON member_training_sets(exercise_id, set_number);

    CREATE INDEX IF NOT EXISTS idx_body_records_member_date
      ON member_body_records(member_id, measured_date);
  `);

  const scheduleColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(schedules)');
  if (!scheduleColumns.some((column) => column.name === 'color')) {
    await db.execAsync('ALTER TABLE schedules ADD COLUMN color TEXT;');
  }
  if (!scheduleColumns.some((column) => column.name === 'member_id')) {
    await db.execAsync('ALTER TABLE schedules ADD COLUMN member_id TEXT;');
  }
  if (!scheduleColumns.some((column) => column.name === 'attendance_status')) {
    await db.execAsync('ALTER TABLE schedules ADD COLUMN attendance_status TEXT;');
  }
  if (!scheduleColumns.some((column) => column.name === 'session_note')) {
    await db.execAsync('ALTER TABLE schedules ADD COLUMN session_note TEXT;');
  }
  if (!scheduleColumns.some((column) => column.name === 'signature_json')) {
    await db.execAsync('ALTER TABLE schedules ADD COLUMN signature_json TEXT;');
  }
  if (!scheduleColumns.some((column) => column.name === 'signed_at')) {
    await db.execAsync('ALTER TABLE schedules ADD COLUMN signed_at TEXT;');
  }
  if (!scheduleColumns.some((column) => column.name === 'pt_consumed')) {
    await db.execAsync('ALTER TABLE schedules ADD COLUMN pt_consumed INTEGER NOT NULL DEFAULT 0;');
  }

  const bodyRecordColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(member_body_records)');
  if (!bodyRecordColumns.some((column) => column.name === 'bmi')) {
    await db.execAsync('ALTER TABLE member_body_records ADD COLUMN bmi REAL;');
  }
  if (!bodyRecordColumns.some((column) => column.name === 'visceral_fat_level')) {
    await db.execAsync('ALTER TABLE member_body_records ADD COLUMN visceral_fat_level INTEGER;');
  }

  const memberColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(members)');
  if (!memberColumns.some((column) => column.name === 'membership_start_date')) {
    await db.execAsync('ALTER TABLE members ADD COLUMN membership_start_date TEXT;');
  }
  if (!memberColumns.some((column) => column.name === 'membership_end_date')) {
    await db.execAsync('ALTER TABLE members ADD COLUMN membership_end_date TEXT;');
  }
  if (!memberColumns.some((column) => column.name === 'pt_total_sessions')) {
    await db.execAsync('ALTER TABLE members ADD COLUMN pt_total_sessions INTEGER;');
  }
  if (!memberColumns.some((column) => column.name === 'pt_remaining_sessions')) {
    await db.execAsync('ALTER TABLE members ADD COLUMN pt_remaining_sessions INTEGER;');
  }

  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_schedules_member_id ON schedules(member_id);');
}
