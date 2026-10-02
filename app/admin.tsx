import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAppSession } from '../src/auth/appSession';
import {
  createVerificationDocumentUrl,
  isCurrentUserAdmin,
  listTrainerApplications,
  reviewTrainerApplication,
  type AdminTrainerApplication,
} from '../src/remote/admin';

export default function AdminScreen() {
  const db = useSQLiteContext();
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<AdminTrainerApplication[]>([]);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [rejecting, setRejecting] = useState<AdminTrainerApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const session = await getAppSession(db);
      if (!session || session.role !== 'trainer' || !session.accessToken) {
        router.replace('/login');
        return;
      }
      const admin = await isCurrentUserAdmin(session.accessToken);
      if (!admin) {
        Alert.alert('접근 권한 없음', '관리자 계정만 이용할 수 있어요.');
        router.back();
        return;
      }
      setAccessToken(session.accessToken);
      setApplications(await listTrainerApplications(session.accessToken));
    } catch (error) {
      console.error(error);
      Alert.alert(
        '관리자 센터 오류',
        error instanceof Error ? error.message : '승인 대기 목록을 불러오지 못했어요.',
      );
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openDocument = async (application: AdminTrainerApplication) => {
    if (!application.verification_document_path || !accessToken) {
      Alert.alert('증빙서류 없음', '업로드된 증빙서류가 없어요.');
      return;
    }
    setBusyId(application.auth_user_id);
    try {
      const url = await createVerificationDocumentUrl(
        accessToken,
        application.verification_document_path,
      );
      setDocumentTitle(application.verification_document_name || '증빙서류');
      setDocumentUrl(url);
    } catch (error) {
      Alert.alert(
        '서류 열기 실패',
        error instanceof Error ? error.message : '증빙서류를 열지 못했어요.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const approve = (application: AdminTrainerApplication) => {
    Alert.alert(
      '강사 승인',
      application.name + ' 강사의 인증을 승인할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '승인',
          onPress: () => {
            void (async () => {
              setBusyId(application.auth_user_id);
              try {
                await reviewTrainerApplication(
                  accessToken,
                  application.auth_user_id,
                  'approved',
                  null,
                );
                setApplications((current) =>
                  current.filter((item) => item.auth_user_id !== application.auth_user_id),
                );
                Alert.alert('승인 완료', '강사 인증을 승인했어요.');
              } catch (error) {
                Alert.alert(
                  '승인 실패',
                  error instanceof Error ? error.message : '승인 처리에 실패했어요.',
                );
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const submitReject = async () => {
    if (!rejecting) return;
    const target = rejecting;
    setBusyId(target.auth_user_id);
    try {
      await reviewTrainerApplication(
        accessToken,
        target.auth_user_id,
        'rejected',
        rejectReason,
      );
      setApplications((current) =>
        current.filter((item) => item.auth_user_id !== target.auth_user_id),
      );
      setRejecting(null);
      setRejectReason('');
      Alert.alert('반려 완료', '강사에게 반려 상태와 사유가 표시됩니다.');
    } catch (error) {
      Alert.alert(
        '반려 실패',
        error instanceof Error ? error.message : '반려 처리에 실패했어요.',
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.headerTitle}>관리자 센터</Text>
        <View style={styles.headerSide} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#177B78" />
          <Text style={styles.loadingText}>승인 대기 강사를 불러오는 중...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryEyebrow}>TRAINER APPROVAL</Text>
            <Text style={styles.summaryTitle}>승인 대기 {applications.length}명</Text>
            <Text style={styles.summaryText}>
              제출 정보와 증빙서류를 확인한 뒤 승인 또는 반려하세요.
            </Text>
          </View>

          {applications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>현재 승인 대기 강사가 없어요.</Text>
              <Text style={styles.emptyText}>새 신청이 들어오면 이 화면에 표시됩니다.</Text>
            </View>
          ) : (
            applications.map((application) => {
              const busy = busyId === application.auth_user_id;
              return (
                <View key={application.auth_user_id} style={styles.card}>
                  <View style={styles.nameRow}>
                    <View style={styles.nameWrap}>
                      <Text style={styles.name}>{application.name || '이름 미입력'}</Text>
                      <Text style={styles.status}>승인 대기</Text>
                    </View>
                    {busy ? <ActivityIndicator color="#177B78" /> : null}
                  </View>

                  <Info label="이메일" value={application.email || '-'} />
                  <Info label="연락처" value={application.phone || '-'} />
                  <Info label="소속 센터" value={application.gym_name || '-'} />
                  <Info
                    label="신청일"
                    value={
                      application.verification_submitted_at
                        ? new Date(application.verification_submitted_at).toLocaleString('ko-KR')
                        : '-'
                    }
                  />

                  <Pressable
                    style={[
                      styles.documentButton,
                      !application.verification_document_path && styles.disabled,
                    ]}
                    disabled={!application.verification_document_path || busy}
                    onPress={() => void openDocument(application)}
                  >
                    <Text style={styles.documentButtonText}>
                      {application.verification_document_path
                        ? '증빙서류 보기'
                        : '증빙서류 없음'}
                    </Text>
                  </Pressable>

                  <View style={styles.actions}>
                    <Pressable
                      style={[styles.rejectButton, busy && styles.disabled]}
                      disabled={busy}
                      onPress={() => {
                        setRejecting(application);
                        setRejectReason('');
                      }}
                    >
                      <Text style={styles.rejectText}>반려</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.approveButton, busy && styles.disabled]}
                      disabled={busy}
                      onPress={() => approve(application)}
                    >
                      <Text style={styles.approveText}>승인</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal
        visible={documentUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDocumentUrl(null)}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>{documentTitle || '증빙서류'}</Text>
              <Pressable onPress={() => setDocumentUrl(null)}>
                <Text style={styles.close}>닫기</Text>
              </Pressable>
            </View>
            {documentUrl ? (
              <Image source={{ uri: documentUrl }} style={styles.previewImage} resizeMode="contain" />
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={rejecting !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRejecting(null)}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.rejectCard}>
            <Text style={styles.rejectTitle}>강사 인증 반려</Text>
            <Text style={styles.rejectDescription}>
              {rejecting?.name ?? '선택한 강사'}에게 보여줄 반려 사유를 입력해 주세요.
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              textAlignVertical="top"
              placeholder="예: 소속 센터를 확인할 수 있는 명함이나 재직증명서를 다시 제출해 주세요."
              placeholderTextColor="#A3A9B2"
              style={styles.rejectInput}
            />
            <View style={styles.rejectActions}>
              <Pressable style={styles.cancelButton} onPress={() => setRejecting(null)}>
                <Text style={styles.cancelText}>취소</Text>
              </Pressable>
              <Pressable
                style={styles.confirmRejectButton}
                onPress={() => void submitReject()}
              >
                <Text style={styles.confirmRejectText}>반려하기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6FA' },
  header: {
    height: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E7EC',
  },
  back: { width: 76, fontSize: 14, fontWeight: '800', color: '#177B78' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '900', color: '#252A32' },
  headerSide: { width: 76 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, fontSize: 12, color: '#858C97' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 18, paddingBottom: 50 },
  summaryCard: { padding: 18, borderRadius: 20, backgroundColor: '#177B78' },
  summaryEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#BDE4E0' },
  summaryTitle: { marginTop: 5, fontSize: 23, fontWeight: '900', color: '#FFFFFF' },
  summaryText: { marginTop: 7, fontSize: 12, lineHeight: 18, color: '#D8F1EE' },
  emptyCard: { marginTop: 16, padding: 28, alignItems: 'center', borderRadius: 18, backgroundColor: '#FFFFFF' },
  emptyTitle: { fontSize: 14, fontWeight: '900', color: '#3A4049' },
  emptyText: { marginTop: 7, fontSize: 11, color: '#8A919C' },
  card: { marginTop: 14, padding: 17, borderRadius: 18, backgroundColor: '#FFFFFF' },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 18, fontWeight: '900', color: '#252A32' },
  status: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 10, fontWeight: '900', color: '#9A6B28', backgroundColor: '#FFF2D9' },
  infoRow: { marginTop: 11, flexDirection: 'row' },
  infoLabel: { width: 74, fontSize: 11, fontWeight: '800', color: '#8A919C' },
  infoValue: { flex: 1, fontSize: 12, fontWeight: '700', color: '#4B525C' },
  documentButton: { height: 44, marginTop: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EEF1FF' },
  documentButtonText: { fontSize: 12, fontWeight: '900', color: '#4058D6' },
  actions: { marginTop: 12, flexDirection: 'row', gap: 10 },
  rejectButton: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FFF0F2' },
  rejectText: { fontSize: 13, fontWeight: '900', color: '#C54E5C' },
  approveButton: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#177B78' },
  approveText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
  previewBackdrop: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  previewCard: { width: '100%', maxWidth: 760, height: '82%', overflow: 'hidden', borderRadius: 20, backgroundColor: '#FFFFFF' },
  previewHeader: { height: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4E7EC' },
  previewTitle: { flex: 1, paddingRight: 12, fontSize: 14, fontWeight: '900', color: '#252A32' },
  close: { fontSize: 13, fontWeight: '900', color: '#177B78' },
  previewImage: { flex: 1, width: '100%', backgroundColor: '#F5F6F8' },
  rejectCard: { width: '100%', maxWidth: 520, padding: 20, borderRadius: 20, backgroundColor: '#FFFFFF' },
  rejectTitle: { fontSize: 19, fontWeight: '900', color: '#252A32' },
  rejectDescription: { marginTop: 8, fontSize: 12, lineHeight: 18, color: '#7C8490' },
  rejectInput: { minHeight: 110, marginTop: 14, padding: 13, borderWidth: 1, borderColor: '#DEE2E8', borderRadius: 14, backgroundColor: '#FAFBFC', fontSize: 13, color: '#252A32' },
  rejectActions: { marginTop: 14, flexDirection: 'row', gap: 10 },
  cancelButton: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EEF0F3' },
  cancelText: { fontSize: 13, fontWeight: '900', color: '#626A76' },
  confirmRejectButton: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#C54E5C' },
  confirmRejectText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
});
