import type { SQLiteDatabase } from 'expo-sqlite';

export type ProgramTrackingMode = 'duration' | 'sessions';

export type ProgramDefinition = {
  id: string;
  category: string;
  name: string;
  trackingMode: ProgramTrackingMode;
  durationMonths: number | null;
  sessionCount: number | null;
  sortOrder: number;
};

type ProgramRow = {
  id: string;
  category: string;
  name: string;
  tracking_mode: ProgramTrackingMode;
  duration_months: number | null;
  session_count: number | null;
  sort_order: number;
};

function createId() {
  return `program-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapRow(row: ProgramRow): ProgramDefinition {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    trackingMode: row.tracking_mode,
    durationMonths: row.duration_months,
    sessionCount: row.session_count,
    sortOrder: row.sort_order,
  };
}

export async function ensureDefaultPrograms(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM program_definitions');
  if ((row?.count ?? 0) > 0) return;
  const now = new Date().toISOString();
  const defaults: Array<[string, string, ProgramTrackingMode, number | null, number | null]> = [
    ['헬스', '헬스 1개월', 'duration', 1, null],
    ['헬스', '헬스 3개월', 'duration', 3, null],
    ['헬스', '헬스 6개월', 'duration', 6, null],
    ['헬스', '헬스 12개월', 'duration', 12, null],
    ['PT', 'PT 10회', 'sessions', null, 10],
    ['PT', 'PT 20회', 'sessions', null, 20],
    ['PT', 'PT 30회', 'sessions', null, 30],
  ];
  for (let index = 0; index < defaults.length; index += 1) {
    const [category, name, mode, months, sessions] = defaults[index];
    await db.runAsync(
      `INSERT INTO program_definitions
       (id, category, name, tracking_mode, duration_months, session_count, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [createId(), category, name, mode, months, sessions, index, now, now],
    );
  }
}

export async function listPrograms(db: SQLiteDatabase) {
  await ensureDefaultPrograms(db);
  const rows = await db.getAllAsync<ProgramRow>(
    `SELECT id, category, name, tracking_mode, duration_months, session_count, sort_order
     FROM program_definitions WHERE is_active = 1
     ORDER BY sort_order ASC, created_at ASC`,
  );
  return rows.map(mapRow);
}

export async function createProgram(db: SQLiteDatabase, input: Omit<ProgramDefinition, 'id' | 'sortOrder'>) {
  const now = new Date().toISOString();
  const max = await db.getFirstAsync<{ value: number }>('SELECT COALESCE(MAX(sort_order), -1) AS value FROM program_definitions');
  await db.runAsync(
    `INSERT INTO program_definitions
     (id, category, name, tracking_mode, duration_months, session_count, sort_order, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [createId(), input.category.trim(), input.name.trim(), input.trackingMode, input.durationMonths, input.sessionCount, (max?.value ?? -1) + 1, now, now],
  );
}

export async function deleteProgram(db: SQLiteDatabase, id: string) {
  await db.runAsync('UPDATE program_definitions SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
}

export async function moveProgram(db: SQLiteDatabase, programs: ProgramDefinition[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= programs.length) return;
  const first = programs[index];
  const second = programs[target];
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE program_definitions SET sort_order = ?, updated_at = ? WHERE id = ?', [second.sortOrder, new Date().toISOString(), first.id]);
    await db.runAsync('UPDATE program_definitions SET sort_order = ?, updated_at = ? WHERE id = ?', [first.sortOrder, new Date().toISOString(), second.id]);
  });
}


export type MemberProgram = {
  id: string;
  memberId: string;
  programId: string;
  programName: string;
  category: string;
  trackingMode: ProgramTrackingMode;
  startDate: string | null;
  endDate: string | null;
  totalSessions: number | null;
  remainingSessions: number | null;
};

type MemberProgramRow = {
  id: string;
  member_id: string;
  program_id: string;
  program_name: string;
  category: string;
  tracking_mode: ProgramTrackingMode;
  start_date: string | null;
  end_date: string | null;
  total_sessions: number | null;
  remaining_sessions: number | null;
};

function mapMemberProgram(row: MemberProgramRow): MemberProgram {
  return {
    id: row.id,
    memberId: row.member_id,
    programId: row.program_id,
    programName: row.program_name,
    category: row.category,
    trackingMode: row.tracking_mode,
    startDate: row.start_date,
    endDate: row.end_date,
    totalSessions: row.total_sessions,
    remainingSessions: row.remaining_sessions,
  };
}

function addMonths(dateString: string, months: number) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setMonth(date.getMonth() + months);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function listMemberPrograms(db: SQLiteDatabase, memberId: string) {
  const rows = await db.getAllAsync<MemberProgramRow>(
    `SELECT id, member_id, program_id, program_name, category, tracking_mode,
            start_date, end_date, total_sessions, remaining_sessions
     FROM member_programs
     WHERE member_id = ? AND is_active = 1
     ORDER BY created_at ASC`,
    [memberId],
  );
  return rows.map(mapMemberProgram);
}

export async function enrollMemberProgram(db: SQLiteDatabase, memberId: string, program: ProgramDefinition, startDate: string) {
  const now = new Date().toISOString();
  const endDate = program.trackingMode === 'duration' && program.durationMonths
    ? addMonths(startDate, program.durationMonths)
    : null;
  await db.runAsync(
    `INSERT INTO member_programs
     (id, member_id, program_id, program_name, category, tracking_mode, start_date, end_date,
      total_sessions, remaining_sessions, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      createId(), memberId, program.id, program.name, program.category, program.trackingMode,
      startDate, endDate, program.sessionCount, program.sessionCount, now, now,
    ],
  );
}

export async function removeMemberProgram(db: SQLiteDatabase, id: string) {
  await db.runAsync('UPDATE member_programs SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
}
