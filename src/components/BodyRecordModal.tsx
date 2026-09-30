import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import {
  Alert,
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
import { inBodyQrDiagnostic, parseInBodyQr } from '../lib/inbodyQr';
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
  const [bmi, setBmi] = useState('');
  const [visceralFatLevel, setVisceralFatLevel] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerLocked, setScannerLocked] = useState(false);
  const [qrSummary, setQrSummary] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

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
    setBmi('');
    setVisceralFatLevel('');
    setScannerOpen(false);
    setScannerLocked(false);
    setQrSummary(null);
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
      bmi: parseOptionalNumber(bmi),
      visceralFatLevel: parseOptionalNumber(visceralFatLevel),
    });
  };

  const openScanner = async () => {
    let granted = cameraPermission?.granted ?? false;
    if (!granted) {
      const result = await requestCameraPermission();
      granted = result.granted;
    }
    if (!granted) {
      Alert.alert('카메라 권한이 필요해요.', '인바디 QR 자동입력을 사용하려면 카메라 권한을 허용해 주세요.');
      return;
    }
    setScannerLocked(false);
    setScannerOpen(true);
  };

  const applyQr = (data: string) => {
    if (scannerLocked) return;
    setScannerLocked(true);
    if (__DEV__) {
      // Diagnostic only: report structure, never persist the QR payload itself.
      console.info('[InBody QR diagnostic]', inBodyQrDiagnostic(data));
      console.info('[InBody QR payload - dev only]', data);
    }
    try {
      const parsed = parseInBodyQr(data);
      setMeasuredDate(parsed.measuredDate);
      setWeight(parsed.weight === null ? '' : String(parsed.weight));
      setSkeletalMuscle(parsed.skeletalMuscle === null ? '' : String(parsed.skeletalMuscle));
      setBodyFat(parsed.bodyFat === null ? '' : String(parsed.bodyFat));
      setBodyFatPercentage(parsed.bodyFatPercentage === null ? '' : String(parsed.bodyFatPercentage));
      setBmi(parsed.bmi === null ? '' : String(parsed.bmi));
      if (parsed.visceralFatLevel !== null) setVisceralFatLevel(String(parsed.visceralFatLevel));
      setQrSummary(`${parsed.measuredDate}${parsed.measuredTime ? ' ' + parsed.measuredTime : ''} · QR 자동입력 완료`);
      setScannerOpen(false);
    } catch (error) {
      setScannerLocked(false);
      Alert.alert(
        'QR을 자동입력하지 못했어요.',
        error instanceof Error ? error.message : '인바디 QR 코드인지 확인해 주세요.',
      );
    }
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
            <View style={[styles.qrCard, isTablet && styles.cardTablet]}>
              <View style={styles.qrTextWrap}>
                <Text style={styles.qrTitle}>인바디 QR 자동입력</Text>
                <Text style={styles.qrText}>결과지 오른쪽 아래 QR을 스캔하면 주요 수치가 자동으로 채워져요.</Text>
                {qrSummary ? <Text style={styles.qrSuccess}>{qrSummary}</Text> : null}
              </View>
              <Pressable style={styles.qrButton} onPress={() => void openScanner()}>
                <Text style={styles.qrButtonText}>QR 스캔</Text>
              </Pressable>
            </View>

            {scannerOpen ? (
              <View style={styles.scannerCard}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={({ data }) => applyQr(data)}
                />
                <View style={styles.scannerFooter}>
                  <Text style={styles.scannerHint}>인바디 결과지 QR을 사각형 안에 맞춰주세요.</Text>
                  <Pressable
                    style={styles.scannerCloseButton}
                    onPress={() => {
                      setScannerOpen(false);
                      setScannerLocked(false);
                    }}
                  >
                    <Text style={styles.scannerCloseText}>스캔 닫기</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

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
              <TextInput
                value={bmi}
                onChangeText={setBmi}
                placeholder="BMI"
                placeholderTextColor="#A2A8B2"
                keyboardType="decimal-pad"
                style={[styles.input, isTablet && styles.inputTablet]}
              />
              <TextInput
                value={visceralFatLevel}
                onChangeText={setVisceralFatLevel}
                placeholder="내장지방레벨"
                placeholderTextColor="#A2A8B2"
                keyboardType="number-pad"
                style={[styles.input, isTablet && styles.inputTablet]}
              />
            </View>

            <View style={styles.guideCard}>
              <Text style={styles.guideTitle}>구글시트의 인바디 기록을 그대로 옮긴 구조예요.</Text>
              <Text style={styles.guideText}>
                측정일 · 몸무게 · 골격근 · 체지방 · 체지방률 · BMI · 내장지방레벨이 회원별로 누적됩니다.
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
  qrCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qrTextWrap: { flex: 1 },
  qrTitle: { fontSize: 14, fontWeight: '900', color: '#344AB3' },
  qrText: { marginTop: 4, fontSize: 10, lineHeight: 15, color: '#6976A8' },
  qrSuccess: { marginTop: 6, fontSize: 10, fontWeight: '900', color: '#2D7A57' },
  qrButton: {
    minWidth: 82,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4B68FF',
  },
  qrButtonText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  scannerCard: { overflow: 'hidden', borderRadius: 18, backgroundColor: '#101114' },
  camera: { width: '100%', height: 300 },
  scannerFooter: { padding: 12, backgroundColor: '#17191D' },
  scannerHint: { fontSize: 11, textAlign: 'center', color: '#E4E7ED' },
  scannerCloseButton: {
    height: 38,
    marginTop: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2B2F36',
  },
  scannerCloseText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
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
