import { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';

type Props = {
  left: number;
  width: number;
  height: number;
  startHour: number;
  endHour: number;
  hourHeight: number;
  disabled?: boolean;
  onRangeSelected: (startTime: string, endTime: string) => void;
  onWeekSwipe: (direction: 'previous' | 'next') => void;
};

const HORIZONTAL_SWIPE_DISTANCE = 58;
const VERTICAL_DRAG_DISTANCE = 10;
const SNAP_MINUTES = 60;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function minutesToTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function ScheduleRangeSelector({
  left,
  width,
  height,
  startHour,
  endHour,
  hourHeight,
  disabled = false,
  onRangeSelected,
  onWeekSwipe,
}: Props) {
  const [preview, setPreview] = useState<{ top: number; height: number } | null>(null);
  const startLocalYRef = useRef(0);

  const totalMinutes = (endHour - startHour) * 60;
  const pixelsPerMinute = hourHeight / 60;

  const localYToMinutes = (y: number) => {
    const raw = clamp(y / pixelsPerMinute, 0, totalMinutes);
    return clamp(Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES, 0, totalMinutes);
  };

  const getRange = (currentLocalY: number) => {
    const start = localYToMinutes(startLocalYRef.current);
    const current = localYToMinutes(currentLocalY);
    const from = Math.min(start, current);
    let to = Math.max(start, current);

    if (to === from) {
      to = Math.min(totalMinutes, from + SNAP_MINUTES);
    }

    if (to <= from && from >= SNAP_MINUTES) {
      return { from: from - SNAP_MINUTES, to: from };
    }

    return { from, to };
  };

  const updatePreview = (currentLocalY: number) => {
    const { from, to } = getRange(currentLocalY);
    setPreview({
      top: from * pixelsPerMinute,
      height: Math.max((to - from) * pixelsPerMinute, hourHeight),
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: (_, gesture) =>
          !disabled && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
        onPanResponderGrant: (event) => {
          startLocalYRef.current = event.nativeEvent.locationY;
          setPreview(null);
        },
        onPanResponderMove: (_, gesture) => {
          if (Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25) {
            setPreview(null);
            return;
          }

          if (Math.abs(gesture.dy) >= VERTICAL_DRAG_DISTANCE) {
            updatePreview(startLocalYRef.current + gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          setPreview(null);

          if (
            Math.abs(gesture.dx) >= HORIZONTAL_SWIPE_DISTANCE &&
            Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25
          ) {
            onWeekSwipe(gesture.dx < 0 ? 'next' : 'previous');
            return;
          }

          const { from, to } = getRange(startLocalYRef.current + gesture.dy);
          if (to <= from) return;

          onRangeSelected(
            minutesToTime(startHour * 60 + from),
            minutesToTime(startHour * 60 + to),
          );
        },
        onPanResponderTerminate: () => {
          setPreview(null);
        },
      }),
    [disabled, endHour, hourHeight, onRangeSelected, onWeekSwipe, startHour, totalMinutes],
  );

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.touchLayer,
        {
          left,
          width,
          height,
        },
      ]}
    >
      {preview ? (
        <View
          pointerEvents="none"
          style={[
            styles.preview,
            {
              top: preview.top,
              height: preview.height,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  touchLayer: {
    position: 'absolute',
    top: 0,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  preview: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderWidth: 1.5,
    borderColor: '#4B68FF',
    borderRadius: 6,
    backgroundColor: 'rgba(75,104,255,0.18)',
  },
});
