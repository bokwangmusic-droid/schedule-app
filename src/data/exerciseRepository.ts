import type { SQLiteDatabase } from 'expo-sqlite';

export const EXERCISE_CATEGORIES = ['가슴', '등', '어깨', '팔', '하체'] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];
export type ExerciseDefinition = { id: string; category: ExerciseCategory; name: string; sortOrder: number };

export async function ensureExerciseDefinitions(db: SQLiteDatabase) {
  await db.execAsync('CREATE TABLE IF NOT EXISTS exercise_definitions (id TEXT PRIMARY KEY NOT NULL, category TEXT NOT NULL, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
}
export async function listExerciseDefinitions(db: SQLiteDatabase) {
  await ensureExerciseDefinitions(db);
  const rows=await db.getAllAsync<{id:string;category:ExerciseCategory;name:string;sort_order:number}>('SELECT id, category, name, sort_order FROM exercise_definitions WHERE is_active = 1 ORDER BY category, sort_order, name');
  return rows.map(r=>({id:r.id,category:r.category,name:r.name,sortOrder:r.sort_order}));
}
export async function addExerciseDefinition(db: SQLiteDatabase, category: ExerciseCategory, name: string) {
  await ensureExerciseDefinitions(db); const clean=name.trim(); if(!clean)return;
  const now=new Date().toISOString(); const key=now+'-'+Math.random().toString(36).slice(2,8);
  const row=await db.getFirstAsync<{n:number}>('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM exercise_definitions WHERE category = ? AND is_active = 1',[category]);
  await db.runAsync('INSERT INTO exercise_definitions (id,category,name,sort_order,is_active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)',[key,category,clean,row?.n??0,now,now]);
}
export async function deleteExerciseDefinition(db: SQLiteDatabase, id: string) {
  await ensureExerciseDefinitions(db); await db.runAsync('UPDATE exercise_definitions SET is_active = 0, updated_at = ? WHERE id = ?',[new Date().toISOString(),id]);
}
