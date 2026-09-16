'use no memo';

import React from 'react';
import {
  requestPinWidget,
  requestWidgetUpdate,
} from 'react-native-android-widget';
import { WeeklyTimetableWidget } from './WeeklyTimetableWidget';
import { loadWeeklyWidgetData } from './widgetData';

export async function refreshWeeklyTimetableWidget() {
  const data = await loadWeeklyWidgetData();

  await requestWidgetUpdate({
    widgetName: 'WeeklyTimetable',
    renderWidget: (widgetInfo) => (
      <WeeklyTimetableWidget
        data={data}
        widgetHeight={widgetInfo.height}
      />
    ),
  });
}

export async function pinWeeklyTimetableWidget() {
  return requestPinWidget({ widgetName: 'WeeklyTimetable' });
}
