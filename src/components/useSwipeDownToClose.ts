import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

export function useSwipeDownToClose(
  onClose: () => void,
  enabled = true,
  visible = true,
) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [translateY, visible]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: (_, gesture) =>
          enabled &&
          gesture.dy > 2 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gesture) => {
          if (!enabled) return;
          translateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (!enabled) return;

          const shouldClose = gesture.dy > 110 || (gesture.dy > 45 && gesture.vy > 1.15);
          if (shouldClose) {
            Animated.timing(translateY, {
              toValue: 700,
              duration: 180,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) onClose();
            });
            return;
          }

          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            stiffness: 260,
            mass: 0.8,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            stiffness: 260,
            mass: 0.8,
            useNativeDriver: true,
          }).start();
        },
      }),
    [enabled, onClose, translateY],
  );

  return {
    panHandlers: responder.panHandlers,
    animatedStyle: { transform: [{ translateY }] },
  };
}
