'use no memo';

import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { TodayScheduleWidget } from './TodayScheduleWidget';
import { WeeklyTimetableWidget } from './WeeklyTimetableWidget';
import { loadWeeklyWidgetData } from './widgetData';

function renderScheduleWidget(
  widgetName: string,
  data: Awaited<ReturnType<typeof loadWeeklyWidgetData>>,
  width: number,
  height: number,
) {
  switch (widgetName) {
    case 'TodaySchedule':
      return <TodayScheduleWidget data={data} widgetHeight={height} />;

    case 'WeeklyTimetableCompact':
      return (
        <WeeklyTimetableWidget
          data={data}
          widgetWidth={width}
          widgetHeight={height}
          variant="compact"
        />
      );

    case 'WeeklyTimetable':
      return (
        <WeeklyTimetableWidget
          data={data}
          widgetWidth={width}
          widgetHeight={height}
          variant="large"
        />
      );

    default:
      return null;
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await loadWeeklyWidgetData();
      const widget = renderScheduleWidget(
        props.widgetInfo.widgetName,
        data,
        props.widgetInfo.width,
        props.widgetInfo.height,
      );

      if (widget) {
        props.renderWidget(widget);
      }
      break;
    }

    case 'WIDGET_DELETED':
    case 'WIDGET_CLICK':
    default:
      break;
  }
}
