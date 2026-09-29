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
const NOW_COLOR = '#F06A73';

const WIDGET_TEXT_COLORS = {
  white: '#FFFFFF',
  cream: '#FFF1B8',
  sky: '#DDF4FF',
} as const;

type WidgetScheduleTextColor =
  (typeof WIDGET_TEXT_COLORS)[keyof typeof WIDGET_TEXT_COLORS];

function getWidgetTypography(data: WeeklyWidgetData) {
  const scale =
    data.widgetStyle.fontSize === 'xlarge'
      ? 1.34
      : data.widgetStyle.fontSize === 'large'
        ? 1.17
        : 1;
  const fontFamily =
    data.widgetStyle.fontStyle === 'condensed' ? 'sans-serif-condensed' : undefined;
  const strong = data.widgetStyle.fontStyle === 'strong';
  return {
    scale,
    fontFamily,
    strong,
    scheduleTextColor: WIDGET_TEXT_COLORS[data.widgetStyle.textColor],
  };
}

function scaled(value: number, scale: number) {
  return Math.round(value * scale * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fittedScheduleFontSize(
  label: string,
  availableWidth: number,
  preferredSize: number,
) {
  const compactLabel = label.replace(/\s/g, '');
  const characterCount = Math.max(compactLabel.length, 1);
  const horizontalPadding = 6;
  const usableWidth = Math.max(availableWidth - horizontalPadding, 8);

  // Korean names are often 3–5 characters. Prefer shrinking the text over
  // showing an ellipsis when the day column is narrow.
  const estimatedFit = usableWidth / (characterCount * 0.92);
  return Math.round(clamp(Math.min(preferredSize, estimatedFit), 5.2, preferredSize) * 10) / 10;
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
  fontScale,
  fontFamily,
  strongFont,
  scheduleTextColor,
}: {
  schedules: ScheduleItem[];
  height: number;
  width: number;
  variant: WeeklyTimetableVariant;
  isToday: boolean;
  currentMinutes: number;
  fontScale: number;
  fontFamily?: string;
  strongFont: boolean;
  scheduleTextColor: WidgetScheduleTextColor;
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
              fontSize: scaled(variant === 'large' ? 9 : 8, fontScale),
              fontWeight: strongFont ? '900' : '700',
              color: scheduleTextColor,
              ...(fontFamily ? { fontFamily } : {}),
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
          variant === 'large' ? 18 : 11,
        );
        const ptRemaining =
          schedule.memberPtProjectedRemainingSessions ??
          schedule.memberPtRemainingSessions;
        const hasPtRemaining =
          schedule.memberId !== null &&
          ptRemaining !== null;
        const narrowColumn = width < 52;
        const showPtRemaining = false;
        const primaryLabel = scheduleLabel(schedule);
        const preferredPrimaryFontSize = scaled(
          variant === 'large'
            ? narrowColumn
              ? 9
              : blockHeight >= 26
                ? 10
                : 9
            : blockHeight >= 18
              ? 8
              : 7,
          fontScale,
        );
        const primaryFontSize = fittedScheduleFontSize(
          primaryLabel,
          Math.max(width - 4, 20),
          primaryLabel.replace(/\s/g, '').length >= 4
            ? Math.max(preferredPrimaryFontSize - 0.8, 5.5)
            : preferredPrimaryFontSize,
        );
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
              borderRadius: variant === 'large' ? 3 : 3,
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
                fontSize: primaryFontSize,
                fontWeight: strongFont ? '900' : '700',
                color: scheduleTextColor,
                ...(fontFamily ? { fontFamily } : {}),
              }}
            />
            {showPtRemaining ? (
              <TextWidget
                text={ptRemainingLabel}
                maxLines={1}
                allowFontScaling={false}
                style={{
                  marginTop: 1,
                  fontSize: scaled(narrowColumn ? 8 : 8.5, fontScale),
                  fontWeight: strongFont ? '800' : '600',
                  color: scheduleTextColor,
                  ...(fontFamily ? { fontFamily } : {}),
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
  const typography = getWidgetTypography(data);
  const bodyHeight = getBodyHeight(variant, widgetHeight, widgetWidth);
  const timeLabels = large ? LARGE_TIME_LABELS : COMPACT_TIME_LABELS;
  const dayHeaderHeight = large ? 22 : 21;
  const gutterWidth = large ? 28 : 25;
  const resolvedWidgetWidth = widgetWidth > 0 ? widgetWidth : large ? 360 : 340;
  const wideWidget = resolvedWidgetWidth >= 560;
  const outerPadding = large
    ? wideWidget
      ? 1
      : 3
    : wideWidget
      ? 2
      : 4;
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
                backgroundColor: '#FFFFFF',
              }}
            >
              <TextWidget
                text={day.dayName}
                maxLines={1}
                allowFontScaling={false}
                style={{
                  fontSize: scaled(large ? 9.2 : 8.5, typography.scale),
                  fontWeight: typography.strong ? '900' : '700',
                  color: '#646B77',
                  ...(typography.fontFamily ? { fontFamily: typography.fontFamily } : {}),
                }}
              />
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
                backgroundColor: '#FFFFFF',
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
                    height: 14,
                    marginTop: Math.max(0, top - 6),
                    fontSize: scaled(8.5, typography.scale),
                    color: '#717884',
                    textAlign: 'right',
                    ...(typography.fontFamily ? { fontFamily: typography.fontFamily } : {}),
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
                fontScale={typography.scale}
                fontFamily={typography.fontFamily}
                strongFont={typography.strong}
                scheduleTextColor={typography.scheduleTextColor}
              />
            </FlexWidget>
            );
          })}
        </FlexWidget>

        {data.currentMinutes >= START_MINUTES &&
        data.currentMinutes < END_MINUTES ? (
          <FlexWidget
            style={{
              width: usableDaysWidth,
              height: 1.5,
              marginLeft: gutterWidth,
              marginTop:
                ((data.currentMinutes - START_MINUTES) / TOTAL_MINUTES) * bodyHeight,
              backgroundColor: NOW_COLOR,
            }}
          />
        ) : null}
      </OverlapWidget>
    </FlexWidget>
  );
}
