import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'schedule.db';

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      memo TEXT,
      color TEXT,
      is_all_day INTEGER NOT NULL DEFAULT 0,
      is_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_date
      ON schedules(date);

    CREATE INDEX IF NOT EXISTS idx_schedules_date_start_time
      ON schedules(date, start_time);
  `);

  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(schedules)');
  if (!columns.some((column) => column.name === 'color')) {
    await db.execAsync('ALTER TABLE schedules ADD COLUMN color TEXT;');
  }
}
