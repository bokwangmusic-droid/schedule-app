import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  authorizeCurrentLaunch,
  clearPendingAuthFlow,
  getPendingAuthFlow,
  memberHomeRoute,
  saveAppSession,
} from '../src/auth/appSession';
import { captureAuthUrl, consumeCapturedAuthUrl } from '../src/auth/deepLinkInbox';
import { syncMemberSnapshot } from '../src/remote/memberSync';
import { completeMemberMagicLink, completeTrainerMagicLink } from '../src/remote/supabaseAuth';

function getParam(url: string, key: string) {
  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');
  const query = queryIndex >= 0
    ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
    : '';
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryParams = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);
  return queryParams.get(key) ?? hashParams.get(key);
}

export default function AuthCallbackScreen() {
  const db = useSQLiteContext();
  const [message, setMessage] = useState('로그인을 확인하고 있어요.');
  const [detail, setDetail] = useState('링크 정보를 읽는 중이에요.');
  const [busy, setBusy] = useState(true);
  const handledUrlRef = useRef<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const withTimeout = async <T,>(label: string, work: Promise<T>, ms = 10000): Promise<T> => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race([
          work,
          new Promise<T>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(label + ' 시간이 초과됐어요.')), ms);
          }),
        ]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    const finish = async (url: string | null) => {
      if (!url || !active) return;
      lastUrlRef.current = url;
      if (handledUrlRef.current === url) return;
      handledUrlRef.current = url;
      try {
        setDetail('로그인 링크를 확인하는 중이에요.');
        const errorDescription = getParam(url, 'error_description');
        if (errorDescription) throw new Error(decodeURIComponent(errorDescription));

        let accessToken = getParam(url, 'access_token');
        const tokenHash = getParam(url, 'token_hash');
        const tokenType = getParam(url, 'type') ?? 'email';
        const pendingFlow = await getPendingAuthFlow(db);
        if (!accessToken && tokenHash) {
          setDetail('이메일 인증 정보를 확인하는 중이에요.');
          const verifyResponse = await withTimeout(
            '이메일 인증',
            fetch(process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '') + '/auth/v1/verify', {
              method: 'POST',
              headers: {
                apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ token_hash: tokenHash, type: tokenType }),
            }),
          );
          if (!verifyResponse.ok) {
            const body = await verifyResponse.json().catch(() => ({})) as { msg?: string; message?: string; error_description?: string };
            throw new Error(body.msg || body.message || body.error_description || '이메일 인증에 실패했어요.');
          }
          const verified = await verifyResponse.json() as { access_token?: string };
          accessToken = verified.access_token ?? null;
        }
        if (!accessToken) {
          const code = getParam(url, 'code');
          if (code && pendingFlow?.codeVerifier) {
            setDetail('인증 코드를 로그인 세션으로 바꾸는 중이에요.');
            const tokenResponse = await withTimeout(
              '로그인 세션 교환',
              fetch(
                process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '') +
                  '/auth/v1/token?grant_type=pkce',
                {
                  method: 'POST',
                  headers: {
                    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    auth_code: code,
                    code_verifier: pendingFlow.codeVerifier,
                  }),
                },
              ),
            );
            if (!tokenResponse.ok) {
              const body = await tokenResponse.json().catch(() => ({})) as {
                msg?: string;
                message?: string;
                error_description?: string;
              };
              throw new Error(
                body.msg ||
                  body.message ||
                  body.error_description ||
                  '인증 코드를 로그인 세션으로 바꾸지 못했어요.',
              );
            }
            const tokenBody = await tokenResponse.json() as { access_token?: string };
            accessToken = tokenBody.access_token ?? null;
          }
        }

        if (!accessToken) {
          setMessage('로그인 링크를 확인하지 못했어요.');
          setDetail('새 인증 메일을 받은 뒤 가장 최신 링크를 다시 눌러 주세요.');
          setBusy(false);
          return;
        }

        const role = getParam(url, 'role') ?? pendingFlow?.role ?? null;
        if (role === 'trainer') {
          setDetail('강사 인증 상태를 확인하는 중이에요.');
          const login = await withTimeout('강사 인증 확인', completeTrainerMagicLink(accessToken));
          if (login.verificationStatus === 'approved') {
            await saveAppSession(db, {
              role: 'trainer',
              trainerId: login.trainerId,
              accessToken: login.accessToken,
            });
            await clearPendingAuthFlow(db);
            authorizeCurrentLaunch();
            router.replace('/trainer');
            return;
          }
          router.replace({
            pathname: '/trainer-verification' as never,
            params: {
              accessToken: login.accessToken,
              userId: login.userId,
              email: login.email,
              status: login.verificationStatus,
              rejectionReason: login.rejectionReason ?? '',
            },
          } as never);
          return;
        }

        setDetail('Supabase 회원 인증을 확인하는 중이에요.');
        const login = await withTimeout('회원 인증 확인', completeMemberMagicLink(accessToken));

        setDetail('회원 데이터를 불러오는 중이에요.');
        await withTimeout('회원 데이터 동기화', syncMemberSnapshot(db, login.accessToken, login.memberId), 15000);

        setDetail('로그인 정보를 저장하는 중이에요.');
        await saveAppSession(db, {
          role: 'member',
          memberId: login.memberId,
          accessToken: login.accessToken,
        });
        await clearPendingAuthFlow(db);
        authorizeCurrentLaunch();

        setDetail('회원 화면으로 이동하고 있어요.');
        router.replace(memberHomeRoute(login.memberId) as never);
      } catch (error) {
        console.error(error);
        if (active) {
          setMessage('로그인을 완료하지 못했어요.');
          setDetail(error instanceof Error ? error.message : '회원 로그인을 완료하지 못했어요.');
          setBusy(false);
        }
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      captureAuthUrl(url);
      void finish(url);
    });

    const capturedUrl = consumeCapturedAuthUrl();
    if (capturedUrl) {
      void finish(capturedUrl);
    }

    void Linking.getInitialURL().then((url) => {
      if (url) {
        captureAuthUrl(url);
        void finish(url);
      }
      setTimeout(() => {
        if (!active || lastUrlRef.current) return;
        const queuedUrl = consumeCapturedAuthUrl();
        if (queuedUrl) {
          void finish(queuedUrl);
          return;
        }
        void Linking.getInitialURL().then((retryUrl) => {
          if (retryUrl) {
            captureAuthUrl(retryUrl);
            void finish(retryUrl);
          } else if (active) {
            setMessage('로그인 링크를 확인하지 못했어요.');
            setDetail('앱에서 새 인증 메일을 받은 뒤 최신 링크를 다시 눌러 주세요.');
            setBusy(false);
          }
        });
      }, 700);
    }).catch((error) => {
      console.error(error);
      if (active) {
        setMessage('로그인 링크를 읽지 못했어요.');
        setDetail('로그인 화면으로 돌아가 새 인증 메일을 받아 주세요.');
        setBusy(false);
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [db]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        {busy ? <ActivityIndicator color="#177B78" /> : null}
        <Text style={styles.title}>핏모두 로그인</Text>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.detail}>{detail}</Text>
        {!busy ? (
          <Pressable style={styles.backButton} onPress={() => router.replace('/login')}>
            <Text style={styles.backButtonText}>로그인 화면으로 돌아가기</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6FA' },
  center: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 16, fontSize: 19, fontWeight: '900', color: '#252A32' },
  message: { marginTop: 9, fontSize: 12, lineHeight: 18, textAlign: 'center', color: '#7C8490' },
  detail: { marginTop: 6, fontSize: 11, lineHeight: 17, textAlign: 'center', color: '#9AA1AC' },
  backButton: { marginTop: 18, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: '#177B78' },
  backButtonText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
});
