export type WellnessLevel = '상' | '중' | '하';

export type TrainingSetInput = {
  weight: number | null;
  reps: number | null;
};

export type TrainingExerciseInput = {
  name: string;
  sets: TrainingSetInput[];
};

export type CreateTrainingLogInput = {
  memberId: string;
  scheduleId?: string | null;
  date: string;
  bodyPart?: string | null;
  sleepQuality?: WellnessLevel | null;
  conditionLevel?: WellnessLevel | null;
  activityLevel?: WellnessLevel | null;
  dietControl?: boolean;
  hydration?: boolean;
  cardioTreadmill?: string | null;
  cardioBike?: string | null;
  cardioStepmill?: string | null;
  breakfastCarbs?: string | null;
  breakfastProtein?: string | null;
  breakfastFat?: string | null;
  lunchCarbs?: string | null;
  lunchProtein?: string | null;
  lunchFat?: string | null;
  dinnerCarbs?: string | null;
  dinnerProtein?: string | null;
  dinnerFat?: string | null;
  snack?: string | null;
  summary?: string | null;
  feedback?: string | null;
  exercises?: TrainingExerciseInput[];
};

export type TrainingSetItem = {
  id: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
};

export type TrainingExerciseItem = {
  id: string;
  order: number;
  name: string;
  sets: TrainingSetItem[];
};

export type TrainingLogItem = {
  id: string;
  memberId: string;
  scheduleId: string | null;
  date: string;
  bodyPart: string | null;
  sleepQuality: WellnessLevel | null;
  conditionLevel: WellnessLevel | null;
  activityLevel: WellnessLevel | null;
  dietControl: boolean;
  hydration: boolean;
  cardioTreadmill: string | null;
  cardioBike: string | null;
  cardioStepmill: string | null;
  breakfastCarbs: string | null;
  breakfastProtein: string | null;
  breakfastFat: string | null;
  lunchCarbs: string | null;
  lunchProtein: string | null;
  lunchFat: string | null;
  dinnerCarbs: string | null;
  dinnerProtein: string | null;
  dinnerFat: string | null;
  snack: string | null;
  summary: string | null;
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
  exercises: TrainingExerciseItem[];
};

export type CreateBodyRecordInput = {
  memberId: string;
  measuredDate: string;
  weight?: number | null;
  skeletalMuscle?: number | null;
  bodyFat?: number | null;
  bodyFatPercentage?: number | null;
};

export type BodyRecordItem = {
  id: string;
  memberId: string;
  measuredDate: string;
  weight: number | null;
  skeletalMuscle: number | null;
  bodyFat: number | null;
  bodyFatPercentage: number | null;
  createdAt: string;
  updatedAt: string;
};
