import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  authorizeCurrentLaunch,
  memberHomeRoute,
  saveAppSession,
} from '../src/auth/appSession';
import { syncMemberSnapshot } from '../src/remote/memberSync';
import { completeMemberMagicLink } from '../src/remote/supabaseAuth';

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
      try {
        setDetail('로그인 링크를 확인하는 중이에요.');
        const errorDescription = getParam(url, 'error_description');
        if (errorDescription) throw new Error(decodeURIComponent(errorDescription));

        const accessToken = getParam(url, 'access_token');
        if (!accessToken) {
          setMessage('로그인 링크를 확인하지 못했어요.');
          setDetail('앱에서 새 로그인 메일을 받은 뒤 최신 링크를 다시 눌러 주세요.');
          return;
        }

        setDetail('Supabase 회원 인증을 확인하는 중이에요.');
        const login = await withTimeout(
          '회원 인증 확인',
          completeMemberMagicLink(accessToken),
        );

        setDetail('회원 데이터를 불러오는 중이에요.');
        await withTimeout(
          '회원 데이터 동기화',
          syncMemberSnapshot(db, login.accessToken, login.memberId),
          15000,
        );

        setDetail('로그인 정보를 저장하는 중이에요.');
        await saveAppSession(db, { role: 'member', memberId: login.memberId });
        authorizeCurrentLaunch();

        setDetail('회원 화면으로 이동하고 있어요.');
        router.replace(memberHomeRoute(login.memberId) as never);
      } catch (error) {
        console.error(error);
        if (active) {
          setMessage('로그인을 완료하지 못했어요.');
          setDetail(error instanceof Error ? error.message : '회원 로그인을 완료하지 못했어요.');
        }
      }
    };

    void Linking.getInitialURL().then(finish);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void finish(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [db]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        <ActivityIndicator color="#4058D6" />
        <Text style={styles.title}>비케이짐 회원 로그인</Text>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.detail}>{detail}</Text>
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
});
