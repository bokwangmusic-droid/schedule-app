import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authorizeCurrentLaunch, saveAppSession } from '../src/auth/appSession';
import { isSupabaseConfigured } from '../src/remote/supabaseConfig';
import { requestMemberMagicLink } from '../src/remote/supabaseAuth';

type LoginMode = 'select' | 'trainer' | 'member';

export default function LoginScreen() {
  const db = useSQLiteContext();
  const [mode, setMode] = useState<LoginMode>('select');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const remoteConfigured = isSupabaseConfigured();

  const enterTrainerMode = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveAppSession(db, { role: 'trainer', trainerId: 'local-trainer' });
      authorizeCurrentLaunch();
      router.replace('/trainer');
    } finally {
      setBusy(false);
    }
  };

  const sendMemberMagicLink = async () => {
    if (!remoteConfigured || busy) return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      await requestMemberMagicLink(email);
      Alert.alert(
        '로그인 메일을 보냈어요',
        '메일에서 로그인 링크를 누르면 비케이짐 앱으로 돌아와 로그인됩니다.',
      );
    } catch (error) {
      console.error(error);
      Alert.alert(
        '전송 실패',
        error instanceof Error ? error.message : '로그인 메일을 보내지 못했어요.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <View style={styles.logo}><Text style={styles.logoText}>BK</Text></View>
            <Text style={styles.brand}>비케이짐</Text>
            <Text style={styles.subtitle}>수업과 운동 기록을 한곳에서 관리하세요.</Text>
          </View>

          {mode === 'select' ? (
            <View style={styles.roleGroup}>
              <Pressable style={styles.trainerCard} onPress={() => setMode('trainer')}>
                <View>
                  <Text style={styles.roleEyebrow}>TRAINER</Text>
                  <Text style={styles.roleTitle}>강사 로그인</Text>
                  <Text style={styles.roleText}>시간표 · 회원 · 수업 기록 관리</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>

              <Pressable style={styles.memberCard} onPress={() => setMode('member')}>
                <View>
                  <Text style={[styles.roleEyebrow, styles.memberEyebrow]}>MEMBER</Text>
                  <Text style={styles.roleTitle}>회원 로그인</Text>
                  <Text style={styles.roleText}>내 일정 · 운동 기록 · 인바디 확인</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.loginCard}>
              <Pressable style={styles.backRow} onPress={() => setMode('select')}>
                <Text style={styles.backText}>‹ 로그인 선택으로</Text>
              </Pressable>

              <Text style={styles.formEyebrow}>{mode === 'trainer' ? 'TRAINER' : 'MEMBER'}</Text>
              <Text style={styles.formTitle}>{mode === 'trainer' ? '강사 로그인' : '회원 로그인'}</Text>

              {mode === 'trainer' ? (
                <>
                  <Text style={styles.formText}>강사용 시간표와 회원 관리 화면으로 이동합니다.</Text>
                  <Pressable
                    style={[styles.primaryButton, busy && styles.disabled]}
                    onPress={() => void enterTrainerMode()}
                    disabled={busy}
                  >
                    <Text style={styles.primaryButtonText}>{busy ? '접속 중...' : '강사 화면으로 들어가기'}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.formText}>등록된 이메일로 로그인 링크를 받아주세요.</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="이메일 주소"
                    placeholderTextColor="#A7ADB6"
                    editable={!busy}
                    returnKeyType="send"
                    onSubmitEditing={() => void sendMemberMagicLink()}
                    style={styles.input}
                  />
                  <Pressable
                    style={[styles.memberButton, (!remoteConfigured || busy) && styles.disabled]}
                    onPress={() => void sendMemberMagicLink()}
                    disabled={!remoteConfigured || busy}
                  >
                    <Text style={styles.primaryButtonText}>{busy ? '전송 중...' : '로그인 링크 받기'}</Text>
                  </Pressable>
                  {!remoteConfigured ? (
                    <Text style={styles.errorText}>회원 로그인 서버 연결을 확인해 주세요.</Text>
                  ) : null}
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F6F8' },
  keyboardAvoider: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 32 },
  brandBlock: { alignItems: 'center', marginBottom: 34 },
  logo: {
    width: 70,
    height: 70,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4058D6',
  },
  logoText: { fontSize: 25, fontWeight: '900', color: '#FFFFFF' },
  brand: { marginTop: 15, fontSize: 27, fontWeight: '900', color: '#20242C' },
  subtitle: { marginTop: 7, fontSize: 13, color: '#858C97' },
  roleGroup: { gap: 13 },
  trainerCard: {
    minHeight: 112,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  memberCard: {
    minHeight: 112,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  roleEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#4058D6' },
  memberEyebrow: { color: '#2F7F5E' },
  roleTitle: { marginTop: 5, fontSize: 20, fontWeight: '900', color: '#252A32' },
  roleText: { marginTop: 7, fontSize: 12, color: '#858C97' },
  arrow: { fontSize: 32, fontWeight: '300', color: '#A5ABB4' },
  loginCard: { padding: 20, borderRadius: 24, backgroundColor: '#FFFFFF' },
  backRow: { alignSelf: 'flex-start', paddingVertical: 4, paddingRight: 12 },
  backText: { fontSize: 12, fontWeight: '800', color: '#737B87' },
  formEyebrow: { marginTop: 24, fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#4058D6' },
  formTitle: { marginTop: 5, fontSize: 22, fontWeight: '900', color: '#252A32' },
  formText: { marginTop: 8, fontSize: 13, lineHeight: 19, color: '#7C8490' },
  input: {
    height: 52,
    marginTop: 20,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E0E4EA',
    borderRadius: 15,
    fontSize: 15,
    color: '#2C3139',
    backgroundColor: '#FAFBFC',
  },
  primaryButton: {
    height: 52,
    marginTop: 22,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4058D6',
  },
  memberButton: {
    height: 52,
    marginTop: 11,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2F7F5E',
  },
  primaryButtonText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  errorText: { marginTop: 10, fontSize: 11, lineHeight: 16, color: '#B65C5C' },
  disabled: { opacity: 0.5 },
});
