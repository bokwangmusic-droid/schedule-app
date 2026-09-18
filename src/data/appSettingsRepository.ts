import type { SQLiteDatabase } from 'expo-sqlite';

export type TimetableSettings = {
  hourHeight: number;
  showPtRemaining: boolean;
  overlapView: boolean;
  widgetPrivacyMode: boolean;
};

export const DEFAULT_TIMETABLE_SETTINGS: TimetableSettings = {
  hourHeight: 30,
  showPtRemaining: true,
  overlapView: false,
  widgetPrivacyMode: false,
};

const KEYS = {
  hourHeight: 'timetable.hourHeight',
  showPtRemaining: 'timetable.showPtRemaining',
  overlapView: 'timetable.overlapView',
  widgetPrivacyMode: 'widget.privacyMode',
} as const;

async function readValue(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ? LIMIT 1',
    [key],
  );
  return row?.value ?? null;
}

async function writeValue(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    `INSERT INTO app_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function getTimetableSettings(db: SQLiteDatabase): Promise<TimetableSettings> {
  const [hourHeightValue, showPtRemainingValue, overlapViewValue, widgetPrivacyModeValue] = await Promise.all([
    readValue(db, KEYS.hourHeight),
    readValue(db, KEYS.showPtRemaining),
    readValue(db, KEYS.overlapView),
    readValue(db, KEYS.widgetPrivacyMode),
  ]);

  const parsedHourHeight = Number(hourHeightValue);
  const hourHeight = [26, 30, 36].includes(parsedHourHeight)
    ? parsedHourHeight
    : DEFAULT_TIMETABLE_SETTINGS.hourHeight;

  return {
    hourHeight,
    showPtRemaining:
      showPtRemainingValue === null
        ? DEFAULT_TIMETABLE_SETTINGS.showPtRemaining
        : showPtRemainingValue === '1',
    overlapView:
      overlapViewValue === null
        ? DEFAULT_TIMETABLE_SETTINGS.overlapView
        : overlapViewValue === '1',
    widgetPrivacyMode:
      widgetPrivacyModeValue === null
        ? DEFAULT_TIMETABLE_SETTINGS.widgetPrivacyMode
        : widgetPrivacyModeValue === '1',
  };
}

export async function saveHourHeight(db: SQLiteDatabase, hourHeight: number) {
  await writeValue(db, KEYS.hourHeight, String(hourHeight));
}

export async function saveShowPtRemaining(db: SQLiteDatabase, value: boolean) {
  await writeValue(db, KEYS.showPtRemaining, value ? '1' : '0');
}

export async function saveOverlapView(db: SQLiteDatabase, value: boolean) {
  await writeValue(db, KEYS.overlapView, value ? '1' : '0');
}

export async function saveWidgetPrivacyMode(db: SQLiteDatabase, value: boolean) {
  await writeValue(db, KEYS.widgetPrivacyMode, value ? '1' : '0');
}
