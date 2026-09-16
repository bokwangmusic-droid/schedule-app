'use no memo';

import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { WeeklyTimetableWidget } from './WeeklyTimetableWidget';
import { loadWeeklyWidgetData } from './widgetData';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== 'WeeklyTimetable') return;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await loadWeeklyWidgetData();
      props.renderWidget(
        <WeeklyTimetableWidget
          data={data}
          widgetHeight={props.widgetInfo.height}
        />,
      );
      break;
    }
    case 'WIDGET_DELETED':
    case 'WIDGET_CLICK':
    default:
      break;
  }
}
