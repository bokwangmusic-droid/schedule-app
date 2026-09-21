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
const NOW_COLOR = '#FF4D5A';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBodyHeight(
  variant: WeeklyTimetableVariant,
  widgetHeight: number,
  widgetWidth: number,
) {
  if (variant === 'large') {
    // Some Samsung launchers report widget dimensions smaller than the
    // visually allocated area. The large widget should still fill the page,
    // so use a generous minimum instead of leaving a large blank lower half.
    const minimum = widgetWidth < 300 ? 580 : 540;
    const maximum = widgetWidth >= 560 ? 1400 : 850;
    return clamp(Math.max(widgetHeight - 78, minimum), minimum, maximum);
  }

  const maximum = widgetWidth >= 560 ? 760 : 420;
  return clamp(Math.max(widgetHeight - 54, 230), 230, maximum);
}

function ScheduleLayer({
  schedules,
  height,
  width,
  variant,
  isToday,
  currentMinutes,
}: {
  schedules: ScheduleItem[];
  height: number;
  width: number;
  variant: WeeklyTimetableVariant;
  isToday: boolean;
  currentMinutes: number;
}) {
  const timedSchedules = schedules.filter(
    (schedule) => !schedule.isAllDay && schedule.startTime && schedule.endTime,
  );
  const allDaySchedules = schedules.filter((schedule) => schedule.isAllDay);

  return (
    <OverlapWidget
      style={{
        width,
        height,
        overflow: 'hidden',
      }}
    >
      {allDaySchedules.slice(0, 1).map((schedule) => (
        <FlexWidget
          key={`all-${schedule.id}`}
          style={{
            width: Math.max(width - 4, 20),
            height: variant === 'large' ? 16 : 12,
            marginTop: 2,
            marginLeft: 2,
            marginRight: 2,
            borderRadius: 4,
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
          variant === 'large' ? 20 : 12,
        );
        const ptRemaining =
          schedule.memberPtProjectedRemainingSessions ??
          schedule.memberPtRemainingSessions;
        const hasPtRemaining =
          schedule.memberId !== null &&
          ptRemaining !== null;
        const narrowColumn = width < 52;
        const showPtRemaining =
          variant === 'large' &&
          hasPtRemaining &&
          blockHeight >= 26;
        const primaryLabel = scheduleLabel(schedule);
        const ptRemainingLabel =
          narrowColumn ? `${ptRemaining}회` : `PT 잔여 ${ptRemaining}회`;

        return (
          <FlexWidget
            key={schedule.id}
            style={{
              width: Math.max(width - 4, 20),
              height: blockHeight,
              marginTop: top,
              marginLeft: 2,
              marginRight: 2,
              borderRadius: variant === 'large' ? 5 : 4,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: scheduleColor(schedule),
            }}
          >
            <TextWidget
              text={primaryLabel}
              maxLines={1}
              truncate="END"
              allowFontScaling={false}
              style={{
                fontSize:
                  variant === 'large'
                    ? narrowColumn
                      ? 7
                      : blockHeight >= 28
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
                text={ptRemainingLabel}
                maxLines={1}
                allowFontScaling={false}
                style={{
                  marginTop: 1,
                  fontSize: narrowColumn ? 5 : 6,
                  fontWeight: '600',
                  color: '#FFFFFF',
                }}
              />
            ) : null}
          </FlexWidget>
        );
      })}

      {isToday &&
      currentMinutes >= START_MINUTES &&
      currentMinutes < END_MINUTES ? (
        <FlexWidget
          style={{
            width,
            height: 2,
            marginTop:
              ((currentMinutes - START_MINUTES) / TOTAL_MINUTES) * height,
            backgroundColor: NOW_COLOR,
          }}
        />
      ) : null}
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
  const bodyHeight = getBodyHeight(variant, widgetHeight, widgetWidth);
  const timeLabels = large ? LARGE_TIME_LABELS : COMPACT_TIME_LABELS;
  const titleHeight = large ? 28 : 24;
  const encouragementHeight = large ? 22 : 0;
  const dayHeaderHeight = large ? 28 : 22;
  const gutterWidth = large ? 29 : 24;
  const resolvedWidgetWidth = widgetWidth > 0 ? widgetWidth : large ? 360 : 340;
  const wideWidget = resolvedWidgetWidth >= 560;
  const outerPadding = large
    ? wideWidget
      ? 2
      : 6
    : wideWidget
      ? 3
      : 7;
  const innerWidth = Math.max(Math.floor(resolvedWidgetWidth - outerPadding * 2), 280);
  const usableDaysWidth = Math.max(innerWidth - gutterWidth, 196);
  const baseDayWidth = Math.max(Math.floor(usableDaysWidth / 7), 28);
  const leftoverPixels = Math.max(usableDaysWidth - baseDayWidth * 7, 0);
  const dayWidths = Array.from(
    { length: 7 },
    (_, index) => baseDayWidth + (index < leftoverPixels ? 1 : 0),
  );

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={
        large ? '큰 주간 시간표 위젯' : '주간 시간표 중간 위젯'
      }
      style={{
        width: 'match_parent',
        height: 'match_parent',
        padding: outerPadding,
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
          borderBottomColor: '#E6E8EC',
        }}
      >
        <FlexWidget style={{ width: gutterWidth, height: dayHeaderHeight }} />
        {data.days.map((day, index) => {
          const today = day.date === data.today;
          const dayWidth = dayWidths[index] ?? baseDayWidth;
          return (
            <FlexWidget
              key={`header-${day.date}`}
              style={{
                width: dayWidth,
                height: dayHeaderHeight,
                alignItems: 'center',
                justifyContent: 'center',
                borderLeftWidth: 1,
                borderLeftColor: '#F0F1F4',
                backgroundColor: today ? '#F0F3FF' : '#FFFFFF',
              }}
            >
              <TextWidget
                text={day.dayName}
                maxLines={1}
                allowFontScaling={false}
                style={{
                  fontSize: large ? 7 : 8,
                  fontWeight: today ? '700' : '500',
                  color: today ? '#4B68FF' : '#8A9099',
                }}
              />
              {large ? (
                <FlexWidget
                  style={{
                    width: 18,
                    height: 18,
                    marginTop: 1,
                    borderRadius: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: today ? '#4B68FF' : '#FFFFFF',
                  }}
                >
                  <TextWidget
                    text={String(day.dateNumber)}
                    allowFontScaling={false}
                    style={{
                      fontSize: 7,
                      fontWeight: '700',
                      color: today ? '#FFFFFF' : '#646B77',
                    }}
                  />
                </FlexWidget>
              ) : null}
            </FlexWidget>
          );
        })}
      </FlexWidget>

      <OverlapWidget
        style={{
          width: 'match_parent',
          height: bodyHeight,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
        }}
      >
        <FlexWidget
          style={{
            width: 'match_parent',
            height: bodyHeight,
            flexDirection: 'row',
          }}
        >
          <FlexWidget
            style={{
              width: gutterWidth,
              height: bodyHeight,
              backgroundColor: '#FAFBFC',
            }}
          />
          {data.days.map((day, index) => (
            <FlexWidget
              key={`base-${day.date}`}
              style={{
                width: dayWidths[index] ?? baseDayWidth,
                height: bodyHeight,
                borderLeftWidth: 1,
                borderLeftColor: '#F0F1F4',
                backgroundColor:
                  day.date === data.today ? '#F7F8FF' : '#FFFFFF',
              }}
            />
          ))}
        </FlexWidget>

        {timeLabels.map((hour) => {
          const top = ((hour * 60 - START_MINUTES) / TOTAL_MINUTES) * bodyHeight;
          return (
            <FlexWidget
              key={`grid-${hour}`}
              style={{
                width: 'match_parent',
                height: 1,
                marginTop: top,
                backgroundColor: '#ECEEF2',
              }}
            />
          );
        })}

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
                    width: gutterWidth - 3,
                    height: 12,
                    marginTop: Math.max(0, top - 5),
                    fontSize: 7,
                    color: '#8A909A',
                    textAlign: 'right',
                  }}
                />
              );
            })}
          </OverlapWidget>

          {data.days.map((day, index) => {
            const dayWidth = dayWidths[index] ?? baseDayWidth;
            return (
            <FlexWidget
              key={`schedule-${day.date}`}
              style={{
                width: dayWidth,
                height: bodyHeight,
              }}
            >
              <ScheduleLayer
                schedules={day.schedules}
                height={bodyHeight}
                width={dayWidth}
                variant={variant}
                isToday={day.date === data.today}
                currentMinutes={data.currentMinutes}
              />
            </FlexWidget>
            );
          })}
        </FlexWidget>
      </OverlapWidget>
    </FlexWidget>
  );
}
