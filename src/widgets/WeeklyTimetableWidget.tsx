'use no memo';

import React from 'react';
import {
  FlexWidget,
  OverlapWidget,
  TextWidget,
} from 'react-native-android-widget';
import type { ScheduleItem } from '../types/schedule';
import type { WeeklyWidgetData } from './widgetData';

type Props = {
  data: WeeklyWidgetData;
  widgetHeight: number;
};

const START_MINUTES = 6 * 60;
const END_MINUTES = 24 * 60;
const TOTAL_MINUTES = END_MINUTES - START_MINUTES;
const TIME_LABELS = [6, 9, 12, 15, 18, 21];
const FALLBACK_COLORS = ['#5B8DEF', '#91D948', '#FF4E7D', '#9C6ADE', '#FF9F43', '#37B8A5'] as const;

function timeToMinutes(value: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function scheduleColor(schedule: ScheduleItem): `#${string}` {
  if (schedule.color && /^#[0-9A-Fa-f]{6}$/.test(schedule.color)) {
    return schedule.color as `#${string}`;
  }

  let hash = 0;
  for (let index = 0; index < schedule.title.length; index += 1) {
    hash = (hash * 31 + schedule.title.charCodeAt(index)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function scheduleLabel(schedule: ScheduleItem) {
  return schedule.memberName ?? schedule.title;
}

function DayBody({
  schedules,
  height,
  isToday,
}: {
  schedules: ScheduleItem[];
  height: number;
  isToday: boolean;
}) {
  const timedSchedules = schedules.filter(
    (schedule) => !schedule.isAllDay && schedule.startTime && schedule.endTime,
  );
  const allDaySchedules = schedules.filter((schedule) => schedule.isAllDay);

  return (
    <OverlapWidget
      style={{
        width: 'match_parent',
        height,
        backgroundColor: isToday ? '#F5F7FF' : '#FFFFFF',
      }}
    >
      {TIME_LABELS.map((hour) => {
        const top = ((hour * 60 - START_MINUTES) / TOTAL_MINUTES) * height;
        return (
          <FlexWidget
            key={`line-${hour}`}
            style={{
              width: 'match_parent',
              height: 1,
              marginTop: top,
              backgroundColor: '#E5E7EB',
            }}
          />
        );
      })}

      {allDaySchedules.slice(0, 1).map((schedule) => (
        <FlexWidget
          key={`all-${schedule.id}`}
          style={{
            height: 12,
            marginTop: 2,
            marginLeft: 1,
            marginRight: 1,
            borderRadius: 3,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: scheduleColor(schedule),
          }}
        >
          <TextWidget
            text={scheduleLabel(schedule)}
            maxLines={1}
            truncate="END"
            allowFontScaling={false}
            style={{ fontSize: 6, color: '#FFFFFF' }}
          />
        </FlexWidget>
      ))}

      {timedSchedules.map((schedule) => {
        const start = timeToMinutes(schedule.startTime);
        const end = timeToMinutes(schedule.endTime);
        if (start === null || end === null) return null;
        if (end <= START_MINUTES || start >= END_MINUTES) return null;

        const visibleStart = Math.max(start, START_MINUTES);
        const visibleEnd = Math.min(end, END_MINUTES);
        const top = ((visibleStart - START_MINUTES) / TOTAL_MINUTES) * height;
        const rawHeight = ((visibleEnd - visibleStart) / TOTAL_MINUTES) * height;
        const blockHeight = Math.max(rawHeight, 11);

        return (
          <FlexWidget
            key={schedule.id}
            style={{
              height: blockHeight,
              marginTop: top,
              marginLeft: 1,
              marginRight: 1,
              borderRadius: 3,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: scheduleColor(schedule),
            }}
          >
            <TextWidget
              text={scheduleLabel(schedule)}
              maxLines={1}
              truncate="END"
              allowFontScaling={false}
              style={{
                fontSize: blockHeight >= 18 ? 7 : 6,
                color: '#FFFFFF',
              }}
            />
          </FlexWidget>
        );
      })}
    </OverlapWidget>
  );
}

export function WeeklyTimetableWidget({ data, widgetHeight }: Props) {
  const bodyHeight = Math.max(160, Math.min(520, widgetHeight - 66));

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="이번 주 시간표 위젯"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        padding: 8,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        flexDirection: 'column',
      }}
    >
      <FlexWidget
        style={{
          height: 28,
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TextWidget
          text="주간 시간표"
          allowFontScaling={false}
          style={{ fontSize: 12, color: '#1F232A' }}
        />
        <TextWidget
          text={data.weekLabel}
          allowFontScaling={false}
          style={{ fontSize: 9, color: '#747B86' }}
        />
      </FlexWidget>

      <FlexWidget
        style={{
          width: 'match_parent',
          height: 24,
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <FlexWidget style={{ width: 24, height: 24 }} />
        {data.days.map((day) => {
          const today = day.date === data.today;
          return (
            <FlexWidget
              key={`header-${day.date}`}
              style={{
                flex: 1,
                height: 24,
                alignItems: 'center',
                justifyContent: 'center',
                borderLeftWidth: 1,
                borderLeftColor: '#ECEEF2',
                backgroundColor: today ? '#EEF1FF' : '#FFFFFF',
              }}
            >
              <TextWidget
                text={`${day.dayName} ${day.dateNumber}`}
                maxLines={1}
                allowFontScaling={false}
                style={{
                  fontSize: 8,
                  color: today ? '#4B68FF' : '#616874',
                }}
              />
            </FlexWidget>
          );
        })}
      </FlexWidget>

      <FlexWidget
        style={{
          width: 'match_parent',
          height: bodyHeight,
          flexDirection: 'row',
        }}
      >
        <OverlapWidget style={{ width: 24, height: bodyHeight, backgroundColor: '#FAFBFC' }}>
          {TIME_LABELS.map((hour) => {
            const top = ((hour * 60 - START_MINUTES) / TOTAL_MINUTES) * bodyHeight;
            return (
              <TextWidget
                key={`time-${hour}`}
                text={String(hour)}
                allowFontScaling={false}
                style={{
                  width: 22,
                  height: 12,
                  marginTop: Math.max(0, top - 5),
                  fontSize: 7,
                  color: '#7A818C',
                  textAlign: 'right',
                }}
              />
            );
          })}
        </OverlapWidget>

        {data.days.map((day) => (
          <FlexWidget
            key={`body-${day.date}`}
            style={{
              flex: 1,
              height: bodyHeight,
              borderLeftWidth: 1,
              borderLeftColor: '#E5E7EB',
            }}
          >
            <DayBody
              schedules={day.schedules}
              height={bodyHeight}
              isToday={day.date === data.today}
            />
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
