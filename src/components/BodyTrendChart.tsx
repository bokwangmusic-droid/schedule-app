import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  const span = Math.max(max - min, 1);
  const latest = values.at(-1);
  const previous = values.at(-2);
  const delta = latest !== undefined && previous !== undefined ? latest - previous : null;

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
            <View style={styles.gridLineTop} />
            <View style={styles.gridLineMid} />
            <View style={styles.gridLineBottom} />
            <View style={styles.linePlot}>
              {points.map((item, index) => {
                const value = item[metric] as number;
                const ratio = (value - min) / span;
                const y = 82 - ratio * 64;
                const xPercent = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
                const next = points[index + 1];
                let connector = null;
                if (next) {
                  const nextValue = next[metric] as number;
                  const nextRatio = (nextValue - min) / span;
                  const nextY = 82 - nextRatio * 64;
                  const segments = 12;
                  connector = Array.from({ length: segments }, (_, segment) => {
                    const t = (segment + 0.5) / segments;
                    const dotY = y + (nextY - y) * t;
                    const segmentWidth = (100 / Math.max(points.length - 1, 1)) / segments;
                    const dotX = xPercent + segmentWidth * (segment + 0.5);
                    return <View key={segment} style={[styles.lineDot, { left: `${dotX}%`, top: dotY }]} />;
                  });
                }
                return (
                  <View key={item.id} style={StyleSheet.absoluteFill} pointerEvents="none">
                    {connector}
                    <View style={[styles.pointWrap, { left: `${xPercent}%`, top: y }]}>
                      <Text style={styles.value}>{value.toFixed(1)}</Text>
                      <View style={styles.point} />
                      <Text style={styles.date}>{item.measuredDate.slice(5)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
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
  chart: { height: 145, marginTop: 10, position: 'relative' },
  linePlot: { position: 'absolute', left: 28, right: 28, top: 0, height: 120 },
  gridLineTop: { position: 'absolute', left: 28, right: 28, top: 18, height: 1, backgroundColor: '#ECEEF3' },
  gridLineMid: { position: 'absolute', left: 28, right: 28, top: 50, height: 1, backgroundColor: '#ECEEF3' },
  gridLineBottom: { position: 'absolute', left: 28, right: 28, top: 82, height: 1, backgroundColor: '#ECEEF3' },
  pointWrap: { position: 'absolute', width: 58, marginLeft: -29, alignItems: 'center' },
  point: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#FFF', backgroundColor: '#4B68FF' },
  lineDot: { position: 'absolute', width: 5, height: 5, marginLeft: -2.5, marginTop: 2.5, borderRadius: 2.5, backgroundColor: '#4B68FF' },
  value: { position: 'absolute', bottom: 13, fontSize: 9, fontWeight: '900', color: '#4B68FF' },
  date: { position: 'absolute', top: 16, width: 58, textAlign: 'center', fontSize: 8, color: '#8A919C' },
  empty: { paddingVertical: 30, textAlign: 'center', fontSize: 12, color: '#8A919C' },
});
