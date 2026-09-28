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

  useEffect(() => {
    let active = true;

    const finish = async (url: string | null) => {
      if (!url || !active) return;
      try {
        const errorDescription = getParam(url, 'error_description');
        if (errorDescription) throw new Error(decodeURIComponent(errorDescription));

        const accessToken = getParam(url, 'access_token');
        if (!accessToken) {
          setMessage('로그인 링크를 확인하지 못했어요. 앱에서 새 로그인 메일을 받아 주세요.');
          return;
        }

        const login = await completeMemberMagicLink(accessToken);
        await syncMemberSnapshot(db, login.accessToken, login.memberId);
        await saveAppSession(db, { role: 'member', memberId: login.memberId });
        authorizeCurrentLaunch();
        router.replace(memberHomeRoute(login.memberId) as never);
      } catch (error) {
        console.error(error);
        if (active) {
          setMessage(error instanceof Error ? error.message : '회원 로그인을 완료하지 못했어요.');
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6FA' },
  center: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 16, fontSize: 19, fontWeight: '900', color: '#252A32' },
  message: { marginTop: 9, fontSize: 12, lineHeight: 18, textAlign: 'center', color: '#7C8490' },
});
