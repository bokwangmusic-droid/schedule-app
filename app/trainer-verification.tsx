import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import {
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
import {
  authorizeCurrentLaunch,
  getAppSession,
  saveAppSession,
  type TrainerSession,
} from '../src/auth/appSession';
import { completeTrainerMagicLink, refreshAuthSession } from '../src/remote/supabaseAuth';
import { SUPABASE_URL, supabaseHeaders } from '../src/remote/supabaseConfig';
import { uploadTrainerVerificationDocument } from '../src/remote/trainerVerification';

type Asset = { id: string; uri: string; filename?: string | null };

export default function TrainerVerificationScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{
    accessToken?: string;
    userId?: string;
    email?: string;
    status?: string;
    submittedAt?: string;
    rejectionReason?: string;
  }>();

  const [accessToken, setAccessToken] = useState(String(params.accessToken ?? ''));
  const [refreshToken, setRefreshToken] = useState('');
  const [userId, setUserId] = useState(String(params.userId ?? ''));
  const [email, setEmail] = useState(String(params.email ?? ''));
  const [status, setStatus] = useState(String(params.status ?? 'pending'));
  const [submittedAt, setSubmittedAt] = useState(String(params.submittedAt ?? ''));
  const [rejectionReason, setRejectionReason] = useState(String(params.rejectionReason ?? ''));
  const [loadingSession, setLoadingSession] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gymName, setGymName] = useState('');
  const [documentUri, setDocumentUri] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState('');
  const [busy, setBusy] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  useEffect(() => {
    let active = true;
    void getAppSession(db)
      .then((session) => {
        if (!active || !session || session.role !== 'trainer') return;
        if (!accessToken && session.accessToken) setAccessToken(session.accessToken);
        if (session.refreshToken) setRefreshToken(session.refreshToken);
        if (!userId) setUserId(session.trainerId);
        if (!email && session.email) setEmail(session.email);
        if (!params.status && session.verificationStatus) setStatus(session.verificationStatus);
        if (!params.submittedAt && session.verificationSubmittedAt) {
          setSubmittedAt(session.verificationSubmittedAt);
        }
      })
      .finally(() => {
        if (active) setLoadingSession(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, db, email, params.status, params.submittedAt, userId]);

  const persistTrainerSession = async (
    nextAccessToken: string,
    nextRefreshToken: string | undefined,
    nextStatus: 'pending' | 'approved' | 'rejected',
    nextSubmittedAt: string | null | undefined,
    nextEmail: string,
    trainerId: string,
  ) => {
    const session: TrainerSession = {
      role: 'trainer',
      trainerId,
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      verificationStatus: nextStatus,
      verificationSubmittedAt: nextSubmittedAt ?? null,
      email: nextEmail,
    };
    await saveAppSession(db, session);
  };

  const resolveCurrentLogin = async () => {
    if (!accessToken) throw new Error('저장된 인증 세션이 없어요.');
    try {
      const login = await completeTrainerMagicLink(accessToken);
      return { login, accessToken, refreshToken };
    } catch (firstError) {
      if (!refreshToken) throw firstError;
      const refreshed = await refreshAuthSession(refreshToken);
      setAccessToken(refreshed.accessToken);
      setRefreshToken(refreshed.refreshToken);
      const login = await completeTrainerMagicLink(refreshed.accessToken);
      return {
        login,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
      };
    }
  };

  const checkStatus = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const resolved = await resolveCurrentLogin();
      const login = resolved.login;
      await persistTrainerSession(
        resolved.accessToken,
        resolved.refreshToken || undefined,
        login.verificationStatus,
        login.verificationSubmittedAt,
        login.email,
        login.trainerId,
      );

      setStatus(login.verificationStatus);
      setSubmittedAt(login.verificationSubmittedAt ?? '');
      setRejectionReason(login.rejectionReason ?? '');
      setEmail(login.email);
      setUserId(login.trainerId);

      if (login.verificationStatus === 'approved') {
        authorizeCurrentLaunch();
        router.replace('/trainer');
        return;
      }

      if (login.verificationStatus === 'rejected') {
        Alert.alert('인증이 반려됐어요', login.rejectionReason || '정보를 보완해 다시 신청해 주세요.');
        return;
      }

      Alert.alert('아직 승인 대기 중이에요', '관리자 검토가 끝나면 이 버튼으로 다시 확인하면 돼요.');
    } catch (error) {
      Alert.alert(
        '상태 확인 실패',
        error instanceof Error ? error.message : '승인 상태를 확인하지 못했어요.',
      );
    } finally {
      setBusy(false);
    }
  };

  const openGallery = async () => {
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('사진 권한 필요', '증빙서류 사진을 고르려면 사진 접근 권한이 필요해요.');
      return;
    }
    const result = await MediaLibrary.getAssetsAsync({
      first: 100,
      mediaType: ['photo'] as any,
      sortBy: ['creationTime'] as any,
    });
    setAssets(result.assets as Asset[]);
    setGalleryOpen(true);
  };

  const openCamera = async () => {
    let granted = cameraPermission?.granted ?? false;
    if (!granted) {
      const permission = await requestCameraPermission();
      granted = permission.granted;
    }
    if (!granted) {
      Alert.alert('카메라 권한 필요', '명함이나 재직증명서를 촬영하려면 카메라 권한이 필요해요.');
      return;
    }
    setCameraOpen(true);
  };

  const takePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (!photo?.uri) return;
      setDocumentUri(photo.uri);
      setDocumentName('verification-photo.jpg');
      setCameraOpen(false);
    } catch (error) {
      console.error(error);
      Alert.alert('촬영 실패', '사진을 촬영하지 못했어요. 다시 시도해 주세요.');
    }
  };

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !gymName.trim() || !documentUri) {
      Alert.alert('입력 확인', '이름, 연락처, 소속 센터와 증빙서류를 모두 입력해 주세요.');
      return;
    }
    if (!accessToken || !userId) {
      Alert.alert('인증 세션 없음', '저장된 로그인 인증 정보를 찾지 못했어요.');
      return;
    }

    setBusy(true);
    try {
      let token = accessToken;
      let nextRefreshToken = refreshToken;
      try {
        await completeTrainerMagicLink(token);
      } catch (firstError) {
        if (!refreshToken) throw firstError;
        const refreshed = await refreshAuthSession(refreshToken);
        token = refreshed.accessToken;
        nextRefreshToken = refreshed.refreshToken;
        setAccessToken(token);
        setRefreshToken(nextRefreshToken);
      }

      const uploaded = await uploadTrainerVerificationDocument(
        token,
        userId,
        documentUri,
        documentName || 'verification.jpg',
      );

      const submitted = new Date().toISOString();
      const response = await fetch(SUPABASE_URL + '/rest/v1/trainers?on_conflict=auth_user_id', {
        method: 'POST',
        headers: {
          ...supabaseHeaders(token),
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          auth_user_id: userId,
          name: name.trim(),
          email,
          phone: phone.trim(),
          gym_name: gymName.trim(),
          verification_status: 'pending',
          verification_document_path: uploaded.path,
          verification_document_name: uploaded.name,
          verification_submitted_at: submitted,
          verification_reviewed_at: null,
          verification_rejection_reason: null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as {
          message?: string;
          msg?: string;
          error?: string;
        };
        throw new Error(body.message || body.msg || body.error || '강사 인증 신청을 저장하지 못했어요.');
      }

      setStatus('pending');
      setSubmittedAt(submitted);
      setRejectionReason('');
      await persistTrainerSession(
        token,
        nextRefreshToken || undefined,
        'pending',
        submitted,
        email,
        userId,
      );
      Alert.alert('신청 완료', '이제 인증 메일을 다시 받을 필요 없어요. 관리자 승인 후 아래 버튼으로 확인하면 됩니다.');
    } catch (error) {
      Alert.alert('신청 실패', error instanceof Error ? error.message : '강사 인증 신청에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  const waiting = status === 'pending' && Boolean(submittedAt);

  if (loadingSession) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>인증 정보를 확인하고 있어요...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (waiting) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.waitingWrap}>
          <Text style={styles.eyebrow}>TRAINER VERIFICATION</Text>
          <Text style={styles.waitingTitle}>강사 인증 승인 대기 중</Text>
          <Text style={styles.waitingText}>
            신청 자료가 정상적으로 접수됐어요.{'
'}
            이메일 인증을 다시 할 필요 없이 관리자 승인 후 아래 버튼만 눌러주세요.
          </Text>
          <View style={styles.waitingInfo}>
            <Text style={styles.waitingInfoLabel}>로그인 이메일</Text>
            <Text style={styles.waitingInfoValue}>{email || '-'}</Text>
            <Text style={styles.waitingInfoLabel}>신청 시각</Text>
            <Text style={styles.waitingInfoValue}>
              {submittedAt ? new Date(submittedAt).toLocaleString('ko-KR') : '-'}
            </Text>
          </View>
          <Pressable
            style={[styles.submit, busy && styles.disabled]}
            onPress={() => void checkStatus()}
            disabled={busy}
          >
            <Text style={styles.submitText}>{busy ? '확인 중...' : '승인 상태 다시 확인'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.replace('/login')}>
            <Text style={styles.secondaryButtonText}>로그인 화면으로</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.replace('/login')}><Text style={styles.back}>‹ 로그인으로</Text></Pressable>
        <Text style={styles.eyebrow}>TRAINER VERIFICATION</Text>
        <Text style={styles.title}>강사 인증 신청</Text>
        <Text style={styles.description}>강사 기능은 관리자 승인 후 사용할 수 있어요. 재직증명서 또는 명함 등 현재 근무를 확인할 수 있는 자료를 제출해 주세요.</Text>
        {status === 'rejected' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>이전 신청이 반려됐어요.</Text>
            <Text style={styles.noticeText}>{rejectionReason || '정보를 보완해 다시 신청해 주세요.'}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>이메일</Text>
        <View style={styles.readonly}><Text style={styles.readonlyText}>{email}</Text></View>

        <Text style={styles.label}>이름</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="홍길동" />

        <Text style={styles.label}>연락처</Text>
        <TextInput value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" placeholder="010-0000-0000" />

        <Text style={styles.label}>소속 센터</Text>
        <TextInput value={gymName} onChangeText={setGymName} style={styles.input} placeholder="센터명" />

        <Text style={styles.label}>증빙서류</Text>
        <View style={styles.uploadBox}>
          <Text style={styles.uploadTitle}>재직증명서 또는 명함</Text>
          <Text style={styles.uploadText}>갤러리에서 선택하거나 지금 바로 촬영할 수 있어요.</Text>

          {documentUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: documentUri }} style={styles.preview} resizeMode="cover" />
              <View style={styles.previewMeta}>
                <Text style={styles.previewName} numberOfLines={1}>{documentName || '선택한 증빙서류'}</Text>
                <Pressable onPress={() => { setDocumentUri(null); setDocumentName(''); }}>
                  <Text style={styles.removeText}>삭제</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.emptyUpload}>
              <Text style={styles.emptyUploadIcon}>▧</Text>
              <Text style={styles.emptyUploadText}>아직 선택한 서류가 없어요.</Text>
            </View>
          )}

          <View style={styles.uploadActions}>
            <Pressable style={styles.uploadButton} onPress={() => void openGallery()}>
              <Text style={styles.uploadButtonText}>갤러리에서 선택</Text>
            </Pressable>
            <Pressable style={styles.cameraButton} onPress={() => void openCamera()}>
              <Text style={styles.cameraButtonText}>사진 촬영</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={[styles.submit, busy && styles.disabled]} onPress={() => void submit()} disabled={busy}>
          <Text style={styles.submitText}>{busy ? '업로드 및 신청 중...' : '강사 인증 신청하기'}</Text>
        </Pressable>
        <Text style={styles.privacy}>제출 자료는 강사 인증 확인 목적으로만 사용하고 비공개로 보관합니다.</Text>
      </ScrollView>

      <Modal visible={galleryOpen} animationType="slide" onRequestClose={() => setGalleryOpen(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setGalleryOpen(false)}><Text style={styles.modalBack}>닫기</Text></Pressable>
            <Text style={styles.modalTitle}>증빙서류 선택</Text>
            <View style={styles.modalSide} />
          </View>
          <ScrollView contentContainerStyle={styles.gallery}>
            {assets.map((asset) => (
              <Pressable
                key={asset.id}
                style={styles.assetButton}
                onPress={() => {
                  setDocumentUri(asset.uri);
                  setDocumentName(asset.filename || 'verification-photo.jpg');
                  setGalleryOpen(false);
                }}
              >
                <Image source={{ uri: asset.uri }} style={styles.assetImage} />
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <SafeAreaView style={styles.cameraSafe}>
          <View style={styles.modalHeaderDark}>
            <Pressable onPress={() => setCameraOpen(false)}><Text style={styles.modalBackLight}>취소</Text></Pressable>
            <Text style={styles.modalTitleLight}>증빙서류 촬영</Text>
            <View style={styles.modalSide} />
          </View>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <View style={styles.cameraControls}>
            <Text style={styles.cameraHint}>명함이나 재직증명서가 화면 안에 잘 보이게 촬영해 주세요.</Text>
            <Pressable style={styles.shutterOuter} onPress={() => void takePhoto()}>
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 24, paddingBottom: 48 },
  back: { fontSize: 13, fontWeight: '800', color: '#737B87', marginBottom: 28 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#4058D6' },
  title: { marginTop: 6, fontSize: 26, fontWeight: '900', color: '#252A32' },
  description: { marginTop: 10, fontSize: 13, lineHeight: 20, color: '#7C8490' },
  notice: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#FFF3F3' },
  noticeTitle: { fontSize: 13, fontWeight: '900', color: '#A44E4E' },
  noticeText: { marginTop: 5, fontSize: 12, lineHeight: 18, color: '#A86A6A' },
  label: { marginTop: 18, marginBottom: 7, fontSize: 12, fontWeight: '800', color: '#4B525C' },
  input: { height: 50, borderWidth: 1, borderColor: '#E0E4EA', borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#FFFFFF', color: '#252A32' },
  readonly: { height: 50, justifyContent: 'center', borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#ECEFF4' },
  readonlyText: { fontSize: 14, color: '#606874' },
  uploadBox: { padding: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C8CED8', borderRadius: 16, backgroundColor: '#FFFFFF' },
  uploadTitle: { fontSize: 14, fontWeight: '900', color: '#343A44' },
  uploadText: { marginTop: 6, fontSize: 11, lineHeight: 17, color: '#8A919C' },
  emptyUpload: { minHeight: 110, marginTop: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F8FB' },
  emptyUploadIcon: { fontSize: 28, color: '#A9B0BC' },
  emptyUploadText: { marginTop: 8, fontSize: 11, fontWeight: '700', color: '#9299A5' },
  previewWrap: { marginTop: 14, overflow: 'hidden', borderRadius: 14, backgroundColor: '#F6F8FB' },
  preview: { width: '100%', height: 180, backgroundColor: '#E8EBF0' },
  previewMeta: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  previewName: { flex: 1, fontSize: 11, fontWeight: '800', color: '#5D6571' },
  removeText: { marginLeft: 10, fontSize: 11, fontWeight: '900', color: '#D05462' },
  uploadActions: { marginTop: 14, flexDirection: 'row', gap: 10 },
  uploadButton: { flex: 1, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1FF' },
  uploadButtonText: { fontSize: 12, fontWeight: '900', color: '#4058D6' },
  cameraButton: { flex: 1, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#252A32' },
  cameraButtonText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  submit: { height: 54, marginTop: 24, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4058D6' },
  submitText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  privacy: { marginTop: 12, textAlign: 'center', fontSize: 10, lineHeight: 16, color: '#989FA9' },
  disabled: { opacity: 0.5 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 13, fontWeight: '700', color: '#7C8490' },
  waitingWrap: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', justifyContent: 'center', padding: 28 },
  waitingTitle: { marginTop: 8, fontSize: 27, fontWeight: '900', color: '#252A32' },
  waitingText: { marginTop: 12, fontSize: 13, lineHeight: 21, color: '#747C88' },
  waitingInfo: { marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF' },
  waitingInfoLabel: { marginTop: 7, fontSize: 10, fontWeight: '900', color: '#9AA1AB' },
  waitingInfoValue: { marginTop: 3, fontSize: 13, fontWeight: '800', color: '#3D444E' },
  secondaryButton: { height: 48, marginTop: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9ECF1' },
  secondaryButtonText: { fontSize: 13, fontWeight: '900', color: '#656D79' },
  modalHeader: { height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4E7EC' },
  modalBack: { width: 72, fontSize: 14, fontWeight: '800', color: '#4058D6' },
  modalTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '900', color: '#252A32' },
  modalSide: { width: 72 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', padding: 3 },
  assetButton: { width: '25%', aspectRatio: 1, padding: 2 },
  assetImage: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: '#E5E7EB' },
  cameraSafe: { flex: 1, backgroundColor: '#000000' },
  modalHeaderDark: { height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#111318' },
  modalBackLight: { width: 72, fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  modalTitleLight: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '900', color: '#FFFFFF' },
  camera: { flex: 1 },
  cameraControls: { padding: 18, paddingBottom: 26, alignItems: 'center', backgroundColor: '#111318' },
  cameraHint: { marginBottom: 16, textAlign: 'center', fontSize: 11, lineHeight: 17, color: '#C7CCD4' },
  shutterOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF' },
});
