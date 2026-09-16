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

  const localYToMinutes = (y: number, snapMinutes: number) => {
    const raw = clamp(y / pixelsPerMinute, 0, totalMinutes);
    return clamp(Math.round(raw / snapMinutes) * snapMinutes, 0, totalMinutes);
  };

  const updatePreview = (currentLocalY: number) => {
    const start = localYToMinutes(startLocalYRef.current, 30);
    const current = localYToMinutes(currentLocalY, 30);
    const from = Math.min(start, current);
    let to = Math.max(start, current);
    if (to === from) to = Math.min(totalMinutes, from + 30);

    setPreview({
      top: from * pixelsPerMinute,
      height: Math.max((to - from) * pixelsPerMinute, hourHeight / 2),
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

          if (Math.abs(gesture.dy) >= VERTICAL_DRAG_DISTANCE) {
            const start = localYToMinutes(startLocalYRef.current, 30);
            const current = localYToMinutes(startLocalYRef.current + gesture.dy, 30);
            const from = Math.min(start, current);
            let to = Math.max(start, current);
            if (to === from) to = Math.min(totalMinutes, from + 30);
            if (to <= from) return;

            onRangeSelected(
              minutesToTime(startHour * 60 + from),
              minutesToTime(startHour * 60 + to),
            );
            return;
          }

          const tappedMinutes = localYToMinutes(startLocalYRef.current, 60);
          const startMinutes = Math.min(tappedMinutes, Math.max(0, totalMinutes - 60));
          onRangeSelected(
            minutesToTime(startHour * 60 + startMinutes),
            minutesToTime(startHour * 60 + Math.min(totalMinutes, startMinutes + 60)),
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
