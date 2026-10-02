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
  canvasWidth?: number;
  canvasHeight?: number;
  points?: SignaturePoint[];
};

type RenderPoint = SignaturePoint & {
  x: number;
  y: number;
};

function smoothStroke(points: RenderPoint[]) {
  if (points.length < 3) return points;

  const result: RenderPoint[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];

    const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(3, Math.min(12, Math.ceil(distance / 2)));

    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        ((2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        ((2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      result.push({ x, y, stroke: p1.stroke });
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

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

  const payload = useMemo(() => {
    try {
      return JSON.parse(signatureJson) as SignaturePayload;
    } catch {
      return {};
    }
  }, [signatureJson]);

  const points = useMemo(() => {
    if (!Array.isArray(payload.points)) return [];
    return payload.points.filter(
      (point) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Number.isFinite(point.stroke),
    );
  }, [payload]);

  const rendered = useMemo(() => {
    if (points.length < 2 || width <= 0) return { segments: [], dots: [] };

    const padding = compact ? 2 : 10;
    const savedWidth =
      typeof payload.canvasWidth === 'number' && payload.canvasWidth > 0
        ? payload.canvasWidth
        : null;
    const savedHeight =
      typeof payload.canvasHeight === 'number' && payload.canvasHeight > 0
        ? payload.canvasHeight
        : null;

    let normalized: RenderPoint[];
    if (savedWidth && savedHeight) {
      const scale = Math.min(
        (width - padding * 2) / savedWidth,
        (height - padding * 2) / savedHeight,
      );
      const offsetX = (width - savedWidth * scale) / 2;
      const offsetY = (height - savedHeight * scale) / 2;
      normalized = points.map((point) => ({
        ...point,
        x: offsetX + point.x * scale,
        y: offsetY + point.y * scale,
      }));
    } else {
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const sourceWidth = Math.max(maxX - minX, 1);
      const sourceHeight = Math.max(maxY - minY, 1);
      const scale = Math.min(
        (width - padding * 2) / sourceWidth,
        (height - padding * 2) / sourceHeight,
      );
      normalized = points.map((point) => ({
        ...point,
        x: padding + (point.x - minX) * scale,
        y: padding + (point.y - minY) * scale,
      }));
    }

    const strokes = new Map<number, RenderPoint[]>();
    for (const point of normalized) {
      const list = strokes.get(point.stroke) ?? [];
      list.push(point);
      strokes.set(point.stroke, list);
    }

    const smoothPoints = Array.from(strokes.values()).flatMap(smoothStroke);
    const segments = smoothPoints.flatMap((point, index) => {
      if (index === 0) return [];
      const previous = smoothPoints[index - 1];
      if (previous.stroke !== point.stroke) return [];

      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      const length = Math.hypot(dx, dy);
      if (length < 0.1) return [];

      const thickness = compact ? 2.8 : 4.5;
      const overlap = thickness * 0.62;
      const renderedLength = length + overlap * 2;
      return [{
        key: `${point.stroke}-${index}`,
        left: (previous.x + point.x) / 2 - renderedLength / 2,
        top: (previous.y + point.y) / 2 - thickness / 2,
        width: renderedLength,
        height: thickness,
        radius: thickness / 2,
        angle: Math.atan2(dy, dx),
      }];
    });

    const dots = smoothPoints.map((point, index) => ({
      key: `dot-${point.stroke}-${index}`,
      left: point.x - (compact ? 1.4 : 2.25),
      top: point.y - (compact ? 1.4 : 2.25),
      size: compact ? 2.8 : 4.5,
    }));

    return { segments, dots };
  }, [compact, height, payload.canvasHeight, payload.canvasWidth, points, width]);

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
      {rendered.segments.map((segment) => (
        <View
          key={segment.key}
          pointerEvents="none"
          style={[
            styles.segment,
            {
              left: segment.left,
              top: segment.top,
              width: segment.width,
              height: segment.height,
              borderRadius: segment.radius,
              transform: [{ rotate: `${segment.angle}rad` }],
            },
          ]}
        />
      ))}
      {rendered.dots.map((dot) => (
        <View
          key={dot.key}
          pointerEvents="none"
          style={[
            styles.segment,
            {
              left: dot.left,
              top: dot.top,
              width: dot.size,
              height: dot.size,
              borderRadius: dot.size / 2,
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
