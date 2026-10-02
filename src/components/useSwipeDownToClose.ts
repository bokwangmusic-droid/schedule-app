import { useMemo } from 'react';
import { PanResponder } from 'react-native';

export function useSwipeDownToClose(onClose: () => void, enabled = true) {
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: (_, gesture) =>
          enabled &&
          gesture.dy > 4 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, gesture) => {
          if (!enabled) return;
          if (gesture.dy > 55 || gesture.vy > 0.65) {
            onClose();
          }
        },
      }),
    [enabled, onClose],
  );

  return responder.panHandlers;
}
