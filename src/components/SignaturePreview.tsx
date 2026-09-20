import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type SignaturePoint = {
  x: number;
  y: number;
  stroke: number;
};

type SignaturePayload = {
  version?: number;
  signedBy?: string;
  points?: SignaturePoint[];
};

type Props = {
  signatureJson: string;
  height?: number;
};

export function SignaturePreview({ signatureJson, height = 110 }: Props) {
  const [width, setWidth] = useState(0);

  const points = useMemo(() => {
    try {
      const parsed = JSON.parse(signatureJson) as SignaturePayload;
      if (!Array.isArray(parsed.points)) return [];
      return parsed.points.filter(
        (point) =>
          Number.isFinite(point.x) &&
          Number.isFinite(point.y) &&
          Number.isFinite(point.stroke),
      );
    } catch {
      return [];
    }
  }, [signatureJson]);

  const segments = useMemo(() => {
    if (points.length < 2 || width <= 0) return [];

    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const sourceWidth = Math.max(maxX - minX, 1);
    const sourceHeight = Math.max(maxY - minY, 1);
    const padding = 10;
    const scale = Math.min(
      (width - padding * 2) / sourceWidth,
      (height - padding * 2) / sourceHeight,
    );

    const normalized = points.map((point) => ({
      ...point,
      x: padding + (point.x - minX) * scale,
      y: padding + (point.y - minY) * scale,
    }));

    return normalized.flatMap((point, index) => {
      if (index === 0) return [];
      const previous = normalized[index - 1];
      if (previous.stroke !== point.stroke) return [];

      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 0.5) return [];

      return [{
        key: `${point.stroke}-${index}`,
        left: (previous.x + point.x) / 2 - length / 2,
        top: (previous.y + point.y) / 2 - 1.6,
        width: length,
        angle: Math.atan2(dy, dx),
      }];
    });
  }, [height, points, width]);

  return (
    <View
      style={[styles.wrap, { height }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {points.length === 0 ? (
        <Text style={styles.emptyText}>서명 데이터를 표시할 수 없어요.</Text>
      ) : null}
      {segments.map((segment) => (
        <View
          key={segment.key}
          pointerEvents="none"
          style={[
            styles.segment,
            {
              left: segment.left,
              top: segment.top,
              width: segment.width,
              transform: [{ rotate: `${segment.angle}rad` }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E4E9',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFBFC',
  },
  segment: {
    position: 'absolute',
    height: 3.2,
    borderRadius: 1.6,
    backgroundColor: '#252B34',
  },
  emptyText: {
    fontSize: 11,
    color: '#9AA0AA',
  },
});
