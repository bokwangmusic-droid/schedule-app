import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MSK_GUIDE_AREAS,
  MSK_GUIDE_ITEMS,
  MSK_GUIDE_REVIEWED_AT,
} from '../src/data/mskGuideData';

export default function MskGuideScreen() {
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('전체');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return MSK_GUIDE_ITEMS.filter((item) => {
      if (area !== '전체' && item.area !== area) return false;
      if (!normalized) return true;
      return [
        item.title,
        ...item.aliases,
        item.area,
        item.summary,
        ...item.checks,
        ...item.care,
        ...item.avoid,
        ...item.refer,
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalized);
    });
  }, [area, query]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.backText}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.headerTitle}>근골격 체크 가이드</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>트레이너용 선별·운동조절 가이드</Text>
          <Text style={styles.warningText}>
            이 기능은 질환을 진단하는 도구가 아닙니다. 증상을 억지로 재현하지 말고,
            신경학적 증상·큰 외상·급격한 악화·전신 증상·레드플래그가 있으면 운동보다 의료진 평가를 우선합니다.
          </Text>
          <Text style={styles.reviewText}>
            {MSK_GUIDE_ITEMS.length}개 항목 · 자료 검토 {MSK_GUIDE_REVIEWED_AT}
          </Text>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="예: 어깨, 손저림, 좌골신경통, ACL"
          placeholderTextColor="#A0A6B0"
          style={styles.searchInput}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.areaRow}
        >
          {MSK_GUIDE_AREAS.map((item) => (
            <Pressable
              key={item}
              style={[styles.areaChip, area === item && styles.areaChipActive]}
              onPress={() => setArea(item)}
            >
              <Text style={[styles.areaChipText, area === item && styles.areaChipTextActive]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {filtered.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.areaBadge}>{item.area}</Text>
            </View>

            {item.aliases.length > 0 ? (
              <Text style={styles.aliasText}>{item.aliases.join(' · ')}</Text>
            ) : null}
            <Text style={styles.summary}>{item.summary}</Text>

            <Text style={styles.sectionLabel}>현장 체크</Text>
            {item.checks.map((text, index) => (
              <Text key={`check-${item.id}-${index}`} style={styles.bullet}>• {text}</Text>
            ))}

            <Text style={styles.sectionLabel}>운동 케어</Text>
            {item.care.map((text, index) => (
              <Text key={`care-${item.id}-${index}`} style={styles.bullet}>• {text}</Text>
            ))}

            <View style={styles.avoidBox}>
              <Text style={styles.avoidTitle}>피하거나 주의할 것</Text>
              {item.avoid.map((text, index) => (
                <Text key={`avoid-${item.id}-${index}`} style={styles.avoidText}>• {text}</Text>
              ))}
            </View>

            <View style={styles.referBox}>
              <Text style={styles.referTitle}>운동 중단·의료진 확인 기준</Text>
              {item.refer.map((text, index) => (
                <Text key={`refer-${item.id}-${index}`} style={styles.referText}>• {text}</Text>
              ))}
            </View>

            <Text style={styles.sourceTitle}>참고 근거</Text>
            <Text style={styles.sourceText}>{item.sources.join(' · ')}</Text>
          </View>
        ))}

        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>검색 결과가 없어요.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F6F8' },
  header: {
    height: 58,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E1E4E9',
    backgroundColor: '#FFFFFF',
  },
  backText: { minWidth: 60, fontSize: 15, fontWeight: '800', color: '#4B68FF' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#20242C' },
  headerSpacer: { width: 60 },
  content: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    padding: 14,
    paddingBottom: 36,
  },
  warningCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFF8E7',
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0D999',
  },
  warningTitle: { fontSize: 14, fontWeight: '900', color: '#725A15' },
  warningText: { marginTop: 6, fontSize: 12, lineHeight: 18, color: '#6A6046' },
  reviewText: { marginTop: 8, fontSize: 10, fontWeight: '800', color: '#9A8447' },
  searchInput: {
    height: 48,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    color: '#20242C',
  },
  areaRow: { paddingVertical: 10, gap: 7 },
  areaChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDEFF3',
  },
  areaChipActive: { backgroundColor: '#E9EDFF' },
  areaChipText: { fontSize: 11, fontWeight: '800', color: '#747B86' },
  areaChipTextActive: { color: '#4B68FF' },
  card: {
    marginBottom: 10,
    padding: 15,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '900', color: '#252A32' },
  areaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 10,
    fontWeight: '900',
    color: '#5968B5',
    backgroundColor: '#EEF1FF',
  },
  aliasText: { marginTop: 5, fontSize: 10, fontWeight: '700', color: '#9A7F58' },
  summary: { marginTop: 6, fontSize: 12, lineHeight: 18, color: '#737B87' },
  sectionLabel: {
    marginTop: 13,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '900',
    color: '#3E4652',
  },
  bullet: { marginTop: 3, fontSize: 12, lineHeight: 18, color: '#4F5661' },
  avoidBox: {
    marginTop: 12,
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#FFF8EC',
  },
  avoidTitle: { fontSize: 11, fontWeight: '900', color: '#95621F' },
  avoidText: { marginTop: 3, fontSize: 11, lineHeight: 16, color: '#7C6750' },
  referBox: {
    marginTop: 9,
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#FFF1F3',
  },
  referTitle: { fontSize: 11, fontWeight: '900', color: '#B33A4A' },
  referText: { marginTop: 3, fontSize: 11, lineHeight: 16, color: '#8C4B54' },
  sourceTitle: { marginTop: 11, fontSize: 10, fontWeight: '900', color: '#777F8B' },
  sourceText: { marginTop: 3, fontSize: 10, lineHeight: 15, color: '#9AA0AA' },
  emptyCard: {
    padding: 28,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyText: { fontSize: 13, fontWeight: '700', color: '#8A919C' },
});
