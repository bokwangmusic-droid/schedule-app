'use no memo';

import React from 'react';
import {
  requestPinWidget,
  requestWidgetUpdate,
} from 'react-native-android-widget';
import { TodayScheduleWidget } from './TodayScheduleWidget';
import { WeeklyTimetableWidget } from './WeeklyTimetableWidget';
import { loadWeeklyWidgetData } from './widgetData';

export async function refreshWeeklyTimetableWidget() {
  const data = await loadWeeklyWidgetData();

  await Promise.all([
    requestWidgetUpdate({
      widgetName: 'WeeklyTimetable',
      renderWidget: (widgetInfo) => (
        <WeeklyTimetableWidget
          data={data}
          widgetWidth={widgetInfo.width}
          widgetHeight={widgetInfo.height}
          variant="large"
        />
      ),
    }),
    requestWidgetUpdate({
      widgetName: 'WeeklyTimetableCompact',
      renderWidget: (widgetInfo) => (
        <WeeklyTimetableWidget
          data={data}
          widgetWidth={widgetInfo.width}
          widgetHeight={widgetInfo.height}
          variant="compact"
        />
      ),
    }),
    requestWidgetUpdate({
      widgetName: 'TodaySchedule',
      renderWidget: (widgetInfo) => (
        <TodayScheduleWidget
          data={data}
          widgetHeight={widgetInfo.height}
        />
      ),
    }),
  ]);
}

export async function pinWeeklyTimetableWidget() {
  return requestPinWidget({ widgetName: 'WeeklyTimetable' });
}

export async function pinWeeklyTimetableCompactWidget() {
  return requestPinWidget({ widgetName: 'WeeklyTimetableCompact' });
}

export async function pinTodayScheduleWidget() {
  return requestPinWidget({ widgetName: 'TodaySchedule' });
}
