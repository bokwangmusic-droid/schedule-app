import type { ScheduleItem } from '../types/schedule';

const FALLBACK_COLORS = [
  '#5B8DEF',
  '#91D948',
  '#FF4E7D',
  '#9C6ADE',
  '#FF9F43',
  '#37B8A5',
] as const;

export function timeToMinutes(value: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

export function scheduleColor(schedule: ScheduleItem): `#${string}` {
  if (schedule.color && /^#[0-9A-Fa-f]{6}$/.test(schedule.color)) {
    return schedule.color as `#${string}`;
  }

  let hash = 0;
  for (let index = 0; index < schedule.title.length; index += 1) {
    hash = (hash * 31 + schedule.title.charCodeAt(index)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

export function scheduleLabel(schedule: ScheduleItem) {
  return schedule.memberName ?? schedule.title;
}

export function sortSchedulesForWidget(schedules: ScheduleItem[]) {
  return [...schedules].sort((left, right) => {
    if (left.isAllDay !== right.isAllDay) {
      return left.isAllDay ? -1 : 1;
    }

    const leftTime = left.startTime ?? '99:99';
    const rightTime = right.startTime ?? '99:99';
    return leftTime.localeCompare(rightTime);
  });
}
