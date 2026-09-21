import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CreateBodyRecordInput } from '../types/memberFitness';

type Props = {
  visible: boolean;
  memberId: string;
  memberName: string;
  date: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateBodyRecordInput) => void;
};

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function BodyRecordModal({
  visible,
  memberId,
  memberName,
  date,
  saving = false,
  onClose,
  onSubmit,
}: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;
  const [measuredDate, setMeasuredDate] = useState(date);
  const [weight, setWeight] = useState('');
  const [skeletalMuscle, setSkeletalMuscle] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [bodyFatPercentage, setBodyFatPercentage] = useState('');

  useEffect(() => {
    if (!visible) return;
    setMeasuredDate(date);
  }, [date, visible]);

  const reset = () => {
    setMeasuredDate(date);
    setWeight('');
    setSkeletalMuscle('');
    setBodyFat('');
    setBodyFatPercentage('');
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const submit = () => {
    onSubmit({
      memberId,
      measuredDate,
      weight: parseOptionalNumber(weight),
      skeletalMuscle: parseOptionalNumber(skeletalMuscle),
      bodyFat: parseOptionalNumber(bodyFat),
      bodyFatPercentage: parseOptionalNumber(bodyFatPercentage),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <Pressable onPress={close} hitSlop={10}>
              <Text style={styles.headerAction}>취소</Text>
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>인바디 기록</Text>
              <Text style={styles.headerSub}>{memberName}</Text>
            </View>
            <Pressable onPress={submit} disabled={saving} hitSlop={10}>
              <Text style={[styles.headerSave, saving && styles.disabled]}>
                {saving ? '저장중' : '저장'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.content,
              isTablet && styles.contentTablet,
            ]}
          >
            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <Text style={styles.sectionTitle}>측정 정보</Text>
              <TextInput
                value={measuredDate}
                onChangeText={setMeasuredDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A2A8B2"
                style={[styles.input, isTablet && styles.inputTablet]}
              />
            </View>

            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <Text style={styles.sectionTitle}>체성분</Text>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                placeholder="몸무게 kg"
                placeholderTextColor="#A2A8B2"
                keyboardType="decimal-pad"
                style={[styles.input, isTablet && styles.inputTablet]}
              />
              <TextInput
                value={skeletalMuscle}
                onChangeText={setSkeletalMuscle}
                placeholder="골격근량 kg"
                placeholderTextColor="#A2A8B2"
                keyboardType="decimal-pad"
                style={[styles.input, isTablet && styles.inputTablet]}
              />
              <TextInput
                value={bodyFat}
                onChangeText={setBodyFat}
                placeholder="체지방량 kg"
                placeholderTextColor="#A2A8B2"
                keyboardType="decimal-pad"
                style={[styles.input, isTablet && styles.inputTablet]}
              />
              <TextInput
                value={bodyFatPercentage}
                onChangeText={setBodyFatPercentage}
                placeholder="체지방률 %"
                placeholderTextColor="#A2A8B2"
                keyboardType="decimal-pad"
                style={[styles.input, isTablet && styles.inputTablet]}
              />
            </View>

            <View style={styles.guideCard}>
              <Text style={styles.guideTitle}>구글시트의 인바디 기록을 그대로 옮긴 구조예요.</Text>
              <Text style={styles.guideText}>
                측정일 · 몸무게 · 골격근 · 체지방 · 체지방률이 회원별로 누적됩니다.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F7F9' },
  flex: { flex: 1 },
  header: {
    height: 60,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E5EA',
    backgroundColor: '#FFFFFF',
  },
  headerTablet: {
    height: 72,
    paddingHorizontal: 28,
  },
  headerAction: { width: 54, fontSize: 15, color: '#68707D' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#20242B' },
  headerSub: { marginTop: 1, fontSize: 10, color: '#8A919C' },
  headerSave: {
    width: 54,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '900',
    color: '#4B68FF',
  },
  disabled: { opacity: 0.45 },
  content: { padding: 16, gap: 10 },
  contentTablet: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 22,
    gap: 14,
  },
  card: { padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF' },
  cardTablet: {
    padding: 22,
    borderRadius: 22,
  },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#252A32' },
  input: {
    minHeight: 48,
    marginTop: 10,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: '#F3F5F8',
    fontSize: 14,
    color: '#252A32',
  },
  inputTablet: {
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 14,
    fontSize: 16,
  },
  guideCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#EEF1FF',
  },
  guideTitle: { fontSize: 12, fontWeight: '900', color: '#4F5FAD' },
  guideText: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 17,
    color: '#6873A5',
  },
});
