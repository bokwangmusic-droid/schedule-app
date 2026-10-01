import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SUPABASE_URL, supabaseHeaders } from '../src/remote/supabaseConfig';

export default function TrainerVerificationScreen() {
  const params = useLocalSearchParams<{ accessToken?: string; userId?: string; email?: string; status?: string; rejectionReason?: string }>();
  const accessToken = String(params.accessToken ?? '');
  const userId = String(params.userId ?? '');
  const email = String(params.email ?? '');
  const status = String(params.status ?? 'pending');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gymName, setGymName] = useState('');
  const [documentPath, setDocumentPath] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !gymName.trim() || !documentPath.trim()) {
      Alert.alert('입력 확인', '이름, 연락처, 소속 센터와 증빙서류 경로를 모두 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/trainers?on_conflict=auth_user_id', {
        method: 'POST',
        headers: {
          ...supabaseHeaders(accessToken),
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          auth_user_id: userId,
          name: name.trim(),
          email,
          phone: phone.trim(),
          gym_name: gymName.trim(),
          verification_status: 'pending',
          verification_document_path: documentPath.trim(),
          verification_document_name: documentPath.trim().split('/').pop() ?? '증빙서류',
          verification_submitted_at: new Date().toISOString(),
          verification_reviewed_at: null,
          verification_rejection_reason: null,
        }),
      });
      if (!response.ok) throw new Error('강사 인증 신청을 저장하지 못했어요.');
      Alert.alert('신청 완료', '강사 인증 신청이 접수됐어요. 관리자 승인 후 강사 기능을 이용할 수 있습니다.');
      router.replace('/login');
    } catch (error) {
      Alert.alert('신청 실패', error instanceof Error ? error.message : '강사 인증 신청에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'pending' && userId && email) {
    // New auth users also arrive as pending before their first application, so the form stays available.
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.replace('/login')}><Text style={styles.back}>‹ 로그인으로</Text></Pressable>
        <Text style={styles.eyebrow}>TRAINER VERIFICATION</Text>
        <Text style={styles.title}>강사 인증 신청</Text>
        <Text style={styles.description}>강사 기능은 관리자 승인 후 사용할 수 있어요. 재직증명서 또는 명함 등 현재 근무를 확인할 수 있는 자료를 제출해 주세요.</Text>
        {status === 'rejected' ? <View style={styles.notice}><Text style={styles.noticeTitle}>이전 신청이 반려됐어요.</Text><Text style={styles.noticeText}>{String(params.rejectionReason ?? '') || '정보를 보완해 다시 신청해 주세요.'}</Text></View> : null}
        <Text style={styles.label}>이메일</Text><View style={styles.readonly}><Text style={styles.readonlyText}>{email}</Text></View>
        <Text style={styles.label}>이름</Text><TextInput value={name} onChangeText={setName} style={styles.input} placeholder="홍길동" />
        <Text style={styles.label}>연락처</Text><TextInput value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" placeholder="010-0000-0000" />
        <Text style={styles.label}>소속 센터</Text><TextInput value={gymName} onChangeText={setGymName} style={styles.input} placeholder="센터명" />
        <Text style={styles.label}>증빙서류</Text>
        <View style={styles.uploadBox}>
          <Text style={styles.uploadTitle}>재직증명서 또는 명함</Text>
          <Text style={styles.uploadText}>현재 단계에서는 비공개 Storage에 올린 파일 경로를 연결합니다. 파일 선택 UI는 다음 단계에서 연결됩니다.</Text>
          <TextInput value={documentPath} onChangeText={setDocumentPath} style={styles.pathInput} placeholder={userId ? userId + '/document.jpg' : '파일 경로'} autoCapitalize="none" />
        </View>
        <Pressable style={[styles.submit, busy && styles.disabled]} onPress={() => void submit()} disabled={busy}>
          <Text style={styles.submitText}>{busy ? '신청 중...' : '강사 인증 신청하기'}</Text>
        </Pressable>
        <Text style={styles.privacy}>제출 자료는 강사 인증 확인 목적으로만 사용하고 비공개로 보관합니다.</Text>
      </ScrollView>
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
  pathInput: { height: 44, marginTop: 12, borderWidth: 1, borderColor: '#E1E5EA', borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#FAFBFC' },
  submit: { height: 54, marginTop: 24, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4058D6' },
  submitText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  privacy: { marginTop: 12, textAlign: 'center', fontSize: 10, lineHeight: 16, color: '#989FA9' },
  disabled: { opacity: 0.5 },
});
