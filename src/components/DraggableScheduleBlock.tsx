import { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

type Props = {
  style: StyleProp<ViewStyle>;
  label: string;
  metaLabel?: string | null;
  showMeta?: boolean;
  dayWidth: number;
  hourHeight: number;
  disabled?: boolean;
  deleteDropY?: number;
  onPress: () => void;
  onMove: (dayDelta: number, minuteDelta: number) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onDragStateChange?: (dragging: boolean) => void;
  onDragMoveY?: (pageY: number) => void;
};

const LONG_PRESS_MS = 320;

export function DraggableScheduleBlock({
  style,
  label,
  metaLabel,
  showMeta = false,
  dayWidth,
  hourHeight,
  disabled = false,
  deleteDropY,
  onPress,
  onMove,
  onDelete,
  onDragStateChange,
  onDragMoveY,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPressTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetDrag = () => {
    clearLongPressTimer();
    const wasDragging = draggingRef.current;
    draggingRef.current = false;
    setDragging(false);
    setOffset({ x: 0, y: 0 });
    if (wasDragging) onDragStateChange?.(false);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => false,
        onPanResponderGrant: () => {
          clearLongPressTimer();
          timerRef.current = setTimeout(() => {
            draggingRef.current = true;
            setDragging(true);
            onDragStateChange?.(true);
          }, LONG_PRESS_MS);
        },
        onPanResponderMove: (_, gesture) => {
          if (!draggingRef.current) return;
          setOffset({ x: gesture.dx, y: gesture.dy });
          onDragMoveY?.(gesture.moveY);
        },
        onPanResponderRelease: (_, gesture) => {
          clearLongPressTimer();

          if (!draggingRef.current) {
            resetDrag();
            if (Math.abs(gesture.dx) < 8 && Math.abs(gesture.dy) < 8) {
              onPress();
            }
            return;
          }

          const shouldDelete =
            deleteDropY !== undefined &&
            onDelete !== undefined &&
            gesture.moveY >= deleteDropY;

          if (shouldDelete) {
            resetDrag();
            void onDelete();
            return;
          }

          const dayDelta = Math.round(gesture.dx / dayWidth);
          const halfHourHeight = hourHeight / 2;
          const halfHourDelta = Math.round(gesture.dy / halfHourHeight);
          const minuteDelta = halfHourDelta * 30;

          resetDrag();
          if (dayDelta !== 0 || minuteDelta !== 0) {
            void onMove(dayDelta, minuteDelta);
          }
        },
        onPanResponderTerminate: resetDrag,
      }),
    [
      dayWidth,
      deleteDropY,
      disabled,
      hourHeight,
      onDelete,
      onDragMoveY,
      onDragStateChange,
      onMove,
      onPress,
    ],
  );

  return (
    <View
      {...panResponder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={`${label} 일정`}
      style={[
        styles.block,
        style,
        {
          transform: [
            { translateX: offset.x },
            { translateY: offset.y },
            { scale: dragging ? 1.04 : 1 },
          ],
        },
        dragging && styles.dragging,
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
        style={styles.title}
      >
        {label}
      </Text>
      {showMeta && metaLabel ? (
        <Text numberOfLines={1} style={styles.meta}>{metaLabel}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    zIndex: 5,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragging: {
    zIndex: 20,
    elevation: 9,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  meta: {
    marginTop: 1,
    fontSize: 7,
    lineHeight: 8,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
  },
});
