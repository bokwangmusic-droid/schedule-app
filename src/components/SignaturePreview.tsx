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
  compact?: boolean;
};

export function SignaturePreview({
  signatureJson,
  height = 110,
  compact = false,
}: Props) {
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
    const padding = compact ? 2 : 10;
    const scale = Math.min(
      (width - padding * 2) / sourceWidth,
      (height - padding * 2) / sourceHeight,
    );

    const normalized = points.map((point) => ({
      ...point,
      x: padding + (point.x - minX) * scale,
      y: padding + (point.y - minY) * scale,
    }));

    const maxSegmentLength = compact ? 24 : 60;

    return normalized.flatMap((point, index) => {
      if (index === 0) return [];
      const previous = normalized[index - 1];
      if (previous.stroke !== point.stroke) return [];

      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 0.5) return [];

      const pieces = Math.max(1, Math.ceil(length / maxSegmentLength));
      return Array.from({ length: pieces }, (_, pieceIndex) => {
        const t0 = pieceIndex / pieces;
        const t1 = (pieceIndex + 1) / pieces;
        const x0 = previous.x + dx * t0;
        const y0 = previous.y + dy * t0;
        const x1 = previous.x + dx * t1;
        const y1 = previous.y + dy * t1;
        const pieceDx = x1 - x0;
        const pieceDy = y1 - y0;
        const pieceLength = Math.sqrt(pieceDx * pieceDx + pieceDy * pieceDy);
        return {
        key: `${point.stroke}-${index}-${pieceIndex}`,
        left: (x0 + x1) / 2 - pieceLength / 2,
        top: (y0 + y1) / 2 - 1.6,
        width: pieceLength,
        angle: Math.atan2(pieceDy, pieceDx),
        };
      });
    });
  }, [compact, height, points, width]);

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.compactWrap,
        { height },
      ]}
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
              height: compact ? 1.8 : 3.2,
              borderRadius: compact ? 0.9 : 1.6,
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
  compactWrap: {
    borderWidth: 0,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  segment: {
    position: 'absolute',
    backgroundColor: '#252B34',
  },
  emptyText: {
    fontSize: 11,
    color: '#9AA0AA',
  },
});
