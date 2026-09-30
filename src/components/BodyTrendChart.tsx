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
            {points.map((point, index) => {
              const value = point[metric] as number;
              const height = 22 + ((value - min) / span) * 86;
              return (
                <View key={point.id} style={styles.column}>
                  <Text style={styles.value}>{value.toFixed(1)}</Text>
                  <View style={[styles.bar, { height }]} />
                  <Text style={styles.date}>{point.measuredDate.slice(5)}</Text>
                </View>
              );
            })}
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
  chart: { height: 155, marginTop: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  value: { marginBottom: 4, fontSize: 9, fontWeight: '800', color: '#5F6772' },
  bar: { width: '62%', minWidth: 10, maxWidth: 34, borderRadius: 7, backgroundColor: '#7186F6' },
  date: { marginTop: 5, fontSize: 8, color: '#8A919C' },
  empty: { paddingVertical: 30, textAlign: 'center', fontSize: 12, color: '#8A919C' },
});
