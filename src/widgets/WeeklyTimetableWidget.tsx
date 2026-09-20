'use no memo';

import React from 'react';
import {
  FlexWidget,
  OverlapWidget,
  TextWidget,
} from 'react-native-android-widget';
import type { ScheduleItem } from '../types/schedule';
import type { WeeklyWidgetData } from './widgetData';
import {
  scheduleColor,
  scheduleLabel,
  timeToMinutes,
} from './widgetScheduleUtils';

export type WeeklyTimetableVariant = 'compact' | 'large';

type Props = {
  data: WeeklyWidgetData;
  widgetHeight: number;
  widgetWidth: number;
  variant?: WeeklyTimetableVariant;
};

const START_MINUTES = 6 * 60;
const END_MINUTES = 24 * 60;
const TOTAL_MINUTES = END_MINUTES - START_MINUTES;
const COMPACT_TIME_LABELS = [6, 9, 12, 15, 18, 21];
const LARGE_TIME_LABELS = Array.from({ length: 18 }, (_, index) => index + 6);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBodyHeight(
  variant: WeeklyTimetableVariant,
  widgetHeight: number,
) {
  if (variant === 'large') {
    // Leave room for the daily encouragement row while keeping the widget
    // within the launcher's allocated height.
    return clamp(Math.max(widgetHeight - 84, 380), 380, 660);
  }

  return clamp(Math.max(widgetHeight - 54, 220), 220, 360);
}

function DayBody({
  schedules,
  height,
  isToday,
  variant,
}: {
  schedules: ScheduleItem[];
  height: number;
  isToday: boolean;
  variant: WeeklyTimetableVariant;
}) {
  const timedSchedules = schedules.filter(
    (schedule) => !schedule.isAllDay && schedule.startTime && schedule.endTime,
  );
  const allDaySchedules = schedules.filter((schedule) => schedule.isAllDay);
  const gridHours =
    variant === 'large' ? LARGE_TIME_LABELS : COMPACT_TIME_LABELS;

  return (
    <OverlapWidget
      style={{
        width: 'match_parent',
        height,
        overflow: 'hidden',
        backgroundColor: isToday ? '#F5F7FF' : '#FFFFFF',
      }}
    >
      {gridHours.map((hour) => {
        const top = ((hour * 60 - START_MINUTES) / TOTAL_MINUTES) * height;
        return (
          <FlexWidget
            key={`line-${hour}`}
            style={{
              width: 'match_parent',
              height: 1,
              marginTop: top,
              backgroundColor:
                variant === 'large' ? '#ECEEF2' : '#E5E7EB',
            }}
          />
        );
      })}

      {allDaySchedules.slice(0, 1).map((schedule) => (
        <FlexWidget
          key={`all-${schedule.id}`}
          style={{
            height: variant === 'large' ? 16 : 12,
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
            style={{
              fontSize: variant === 'large' ? 7 : 6,
              fontWeight: '700',
              color: '#FFFFFF',
            }}
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
        const blockHeight = Math.max(
          rawHeight,
          variant === 'large' ? 17 : 11,
        );
        const ptRemaining =
          schedule.memberPtProjectedRemainingSessions ??
          schedule.memberPtRemainingSessions;
        const showPtRemaining =
          variant === 'large' &&
          schedule.memberId !== null &&
          ptRemaining !== null &&
          blockHeight >= 25;

        return (
          <FlexWidget
            key={schedule.id}
            style={{
              height: blockHeight,
              marginTop: top,
              marginLeft: 1,
              marginRight: 1,
              borderRadius: variant === 'large' ? 4 : 3,
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
                fontSize:
                  variant === 'large'
                    ? blockHeight >= 23
                      ? 9
                      : 8
                    : blockHeight >= 18
                      ? 7
                      : 6,
                fontWeight: '700',
                color: '#FFFFFF',
              }}
            />
            {showPtRemaining ? (
              <TextWidget
                text={`잔여 ${ptRemaining}회`}
                maxLines={1}
                allowFontScaling={false}
                style={{
                  marginTop: 1,
                  fontSize: 6,
                  fontWeight: '600',
                  color: '#FFFFFF',
                }}
              />
            ) : null}
          </FlexWidget>
        );
      })}
    </OverlapWidget>
  );
}

export function WeeklyTimetableWidget({
  data,
  widgetHeight,
  widgetWidth,
  variant = 'large',
}: Props) {
  const large = variant === 'large';
  const bodyHeight = getBodyHeight(variant, widgetHeight);
  const timeLabels = large ? LARGE_TIME_LABELS : COMPACT_TIME_LABELS;
  const titleHeight = large ? 26 : 24;
  const encouragementHeight = large ? 20 : 0;
  const dayHeaderHeight = large ? 26 : 22;
  const gutterWidth = large ? 27 : 24;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={
        large ? '큰 주간 시간표 위젯' : '주간 시간표 중간 위젯'
      }
      style={{
        width: 'match_parent',
        height: 'match_parent',
        padding: large ? 6 : 7,
        overflow: 'hidden',
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        flexDirection: 'column',
      }}
    >
      <FlexWidget
        style={{
          height: titleHeight,
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TextWidget
          text={large ? '주간 시간표' : '이번 주'}
          allowFontScaling={false}
          style={{
            fontSize: large ? 12 : 11,
            fontWeight: '700',
            color: '#1F232A',
          }}
        />
        <TextWidget
          text={data.weekLabel}
          allowFontScaling={false}
          style={{
            fontSize: large ? 9 : 8,
            color: '#747B86',
          }}
        />
      </FlexWidget>

      {large ? (
        <FlexWidget
          style={{
            width: 'match_parent',
            height: encouragementHeight,
            paddingLeft: 8,
            paddingRight: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            backgroundColor: '#F4F6FF',
          }}
        >
          <TextWidget
            text={data.encouragement}
            maxLines={1}
            truncate="END"
            allowFontScaling={false}
            style={{
              width: 'match_parent',
              fontSize: 8,
              fontWeight: '600',
              color: '#5968A8',
              textAlign: 'center',
            }}
          />
        </FlexWidget>
      ) : null}

      <FlexWidget
        style={{
          width: 'match_parent',
          height: dayHeaderHeight,
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <FlexWidget
          style={{ width: gutterWidth, height: dayHeaderHeight }}
        />
        {data.days.map((day) => {
          const today = day.date === data.today;
          return (
            <FlexWidget
              key={`header-${day.date}`}
              style={{
                flex: 1,
                height: dayHeaderHeight,
                alignItems: 'center',
                justifyContent: 'center',
                borderLeftWidth: 1,
                borderLeftColor: '#ECEEF2',
                backgroundColor: today ? '#EEF1FF' : '#FFFFFF',
              }}
            >
              <TextWidget
                text={
                  large
                    ? `${day.dayName} ${day.dateNumber}`
                    : day.dayName
                }
                maxLines={1}
                allowFontScaling={false}
                style={{
                  fontSize: large ? 8 : 8,
                  fontWeight: today ? '700' : '500',
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
        <OverlapWidget
          style={{
            width: gutterWidth,
            height: bodyHeight,
            overflow: 'hidden',
            backgroundColor: '#FAFBFC',
          }}
        >
          {timeLabels.map((hour) => {
            const top = ((hour * 60 - START_MINUTES) / TOTAL_MINUTES) * bodyHeight;
            return (
              <TextWidget
                key={`time-${hour}`}
                text={String(hour)}
                allowFontScaling={false}
                style={{
                  width: gutterWidth - 2,
                  height: 12,
                  marginTop: Math.max(0, top - 5),
                  fontSize: large ? 7 : 7,
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
              variant={variant}
            />
          </FlexWidget>
        ))}
      </FlexWidget>

      {large && widgetWidth < 300 ? (
        <TextWidget
          text="위젯을 가로로 조금 넓히면 일정 이름이 더 잘 보여요."
          maxLines={1}
          allowFontScaling={false}
          style={{
            height: 14,
            fontSize: 6,
            color: '#9AA0AA',
            textAlign: 'center',
          }}
        />
      ) : null}
    </FlexWidget>
  );
}
