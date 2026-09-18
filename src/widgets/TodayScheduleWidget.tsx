'use no memo';

import React from 'react';
import {
  FlexWidget,
  TextWidget,
} from 'react-native-android-widget';
import type { WeeklyWidgetData } from './widgetData';
import {
  scheduleColor,
  scheduleLabel,
  sortSchedulesForWidget,
} from './widgetScheduleUtils';

type Props = {
  data: WeeklyWidgetData;
  widgetHeight: number;
};

function formatTime(startTime: string | null, endTime: string | null, isAllDay: boolean) {
  if (isAllDay) return '종일';
  if (!startTime) return '';
  if (!endTime) return startTime.slice(0, 5);
  return `${startTime.slice(0, 5)}–${endTime.slice(0, 5)}`;
}

export function TodayScheduleWidget({ data, widgetHeight }: Props) {
  const today = data.days.find((day) => day.date === data.today);
  const schedules = sortSchedulesForWidget(today?.schedules ?? []);
  const maxRows = Math.max(2, Math.min(5, Math.floor((widgetHeight - 42) / 30)));
  const visibleSchedules = schedules.slice(0, maxRows);
  const hiddenCount = Math.max(0, schedules.length - visibleSchedules.length);
  const dateLabel = today
    ? `${today.dayName}요일 ${today.dateNumber}일`
    : '오늘';

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="오늘 일정 위젯"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        padding: 8,
        overflow: 'hidden',
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        flexDirection: 'column',
      }}
    >
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 26,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TextWidget
          text="오늘 일정"
          allowFontScaling={false}
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: '#1F232A',
          }}
        />
        <TextWidget
          text={dateLabel}
          allowFontScaling={false}
          style={{
            fontSize: 9,
            color: '#747B86',
          }}
        />
      </FlexWidget>

      {visibleSchedules.length === 0 ? (
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TextWidget
            text="오늘은 등록된 일정이 없어요"
            allowFontScaling={false}
            style={{
              fontSize: 10,
              color: '#8B929C',
            }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            flexDirection: 'column',
            flexGap: 4,
            flexGapColor: '#FFFFFF',
          }}
        >
          {visibleSchedules.map((schedule) => (
            <FlexWidget
              key={schedule.id}
              style={{
                flex: 1,
                width: 'match_parent',
                minHeight: 26,
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 7,
                backgroundColor: '#F7F8FA',
              }}
            >
              <FlexWidget
                style={{
                  width: 5,
                  height: 'match_parent',
                  borderTopLeftRadius: 7,
                  borderBottomLeftRadius: 7,
                  backgroundColor: scheduleColor(schedule),
                }}
              />
              <TextWidget
                text={formatTime(
                  schedule.startTime,
                  schedule.endTime,
                  schedule.isAllDay,
                )}
                maxLines={1}
                allowFontScaling={false}
                style={{
                  width: 72,
                  paddingLeft: 7,
                  paddingRight: 4,
                  fontSize: 8,
                  color: '#747B86',
                }}
              />
              <TextWidget
                text={scheduleLabel(schedule)}
                maxLines={1}
                truncate="END"
                allowFontScaling={false}
                style={{
                  flex: 1,
                  paddingRight: 7,
                  fontSize: 10,
                  fontWeight: '700',
                  color: '#252A31',
                }}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      )}

      {hiddenCount > 0 ? (
        <TextWidget
          text={`외 ${hiddenCount}개 일정`}
          maxLines={1}
          allowFontScaling={false}
          style={{
            height: 16,
            paddingTop: 3,
            fontSize: 7,
            color: '#8B929C',
            textAlign: 'right',
          }}
        />
      ) : null}
    </FlexWidget>
  );
}
