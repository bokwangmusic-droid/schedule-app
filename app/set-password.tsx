import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  authorizeCurrentLaunch,
  clearAppSession,
  getAppSession,
  memberHomeRoute,
  saveAppSession,
  type AppSession,
} from '../src/auth/appSession';
import { setAuthPassword } from '../src/remote/supabaseAuth';

export default function SetPasswordScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ afterLogout?: string }>();
  const afterLogout = params.afterLogout === '1';
  const [session, setSession] = useState<AppSession | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getAppSession(db)
      .then((saved) => {
        if (!active) return;
        setSession(saved);
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, [db]);

  const savePassword = async () => {
    if (busy) return;
    if (!session?.accessToken) {
      Alert.alert('인증 필요', '다시 이메일 인증을 진행해 주세요.');
      router.replace('/login');
      return;
    }
    if (password.length < 8) {
      Alert.alert('비밀번호 확인', '비밀번호는 8자 이상으로 설정해 주세요.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('비밀번호 확인', '비밀번호가 서로 일치하지 않아요.');
      return;
    }

    setBusy(true);
    try {
      await setAuthPassword(session.accessToken, password);
      const nextSession = { ...session, passwordReady: true } as AppSession;
      await saveAppSession(db, nextSession);

      if (afterLogout) {
        await clearAppSession(db);
        Alert.alert('비밀번호 설정 완료', '이제 이메일과 비밀번호로 로그인할 수 있어요.');
        router.replace('/login');
        return;
      }

      if (nextSession.role === 'trainer') {
        if (nextSession.verificationStatus === 'approved') {
          authorizeCurrentLaunch();
          router.replace('/trainer');
          return;
        }
        router.replace({
          pathname: '/trainer-verification' as never,
          params: {
            status: nextSession.verificationStatus ?? 'pending',
            submittedAt: nextSession.verificationSubmittedAt ?? '',
          },
        } as never);
        return;
      }

      authorizeCurrentLaunch();
      router.replace(memberHomeRoute(nextSession.memberId) as never);
    } catch (error) {
      console.error(error);
      Alert.alert(
        '비밀번호 설정 실패',
        error instanceof Error ? error.message : '비밀번호를 설정하지 못했어요.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          <Text style={styles.eyebrow}>FITMODU ACCOUNT</Text>
          <Text style={styles.title}>비밀번호 만들기</Text>
          <Text style={styles.description}>
            이메일 인증은 처음 한 번만 하면 돼요. 비밀번호를 만들면 다음부터는 이메일과 비밀번호로 바로 로그인할 수 있어요.
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="비밀번호 8자 이상"
            placeholderTextColor="#A7ADB6"
            editable={!busy}
            style={styles.input}
          />
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="비밀번호 확인"
            placeholderTextColor="#A7ADB6"
            editable={!busy}
            returnKeyType="done"
            onSubmitEditing={() => void savePassword()}
            style={[styles.input, styles.confirmInput]}
          />

          <Pressable
            style={[styles.button, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void savePassword()}
          >
            <Text style={styles.buttonText}>{busy ? '설정 중...' : '비밀번호 설정'}</Text>
          </Pressable>

          {afterLogout ? (
            <Text style={styles.note}>설정이 끝나면 로그아웃되고 새 비밀번호로 다시 로그인할 수 있어요.</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F6F8' },
  container: { flex: 1, justifyContent: 'center', padding: 22 },
  card: { padding: 22, borderRadius: 24, backgroundColor: '#FFFFFF' },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#177B78' },
  title: { marginTop: 6, fontSize: 24, fontWeight: '900', color: '#252A32' },
  description: { marginTop: 10, fontSize: 13, lineHeight: 20, color: '#7C8490' },
  input: {
    height: 52,
    marginTop: 22,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E0E4EA',
    borderRadius: 15,
    fontSize: 15,
    color: '#2C3139',
    backgroundColor: '#FAFBFC',
  },
  confirmInput: { marginTop: 10 },
  button: {
    height: 52,
    marginTop: 18,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#177B78',
  },
  buttonText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  note: { marginTop: 12, fontSize: 11, lineHeight: 17, textAlign: 'center', color: '#858C97' },
  disabled: { opacity: 0.5 },
});
