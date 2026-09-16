import { openDatabaseAsync } from 'expo-sqlite';
import { listSchedulesForRange } from '../data/scheduleRepository';
import { DATABASE_NAME } from '../db/database';
import { addDays, startOfWeekMonday, toLocalDateString } from '../lib/date';
import type { ScheduleItem } from '../types/schedule';

export type WeeklyWidgetData = {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  today: string;
  days: Array<{
    date: string;
    dayName: string;
    dateNumber: number;
    schedules: ScheduleItem[];
  }>;
};

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

function getWeekLabel(weekStart: Date) {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}–${end.getDate()}일`;
  }
  return `${weekStart.getMonth() + 1}/${weekStart.getDate()}–${end.getMonth() + 1}/${end.getDate()}`;
}

export async function loadWeeklyWidgetData(): Promise<WeeklyWidgetData> {
  const now = new Date();
  const weekStartDate = startOfWeekMonday(now);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index));
  const weekStart = toLocalDateString(weekDates[0]);
  const weekEnd = toLocalDateString(weekDates[6]);
  const today = toLocalDateString(now);

  const db = await openDatabaseAsync(DATABASE_NAME);
  const schedules = await listSchedulesForRange(db, weekStart, weekEnd, today);

  return {
    weekLabel: getWeekLabel(weekStartDate),
    weekStart,
    weekEnd,
    today,
    days: weekDates.map((date, index) => {
      const dateString = toLocalDateString(date);
      return {
        date: dateString,
        dayName: DAY_NAMES[index],
        dateNumber: date.getDate(),
        schedules: schedules.filter((schedule) => schedule.date === dateString),
      };
    }),
  };
}
