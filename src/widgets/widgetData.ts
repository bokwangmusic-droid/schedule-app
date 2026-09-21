import { openDatabaseAsync } from 'expo-sqlite';
import { getTimetableSettings } from '../data/appSettingsRepository';
import { listSchedulesForRange } from '../data/scheduleRepository';
import { DATABASE_NAME, migrateDatabase } from '../db/database';
import { addDays, startOfWeekMonday, toLocalDateString } from '../lib/date';
import type { ScheduleItem } from '../types/schedule';

export type WeeklyWidgetData = {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  today: string;
  currentMinutes: number;
  encouragement: string;
  days: Array<{
    date: string;
    dayName: string;
    dateNumber: number;
    schedules: ScheduleItem[];
  }>;
};

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

const DAILY_ENCOURAGEMENTS = [
  '오늘도 선생님의 에너지가 누군가의 하루를 바꿔요.',
  '한 타임 한 타임, 오늘도 충분히 잘하고 있어요.',
  '회원의 변화만큼 선생님의 컨디션도 중요해요.',
  '수업 사이 잠깐이라도 물 한 잔 챙겨요.',
  '오늘도 좋은 수업보다 오래 가는 페이스가 먼저예요.',
  '선생님의 한마디가 회원에게는 큰 힘이 될 수 있어요.',
  '바쁜 하루여도 내 몸 한 번 챙기는 걸 잊지 마세요.',
  '오늘도 한 분 한 분에게 좋은 에너지를 전해봐요.',
  '완벽한 하루보다 꾸준한 하루면 충분해요.',
  '오늘 일정도 하나씩, 급하지 않게 해내면 돼요.',
  '회원님을 챙기듯 선생님 자신도 꼭 챙겨주세요.',
  '오늘 수업 끝에는 스스로에게도 수고했다고 말해줘요.',
  '힘든 날에도 쌓인 시간은 절대 사라지지 않아요.',
  '오늘도 선생님 덕분에 운동을 이어가는 사람이 있어요.',
];

function maskMemberName(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 1) return '○';
  if (trimmed.length === 2) return `${trimmed[0]}○`;
  return `${trimmed[0]}○${trimmed[trimmed.length - 1]}`;
}

function getDailyEncouragement(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  const dateKey = year * 372 + month * 31 + day;
  return DAILY_ENCOURAGEMENTS[dateKey % DAILY_ENCOURAGEMENTS.length];
}

function getWeekLabel(weekStart: Date) {
  const center = addDays(weekStart, 3);
  const first = new Date(center.getFullYear(), center.getMonth(), 1);
  const mondayBasedOffset = (first.getDay() + 6) % 7;
  const week = Math.ceil((center.getDate() + mondayBasedOffset) / 7);
  return `${center.getMonth() + 1}월 ${week}주차`;
}

export async function loadWeeklyWidgetData(): Promise<WeeklyWidgetData> {
  const now = new Date();
  const weekStartDate = startOfWeekMonday(now);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index));
  const weekStart = toLocalDateString(weekDates[0]);
  const weekEnd = toLocalDateString(weekDates[6]);
  const today = toLocalDateString(now);

  // Widgets run in their own React Native lifecycle. Using Expo SQLite's cached
  // connection here can poison the app's SQLiteProvider connection on Android
  // after a widget/runtime restart. Keep widget reads on an isolated connection
  // and always release it when the render data has been loaded.
  const db = await openDatabaseAsync(DATABASE_NAME, { useNewConnection: true });

  try {
    await migrateDatabase(db);
    const [schedules, settings] = await Promise.all([
      listSchedulesForRange(db, weekStart, weekEnd, today),
      getTimetableSettings(db),
    ]);
    const widgetSchedules = settings.widgetPrivacyMode
      ? schedules.map((schedule) =>
          schedule.memberId
            ? {
                ...schedule,
                memberName: schedule.memberName ? maskMemberName(schedule.memberName) : null,
                title: schedule.memberName ? maskMemberName(schedule.memberName) : schedule.title,
              }
            : schedule,
        )
      : schedules;

    return {
      weekLabel: getWeekLabel(weekStartDate),
      weekStart,
      weekEnd,
      today,
      currentMinutes: now.getHours() * 60 + now.getMinutes(),
      encouragement: getDailyEncouragement(today),
      days: weekDates.map((date, index) => {
        const dateString = toLocalDateString(date);
        return {
          date: dateString,
          dayName: DAY_NAMES[index],
          dateNumber: date.getDate(),
          schedules: widgetSchedules.filter((schedule) => schedule.date === dateString),
        };
      }),
    };
  } finally {
    await db.closeAsync();
  }
}
