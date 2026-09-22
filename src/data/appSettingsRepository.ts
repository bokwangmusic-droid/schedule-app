import type { SQLiteDatabase } from 'expo-sqlite';

export type WidgetFontSize = 'normal' | 'large' | 'xlarge';
export type WidgetFontStyle = 'default' | 'strong' | 'condensed';
export type WidgetTextColor = 'white' | 'cream' | 'sky';

export type WidgetStyleSettings = {
  widgetFontSize: WidgetFontSize;
  widgetFontStyle: WidgetFontStyle;
  widgetTextColor: WidgetTextColor;
};

export type TimetableSettings = WidgetStyleSettings & {
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
  widgetFontSize: 'xlarge',
  widgetFontStyle: 'strong',
  widgetTextColor: 'white',
};

const KEYS = {
  hourHeight: 'timetable.hourHeight',
  showPtRemaining: 'timetable.showPtRemaining',
  overlapView: 'timetable.overlapView',
  widgetPrivacyMode: 'widget.privacyMode',
  widgetFontSize: 'widget.fontSize',
  widgetFontStyle: 'widget.fontStyle',
  widgetTextColor: 'widget.textColor',
} as const;

const WIDGET_FONT_SIZES: WidgetFontSize[] = ['normal', 'large', 'xlarge'];
const WIDGET_FONT_STYLES: WidgetFontStyle[] = ['default', 'strong', 'condensed'];
const WIDGET_TEXT_COLORS: WidgetTextColor[] = ['white', 'cream', 'sky'];

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

function validValue<T extends string>(value: string | null, values: T[], fallback: T): T {
  return value !== null && values.includes(value as T) ? (value as T) : fallback;
}

export async function getTimetableSettings(db: SQLiteDatabase): Promise<TimetableSettings> {
  const [
    hourHeightValue,
    showPtRemainingValue,
    overlapViewValue,
    widgetPrivacyModeValue,
    widgetFontSizeValue,
    widgetFontStyleValue,
    widgetTextColorValue,
  ] = await Promise.all([
    readValue(db, KEYS.hourHeight),
    readValue(db, KEYS.showPtRemaining),
    readValue(db, KEYS.overlapView),
    readValue(db, KEYS.widgetPrivacyMode),
    readValue(db, KEYS.widgetFontSize),
    readValue(db, KEYS.widgetFontStyle),
    readValue(db, KEYS.widgetTextColor),
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
    widgetFontSize: validValue(
      widgetFontSizeValue,
      WIDGET_FONT_SIZES,
      DEFAULT_TIMETABLE_SETTINGS.widgetFontSize,
    ),
    widgetFontStyle: validValue(
      widgetFontStyleValue,
      WIDGET_FONT_STYLES,
      DEFAULT_TIMETABLE_SETTINGS.widgetFontStyle,
    ),
    widgetTextColor: validValue(
      widgetTextColorValue,
      WIDGET_TEXT_COLORS,
      DEFAULT_TIMETABLE_SETTINGS.widgetTextColor,
    ),
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

export async function saveWidgetFontSize(db: SQLiteDatabase, value: WidgetFontSize) {
  await writeValue(db, KEYS.widgetFontSize, value);
}

export async function saveWidgetFontStyle(db: SQLiteDatabase, value: WidgetFontStyle) {
  await writeValue(db, KEYS.widgetFontStyle, value);
}

export async function saveWidgetTextColor(db: SQLiteDatabase, value: WidgetTextColor) {
  await writeValue(db, KEYS.widgetTextColor, value);
}
