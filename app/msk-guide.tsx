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

type GuideItem = {
  title: string;
  area: string;
  summary: string;
  checks: string[];
  care: string[];
  refer: string[];
};

const GUIDE_ITEMS: GuideItem[] = [
  {
    title: '회전근개 관련 어깨 통증',
    area: '어깨',
    summary: '팔을 들 때 통증, 야간통, 특정 각도에서 힘이 빠지는 느낌이 있을 때 참고합니다.',
    checks: [
      '양팔을 천천히 들어 좌우 가동범위와 통증 각도를 비교합니다.',
      '팔을 옆으로 든 상태에서 가벼운 저항에 버티는 동작으로 통증·근력 차이를 확인합니다.',
      '한 가지 검사만으로 진단하지 말고 통증 위치, 야간통, 일상동작 제한을 함께 봅니다.',
    ],
    care: [
      '통증을 크게 유발하는 오버헤드·딥스·무거운 프레스 볼륨을 일시적으로 줄입니다.',
      '통증 허용 범위에서 견갑 움직임, 가벼운 외회전, 로우 계열로 점진적으로 부하를 올립니다.',
      '운동 중 통증이 계속 증가하거나 다음 날까지 뚜렷하게 악화되면 강도를 낮춥니다.',
    ],
    refer: ['외상 후 팔을 거의 들 수 없음', '갑작스러운 뚜렷한 근력저하', '지속되는 야간통 또는 점점 심해지는 통증'],
  },
  {
    title: '외측상과 통증(테니스 엘보)',
    area: '팔꿈치',
    summary: '물건을 쥐거나 손목을 펴는 동작에서 팔꿈치 바깥쪽이 아플 때 참고합니다.',
    checks: [
      '팔꿈치 바깥쪽 압통 위치를 좌우 비교합니다.',
      '팔꿈치를 편 상태에서 손목을 위로 들고 가벼운 저항에 버틸 때 같은 통증이 재현되는지 확인합니다.',
      '강한 악력 테스트는 통증을 과도하게 유발하지 않는 범위에서만 합니다.',
    ],
    care: [
      '그립을 과도하게 요구하는 운동과 손목 신전 반복량을 잠시 줄입니다.',
      '통증 허용 범위에서 가벼운 손목 신전 등척성·저강도 저항운동부터 시작합니다.',
      '스트랩 사용이나 그립 변경으로 불필요한 전완 부담을 줄일 수 있습니다.',
    ],
    refer: ['팔꿈치 외상 후 심한 붓기·변형', '손가락 감각저하나 지속적인 저림', '수주간 조절해도 기능저하가 지속됨'],
  },
  {
    title: '손목터널증후군 의심 증상',
    area: '손목/손',
    summary: '엄지·검지·중지 쪽 저림, 야간 증상, 악력 저하가 있을 때 참고합니다.',
    checks: [
      '어느 손가락이 저린지와 야간에 심해지는지 먼저 확인합니다.',
      '손목을 굽힌 자세를 잠깐 유지하거나 손목 부위를 가볍게 두드렸을 때 같은 저림이 재현되는지 봅니다.',
      '단일 유발검사 하나로 확정하지 말고 증상 분포와 여러 소견을 함께 봅니다.',
    ],
    care: [
      '손목을 과하게 꺾은 상태의 프레스·푸시업·바벨 그립을 줄이고 중립 손목을 유지합니다.',
      '야간 증상이 반복되면 중립 손목 보조기 사용 여부를 의료진과 상담하도록 안내합니다.',
      '저림이 증가하면 상체 운동 강도보다 신경 증상 관리가 우선입니다.',
    ],
    refer: ['엄지두덩 근육이 눈에 띄게 줄어듦', '지속적인 감각저하', '물건을 자주 떨어뜨릴 정도의 근력저하'],
  },
  {
    title: '허리통증 / 좌골신경통 증상',
    area: '허리',
    summary: '허리 통증과 함께 엉덩이·다리로 뻗치는 통증이나 저림이 있을 때 참고합니다.',
    checks: [
      '통증이 허리에만 있는지, 엉덩이·다리 아래까지 퍼지는지 확인합니다.',
      '좌우 다리의 감각, 발목·발가락 움직임, 걷기 상태에 큰 차이가 있는지 관찰합니다.',
      '통증을 억지로 재현하는 강한 신경 긴장 검사는 트레이닝 현장에서 반복하지 않습니다.',
    ],
    care: [
      '완전한 침상안정보다는 통증 허용 범위의 걷기와 가벼운 움직임을 유지합니다.',
      '통증을 크게 늘리는 고중량 데드리프트·굿모닝·깊은 굴곡 부하는 일시적으로 줄입니다.',
      '증상이 줄면 힙힌지, 둔근·몸통 안정화부터 점진적으로 복귀합니다.',
    ],
    refer: ['양쪽 다리의 심한 저림·근력저하', '회음부/항문 주변 감각저하', '배뇨·배변 조절 변화', '급격히 악화되는 심한 통증'],
  },
  {
    title: '슬개대퇴 통증',
    area: '무릎',
    summary: '계단, 스쿼트, 오래 앉았다 일어날 때 무릎 앞쪽 통증이 있을 때 참고합니다.',
    checks: [
      '맨몸 스쿼트나 낮은 스텝다운에서 무릎 앞쪽 통증이 재현되는지 확인합니다.',
      '좌우 무릎 정렬, 고관절 흔들림, 발의 지지 차이를 관찰합니다.',
      '통증 자체보다 어떤 깊이·속도·부하에서 증상이 시작되는지 기록합니다.',
    ],
    care: [
      '통증이 큰 깊은 스쿼트·런지 볼륨을 줄이고 통증 없는 범위부터 다시 시작합니다.',
      '대퇴사두근과 둔근 강화, 스텝업·레그프레스 등으로 허용 범위의 부하를 점진적으로 올립니다.',
      '운동 중 통증이 낮고 다음 날 악화가 없으면 서서히 범위와 볼륨을 늘립니다.',
    ],
    refer: ['무릎이 잠김', '뚜렷한 붓기와 열감', '외상 후 체중지지가 어려움', '무릎이 반복적으로 꺾이는 느낌'],
  },
  {
    title: '아킬레스건 통증',
    area: '발목',
    summary: '발뒤꿈치 위쪽이나 아킬레스건 부위가 달리기·점프 때 아플 때 참고합니다.',
    checks: [
      '통증 위치와 아침 첫걸음 뻣뻣함 여부를 확인합니다.',
      '양발과 한발 까치발에서 통증·높이·반복횟수 차이를 비교합니다.',
      '갑작스러운 파열 의심 상황에서는 반복 테스트하지 않습니다.',
    ],
    care: [
      '점프·전력질주·고강도 러닝을 일시적으로 줄이고 통증 허용 범위의 종아리 저항운동을 사용합니다.',
      '등척성 또는 천천히 하는 카프레이즈부터 시작해 점진적으로 부하를 올립니다.',
      '운동 다음 날 아침 통증이 뚜렷하게 증가하면 전날 부하를 줄입니다.',
    ],
    refer: ['뚝 하는 느낌과 함께 갑작스러운 통증', '까치발이 거의 불가능함', '심한 부종·멍'],
  },
  {
    title: '족저근막 통증',
    area: '발',
    summary: '아침 첫걸음이나 오래 쉬었다가 걸을 때 발뒤꿈치 안쪽이 아플 때 참고합니다.',
    checks: [
      '첫걸음 통증과 발뒤꿈치 안쪽 압통 여부를 확인합니다.',
      '종아리 유연성과 발목 배굴 범위를 좌우 비교합니다.',
      '점프나 달리기 후 통증 패턴이 어떻게 변하는지 기록합니다.',
    ],
    care: [
      '딱딱한 바닥에서의 러닝·점프량을 줄이고 지지력이 있는 신발을 사용합니다.',
      '종아리와 발바닥 스트레칭, 점진적인 카프레이즈를 적용합니다.',
      '아침 첫걸음 통증이 줄어드는지 주 단위로 추적합니다.',
    ],
    refer: ['외상 후 발을 디딜 수 없음', '감각저하·화끈거림이 주된 증상', '통증이 지속적으로 악화됨'],
  },
];

const AREAS = ['전체', '어깨', '팔꿈치', '손목/손', '허리', '무릎', '발목', '발'];

export default function MskGuideScreen() {
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('전체');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return GUIDE_ITEMS.filter((item) => {
      if (area !== '전체' && item.area !== area) return false;
      if (!normalized) return true;
      return [item.title, item.area, item.summary, ...item.checks, ...item.care]
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
          <Text style={styles.warningTitle}>트레이너용 선별 가이드</Text>
          <Text style={styles.warningText}>
            아래 검사는 진단이 아니라 운동 가능 범위와 의료진 의뢰 필요성을 확인하기 위한 참고입니다.
            통증을 억지로 재현하지 말고, 신경학적 증상·외상·급격한 악화가 있으면 운동보다 진료가 우선입니다.
          </Text>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="예: 어깨, 손저림, 무릎"
          placeholderTextColor="#A0A6B0"
          style={styles.searchInput}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areaRow}>
          {AREAS.map((item) => (
            <Pressable
              key={item}
              style={[styles.areaChip, area === item && styles.areaChipActive]}
              onPress={() => setArea(item)}
            >
              <Text style={[styles.areaChipText, area === item && styles.areaChipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {filtered.map((item) => (
          <View key={item.title} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.areaBadge}>{item.area}</Text>
            </View>
            <Text style={styles.summary}>{item.summary}</Text>

            <Text style={styles.sectionLabel}>현장 체크</Text>
            {item.checks.map((text, index) => (
              <Text key={`check-${index}`} style={styles.bullet}>• {text}</Text>
            ))}

            <Text style={styles.sectionLabel}>운동 케어</Text>
            {item.care.map((text, index) => (
              <Text key={`care-${index}`} style={styles.bullet}>• {text}</Text>
            ))}

            <View style={styles.referBox}>
              <Text style={styles.referTitle}>운동 중단·의료진 확인 기준</Text>
              {item.refer.map((text, index) => (
                <Text key={`refer-${index}`} style={styles.referText}>• {text}</Text>
              ))}
            </View>
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
    borderColor: '#F0D999',
  },
  warningTitle: { fontSize: 14, fontWeight: '900', color: '#725A15' },
  warningText: { marginTop: 6, fontSize: 12, lineHeight: 18, color: '#6A6046' },
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
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
  summary: { marginTop: 6, fontSize: 12, lineHeight: 18, color: '#737B87' },
  sectionLabel: { marginTop: 13, marginBottom: 4, fontSize: 12, fontWeight: '900', color: '#3E4652' },
  bullet: { marginTop: 3, fontSize: 12, lineHeight: 18, color: '#4F5661' },
  referBox: {
    marginTop: 12,
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#FFF1F3',
  },
  referTitle: { fontSize: 11, fontWeight: '900', color: '#B33A4A' },
  referText: { marginTop: 3, fontSize: 11, lineHeight: 16, color: '#8C4B54' },
  emptyCard: { padding: 28, alignItems: 'center', borderRadius: 16, backgroundColor: '#FFFFFF' },
  emptyText: { fontSize: 13, fontWeight: '700', color: '#8A919C' },
});
