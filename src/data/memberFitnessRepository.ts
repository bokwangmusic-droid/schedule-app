import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  BodyRecordItem,
  CreateBodyRecordInput,
  CreateTrainingLogInput,
  TrainingExerciseItem,
  TrainingLogItem,
  TrainingSetItem,
  WellnessLevel,
} from '../types/memberFitness';

type TrainingLogRow = {
  id: string;
  member_id: string;
  schedule_id: string | null;
  date: string;
  body_part: string | null;
  sleep_quality: WellnessLevel | null;
  condition_level: WellnessLevel | null;
  activity_level: WellnessLevel | null;
  diet_control: number;
  hydration: number;
  cardio_treadmill: string | null;
  cardio_bike: string | null;
  cardio_stepmill: string | null;
  breakfast_carbs: string | null;
  breakfast_protein: string | null;
  breakfast_fat: string | null;
  lunch_carbs: string | null;
  lunch_protein: string | null;
  lunch_fat: string | null;
  dinner_carbs: string | null;
  dinner_protein: string | null;
  dinner_fat: string | null;
  snack: string | null;
  summary: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
};

type ExerciseRow = {
  id: string;
  log_id: string;
  exercise_order: number;
  name: string;
};

type SetRow = {
  id: string;
  exercise_id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
};

type BodyRow = {
  id: string;
  member_id: string;
  measured_date: string;
  weight: number | null;
  skeletal_muscle: number | null;
  body_fat: number | null;
  body_fat_percentage: number | null;
  created_at: string;
  updated_at: string;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clean(value?: string | null) {
  return value?.trim() || null;
}

async function loadExercises(
  db: SQLiteDatabase,
  logId: string,
): Promise<TrainingExerciseItem[]> {
  const exercises = await db.getAllAsync<ExerciseRow>(
    `SELECT id, log_id, exercise_order, name
     FROM member_training_exercises
     WHERE log_id = ?
     ORDER BY exercise_order ASC, created_at ASC`,
    [logId],
  );

  const result: TrainingExerciseItem[] = [];
  for (const exercise of exercises) {
    const sets = await db.getAllAsync<SetRow>(
      `SELECT id, exercise_id, set_number, weight, reps
       FROM member_training_sets
       WHERE exercise_id = ?
       ORDER BY set_number ASC`,
      [exercise.id],
    );
    result.push({
      id: exercise.id,
      order: exercise.exercise_order,
      name: exercise.name,
      sets: sets.map(
        (set): TrainingSetItem => ({
          id: set.id,
          setNumber: set.set_number,
          weight: set.weight,
          reps: set.reps,
        }),
      ),
    });
  }
  return result;
}

async function mapTrainingLog(
  db: SQLiteDatabase,
  row: TrainingLogRow,
): Promise<TrainingLogItem> {
  return {
    id: row.id,
    memberId: row.member_id,
    scheduleId: row.schedule_id,
    date: row.date,
    bodyPart: row.body_part,
    sleepQuality: row.sleep_quality,
    conditionLevel: row.condition_level,
    activityLevel: row.activity_level,
    dietControl: row.diet_control === 1,
    hydration: row.hydration === 1,
    cardioTreadmill: row.cardio_treadmill,
    cardioBike: row.cardio_bike,
    cardioStepmill: row.cardio_stepmill,
    breakfastCarbs: row.breakfast_carbs,
    breakfastProtein: row.breakfast_protein,
    breakfastFat: row.breakfast_fat,
    lunchCarbs: row.lunch_carbs,
    lunchProtein: row.lunch_protein,
    lunchFat: row.lunch_fat,
    dinnerCarbs: row.dinner_carbs,
    dinnerProtein: row.dinner_protein,
    dinnerFat: row.dinner_fat,
    snack: row.snack,
    summary: row.summary,
    feedback: row.feedback,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    exercises: await loadExercises(db, row.id),
  };
}

export async function createTrainingLog(
  db: SQLiteDatabase,
  input: CreateTrainingLogInput,
) {
  if (input.scheduleId) {
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM member_training_logs WHERE schedule_id = ? LIMIT 1',
      [input.scheduleId],
    );
    if (existing) throw new Error('TRAINING_LOG_ALREADY_EXISTS');
  }

  const now = new Date().toISOString();
  const logId = createId();

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO member_training_logs (
        id, member_id, schedule_id, date, body_part,
        sleep_quality, condition_level, activity_level,
        diet_control, hydration,
        cardio_treadmill, cardio_bike, cardio_stepmill,
        breakfast_carbs, breakfast_protein, breakfast_fat,
        lunch_carbs, lunch_protein, lunch_fat,
        dinner_carbs, dinner_protein, dinner_fat,
        snack, summary, feedback, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        input.memberId,
        input.scheduleId ?? null,
        input.date,
        clean(input.bodyPart),
        input.sleepQuality ?? null,
        input.conditionLevel ?? null,
        input.activityLevel ?? null,
        input.dietControl ? 1 : 0,
        input.hydration ? 1 : 0,
        clean(input.cardioTreadmill),
        clean(input.cardioBike),
        clean(input.cardioStepmill),
        clean(input.breakfastCarbs),
        clean(input.breakfastProtein),
        clean(input.breakfastFat),
        clean(input.lunchCarbs),
        clean(input.lunchProtein),
        clean(input.lunchFat),
        clean(input.dinnerCarbs),
        clean(input.dinnerProtein),
        clean(input.dinnerFat),
        clean(input.snack),
        clean(input.summary),
        clean(input.feedback),
        now,
        now,
      ],
    );

    const exercises = (input.exercises ?? []).filter((item) => item.name.trim());
    for (let exerciseIndex = 0; exerciseIndex < exercises.length; exerciseIndex += 1) {
      const exercise = exercises[exerciseIndex];
      const exerciseId = createId();
      await txn.runAsync(
        `INSERT INTO member_training_exercises (
          id, log_id, exercise_order, name, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [exerciseId, logId, exerciseIndex, exercise.name.trim(), now],
      );

      for (let setIndex = 0; setIndex < exercise.sets.length; setIndex += 1) {
        const set = exercise.sets[setIndex];
        if (set.weight === null && set.reps === null) continue;
        await txn.runAsync(
          `INSERT INTO member_training_sets (
            id, exercise_id, set_number, weight, reps, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            createId(),
            exerciseId,
            setIndex + 1,
            set.weight,
            set.reps,
            now,
          ],
        );
      }
    }
  });

  return logId;
}

export async function listTrainingLogs(
  db: SQLiteDatabase,
  memberId: string,
  limit = 30,
): Promise<TrainingLogItem[]> {
  const rows = await db.getAllAsync<TrainingLogRow>(
    `SELECT *
     FROM member_training_logs
     WHERE member_id = ?
     ORDER BY date DESC, created_at DESC
     LIMIT ?`,
    [memberId, limit],
  );

  const result: TrainingLogItem[] = [];
  for (const row of rows) {
    result.push(await mapTrainingLog(db, row));
  }
  return result;
}

export async function getTrainingLogForSchedule(
  db: SQLiteDatabase,
  scheduleId: string,
): Promise<TrainingLogItem | null> {
  const row = await db.getFirstAsync<TrainingLogRow>(
    `SELECT *
     FROM member_training_logs
     WHERE schedule_id = ?
     LIMIT 1`,
    [scheduleId],
  );
  return row ? mapTrainingLog(db, row) : null;
}

export async function createBodyRecord(
  db: SQLiteDatabase,
  input: CreateBodyRecordInput,
) {
  const now = new Date().toISOString();
  const id = createId();
  await db.runAsync(
    `INSERT INTO member_body_records (
      id, member_id, measured_date, weight, skeletal_muscle,
      body_fat, body_fat_percentage, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.memberId,
      input.measuredDate,
      input.weight ?? null,
      input.skeletalMuscle ?? null,
      input.bodyFat ?? null,
      input.bodyFatPercentage ?? null,
      now,
      now,
    ],
  );
  return id;
}

export async function listBodyRecords(
  db: SQLiteDatabase,
  memberId: string,
  limit = 30,
): Promise<BodyRecordItem[]> {
  const rows = await db.getAllAsync<BodyRow>(
    `SELECT *
     FROM member_body_records
     WHERE member_id = ?
     ORDER BY measured_date DESC, created_at DESC
     LIMIT ?`,
    [memberId, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    memberId: row.member_id,
    measuredDate: row.measured_date,
    weight: row.weight,
    skeletalMuscle: row.skeletal_muscle,
    bodyFat: row.body_fat,
    bodyFatPercentage: row.body_fat_percentage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
