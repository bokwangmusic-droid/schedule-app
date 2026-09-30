import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import type { BodyRecordItem } from '../types/memberFitness';

type MetricKey = 'weight' | 'skeletalMuscle' | 'bodyFatPercentage';

const metrics: Array<{ key: MetricKey; label: string; unit: string }> = [
  { key: 'weight', label: '체중', unit: 'kg' },
  { key: 'skeletalMuscle', label: '골격근량', unit: 'kg' },
  { key: 'bodyFatPercentage', label: '체지방률', unit: '%' },
];

export function BodyTrendChart({ records }: { records: BodyRecordItem[] }) {
  const [metric, setMetric] = useState<MetricKey>('weight');
  const config = metrics.find((item) => item.key === metric)!;
  const points = useMemo(
    () => [...records].reverse().filter((item) => item[metric] !== null).slice(-8),
    [records, metric],
  );
  const values = points.map((item) => item[metric] as number);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const rawSpan = max - min;
  const padding = Math.max(rawSpan * 0.2, metric === 'weight' ? 1 : 0.5);
  const chartMin = min - padding;
  const chartMax = max + padding;
  const span = Math.max(chartMax - chartMin, 1);
  const latest = values.at(-1);
  const previous = values.at(-2);
  const delta = latest !== undefined && previous !== undefined ? latest - previous : null;

  const width = 640;
  const height = 190;
  const left = 44;
  const right = 18;
  const top = 24;
  const bottom = 38;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const coords = points.map((item, index) => {
    const value = item[metric] as number;
    const x = points.length === 1 ? left + plotWidth / 2 : left + (index / (points.length - 1)) * plotWidth;
    const y = top + ((chartMax - value) / span) * plotHeight;
    return { item, value, x, y };
  });
  const polyline = coords.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View style={styles.card}>
      <View style={styles.tabs}>
        {metrics.map((item) => (
          <Pressable key={item.key} style={[styles.tab, metric === item.key && styles.tabActive]} onPress={() => setMetric(item.key)}>
            <Text style={[styles.tabText, metric === item.key && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {latest !== undefined ? (
        <>
          <View style={styles.summary}>
            <Text style={styles.latest}>{latest.toFixed(1)} {config.unit}</Text>
            {delta !== null ? <Text style={styles.delta}>직전 대비 {delta >= 0 ? '+' : ''}{delta.toFixed(1)} {config.unit}</Text> : null}
          </View>
          <View style={styles.chart}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
              {[0, 0.5, 1].map((ratio) => {
                const y = top + ratio * plotHeight;
                const value = chartMax - ratio * span;
                return <View key={ratio} />;
              })}
              {[0, 0.5, 1].map((ratio) => {
                const y = top + ratio * plotHeight;
                const value = chartMax - ratio * span;
                return <SvgText key={`label-${ratio}`} x={left - 8} y={y + 4} fontSize="10" textAnchor="end" fill="#8A919C">{value.toFixed(1)}</SvgText>;
              })}
              {[0, 0.5, 1].map((ratio) => {
                const y = top + ratio * plotHeight;
                return <Line key={`grid-${ratio}`} x1={left} y1={y} x2={width - right} y2={y} stroke="#E7EAF0" strokeWidth="1" />;
              })}
              {coords.length > 1 ? <Polyline points={polyline} fill="none" stroke="#4B68FF" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" /> : null}
              {coords.map(({ item, value, x, y }) => (
                <Circle key={item.id} cx={x} cy={y} r="6" fill="#4B68FF" stroke="#FFF" strokeWidth="3" />
              ))}
              {coords.map(({ item, value, x, y }) => (
                <SvgText key={`value-${item.id}`} x={x} y={Math.max(12, y - 11)} fontSize="10" fontWeight="700" textAnchor="middle" fill="#4B68FF">{value.toFixed(1)}</SvgText>
              ))}
              {coords.map(({ item, x }) => (
                <SvgText key={`date-${item.id}`} x={x} y={height - 12} fontSize="9" textAnchor="middle" fill="#8A919C">{item.measuredDate.slice(5)}</SvgText>
              ))}
            </Svg>
          </View>
        </>
      ) : <Text style={styles.empty}>측정 기록이 쌓이면 변화 그래프가 표시돼요.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 16, backgroundColor: '#FFF' },
  tabs: { flexDirection: 'row', gap: 7 },
  tab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F1F3F6' },
  tabActive: { backgroundColor: '#E8EDFF' },
  tabText: { fontSize: 11, fontWeight: '800', color: '#7A828E' },
  tabTextActive: { color: '#4B68FF' },
  summary: { marginTop: 14, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  latest: { fontSize: 22, fontWeight: '900', color: '#252A32' },
  delta: { fontSize: 11, fontWeight: '800', color: '#69717D' },
  chart: { height: 190, marginTop: 10 },
  empty: { paddingVertical: 30, textAlign: 'center', fontSize: 12, color: '#8A919C' },
});
