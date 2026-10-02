import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  authorizeCurrentLaunch,
  getAppSession,
  memberHomeRoute,
  saveAppSession,
} from '../src/auth/appSession';
import { syncMemberSnapshot } from '../src/remote/memberSync';
import {
  completeMemberMagicLink,
  completeTrainerMagicLink,
  refreshAuthSession,
} from '../src/remote/supabaseAuth';

export default function IndexScreen() {
  const db = useSQLiteContext();

  useEffect(() => {
    let active = true;

    const restore = async () => {
      const saved = await getAppSession(db);
      if (!active) return;

      if (!saved) {
        router.replace('/login');
        return;
      }

      try {
        let accessToken = saved.accessToken;
        let refreshToken = saved.refreshToken;

        if (refreshToken) {
          try {
            const refreshed = await refreshAuthSession(refreshToken);
            accessToken = refreshed.accessToken;
            refreshToken = refreshed.refreshToken;
          } catch (error) {
            console.warn('세션 갱신 실패, 저장된 세션으로 계속 시도합니다.', error);
          }
        }

        if (saved.role === 'trainer') {
          if (!accessToken) {
            router.replace('/login');
            return;
          }

          const login = await completeTrainerMagicLink(accessToken);
          if (!active) return;

          await saveAppSession(db, {
            role: 'trainer',
            trainerId: login.trainerId,
            accessToken,
            refreshToken,
            verificationStatus: login.verificationStatus,
            verificationSubmittedAt: login.verificationSubmittedAt ?? null,
            email: login.email,
          });

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
          return;
        }

        if (!accessToken) {
          router.replace('/login');
          return;
        }

        const login = await completeMemberMagicLink(accessToken);
        if (!active) return;

        await syncMemberSnapshot(db, login.accessToken, login.memberId);
        await saveAppSession(db, {
          role: 'member',
          memberId: login.memberId,
          accessToken: login.accessToken,
          refreshToken,
        });

        authorizeCurrentLaunch();
        router.replace(memberHomeRoute(login.memberId) as never);
      } catch (error) {
        console.error('저장된 로그인 복원 실패', error);

        if (!active) return;

        // 이미 인증을 마친 사용자는 네트워크가 잠시 끊겨도
        // 저장된 로컬 세션으로 앱을 계속 사용할 수 있게 합니다.
        if (saved.role === 'trainer' && saved.verificationStatus === 'approved') {
          authorizeCurrentLaunch();
          router.replace('/trainer');
          return;
        }

        if (saved.role === 'member') {
          authorizeCurrentLaunch();
          router.replace(memberHomeRoute(saved.memberId) as never);
          return;
        }

        router.replace('/login');
      }
    };

    void restore();

    return () => {
      active = false;
    };
  }, [db]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#177B78" />
      <Text style={styles.text}>로그인 상태를 확인하고 있어요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6F8',
  },
  text: {
    marginTop: 12,
    fontSize: 12,
    color: '#7C8490',
  },
});
