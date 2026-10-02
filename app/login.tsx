import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Image,
  Platform,
  Pressable,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authorizeCurrentLaunch, getAppSession, saveAppSession, type TrainerSession } from '../src/auth/appSession';
import { isSupabaseConfigured } from '../src/remote/supabaseConfig';
import { completeTrainerMagicLink, refreshAuthSession, requestMemberMagicLink, requestTrainerMagicLink } from '../src/remote/supabaseAuth';

type LoginMode = 'select' | 'trainer' | 'member';

export default function LoginScreen() {
  const db = useSQLiteContext();
  const [mode, setMode] = useState<LoginMode>('select');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedTrainerSession, setSavedTrainerSession] = useState<TrainerSession | null>(null);
  const remoteConfigured = isSupabaseConfigured();
  const qaTrainerEnabled = true;

  useEffect(() => {
    let active = true;
    void getAppSession(db).then((session) => {
      if (!active) return;
      if (session?.role === 'trainer' && session.accessToken) {
        setSavedTrainerSession(session);
      }
    }).catch(console.error);
    return () => { active = false; };
  }, [db]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mode !== 'select') {
        Keyboard.dismiss();
        setMode('select');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [mode]);

  const enterQaTrainer = async () => {
    if (!qaTrainerEnabled || busy) return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      await saveAppSession(db, { role: 'trainer', trainerId: 'local-qa-trainer' });
      authorizeCurrentLaunch();
      router.replace('/trainer');
    } catch (error) {
      console.error(error);
      Alert.alert('테스트 입장 실패', '강사 화면을 열지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const resumeTrainerVerification = async () => {
    const saved = savedTrainerSession;
    if (!saved?.accessToken || busy) return;
    setBusy(true);
    try {
      let token = saved.accessToken;
      let nextRefreshToken = saved.refreshToken;

      let login;
      try {
        login = await completeTrainerMagicLink(token);
      } catch (firstError) {
        if (!saved.refreshToken) throw firstError;
        const refreshed = await refreshAuthSession(saved.refreshToken);
        token = refreshed.accessToken;
        nextRefreshToken = refreshed.refreshToken;
        login = await completeTrainerMagicLink(token);
      }

      const nextSession: TrainerSession = {
        role: 'trainer',
        trainerId: login.trainerId,
        accessToken: token,
        refreshToken: nextRefreshToken,
        verificationStatus: login.verificationStatus,
        verificationSubmittedAt: login.verificationSubmittedAt ?? null,
        email: login.email,
      };
      await saveAppSession(db, nextSession);
      setSavedTrainerSession(nextSession);

      if (login.verificationStatus === 'approved') {
        authorizeCurrentLaunch();
        router.replace('/trainer');
        return;
      }

      router.replace({
        pathname: '/trainer-verification' as never,
        params: {
          status: login.verificationStatus,
          submittedAt: login.verificationSubmittedAt ?? '',
          rejectionReason: login.rejectionReason ?? '',
        },
      } as never);
    } catch (error) {
      console.error(error);
      Alert.alert(
        '이전 인증 확인 실패',
        error instanceof Error
          ? error.message
          : '저장된 인증 세션을 확인하지 못했어요.',
      );
    } finally {
      setBusy(false);
    }
  };

  const sendTrainerMagicLink = async () => {
    if (!remoteConfigured || busy) return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      await requestTrainerMagicLink(db, email);
      Alert.alert('인증 메일을 보냈어요', '메일의 링크를 눌러 강사 가입/로그인을 계속해 주세요.');
    } catch (error) {
      console.error(error);
      Alert.alert('전송 실패', error instanceof Error ? error.message : '인증 메일을 보내지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const sendMemberMagicLink = async () => {
    if (!remoteConfigured || busy) return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      await requestMemberMagicLink(db, email);
      Alert.alert(
        '로그인 메일을 보냈어요',
        '메일에서 로그인 링크를 누르면 핏모두 앱으로 돌아와 로그인됩니다.',
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
            <Image source={require('../assets/icon.png')} style={styles.logoImage} />
            <Text style={styles.brand}>핏모두</Text>
            <Text style={styles.subtitle}>강사와 회원의 피트니스를 한곳에서 관리하세요.</Text>
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
                  <Text style={styles.formText}>이메일 인증 후 강사 인증을 신청할 수 있어요.</Text>
                  {savedTrainerSession?.accessToken ? (
                    <View style={styles.resumeCard}>
                      <Text style={styles.resumeTitle}>이전에 인증한 강사 계정이 있어요.</Text>
                      <Text style={styles.resumeText}>
                        이메일을 다시 받지 않고 승인 상태를 확인하거나 신청을 이어갈 수 있어요.
                      </Text>
                      <Pressable
                        style={[styles.resumeButton, busy && styles.disabled]}
                        disabled={busy}
                        onPress={() => void resumeTrainerVerification()}
                      >
                        <Text style={styles.resumeButtonText}>
                          {busy ? '확인 중...' : '이전 인증 계속하기'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
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
                    onSubmitEditing={() => void sendTrainerMagicLink()}
                    style={styles.input}
                  />
                  <Pressable
                    style={[styles.primaryButton, (!remoteConfigured || busy) && styles.disabled]}
                    onPress={() => void sendTrainerMagicLink()}
                    disabled={!remoteConfigured || busy}
                  >
                    <Text style={styles.primaryButtonText}>{busy ? '전송 중...' : '이메일 인증하기'}</Text>
                  </Pressable>
                  <Text style={styles.helperText}>처음 가입하는 강사는 인증 후 재직증명서 또는 명함을 제출하고 승인을 받아야 해요.</Text>
                  {qaTrainerEnabled ? (
                    <>
                      <View style={styles.qaDivider} />
                      <Text style={styles.qaLabel}>개발 테스트 전용</Text>
                      <Pressable
                        style={[styles.qaButton, busy && styles.disabled]}
                        onPress={() => void enterQaTrainer()}
                        disabled={busy}
                      >
                        <Text style={styles.qaButtonText}>이메일 없이 강사 화면 테스트</Text>
                      </Pressable>
                      <Text style={styles.qaHelp}>테스트용 임시 입장입니다. 정식 출시 전에는 제거할 예정이에요.</Text>
                    </>
                  ) : null}
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
  logoImage: {
    width: 82,
    height: 82,
    borderRadius: 24,
  },
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
  roleEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#177B78' },
  memberEyebrow: { color: '#F07A63' },
  roleTitle: { marginTop: 5, fontSize: 20, fontWeight: '900', color: '#252A32' },
  roleText: { marginTop: 7, fontSize: 12, color: '#858C97' },
  arrow: { fontSize: 32, fontWeight: '300', color: '#A5ABB4' },
  loginCard: { padding: 20, borderRadius: 24, backgroundColor: '#FFFFFF' },
  backRow: { alignSelf: 'flex-start', paddingVertical: 4, paddingRight: 12 },
  backText: { fontSize: 12, fontWeight: '800', color: '#737B87' },
  formEyebrow: { marginTop: 24, fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#177B78' },
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
    backgroundColor: '#177B78',
  },
  memberButton: {
    height: 52,
    marginTop: 11,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F07A63',
  },
  primaryButtonText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  errorText: { marginTop: 10, fontSize: 11, lineHeight: 16, color: '#B65C5C' },
  helperText: { marginTop: 12, fontSize: 11, lineHeight: 17, color: '#858C97' },
  resumeCard: { marginTop: 16, padding: 14, borderRadius: 15, backgroundColor: '#EEF7F6' },
  resumeTitle: { fontSize: 12, fontWeight: '900', color: '#176B68' },
  resumeText: { marginTop: 5, fontSize: 11, lineHeight: 17, color: '#5F7775' },
  resumeButton: { height: 44, marginTop: 11, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#177B78' },
  resumeButtonText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  qaDivider: { height: 1, marginTop: 20, backgroundColor: '#ECEFF3' },
  qaLabel: { marginTop: 14, fontSize: 10, fontWeight: '900', color: '#9A6B28' },
  qaButton: {
    height: 46,
    marginTop: 8,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4E8D4',
  },
  qaButtonText: { fontSize: 12, fontWeight: '900', color: '#7A531E' },
  qaHelp: { marginTop: 8, fontSize: 10, lineHeight: 15, color: '#9A8B78' },
  disabled: { opacity: 0.5 },
});
