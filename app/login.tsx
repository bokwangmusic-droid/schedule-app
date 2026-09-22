import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  memberHomeRoute,
  saveAppSession,
} from '../src/auth/appSession';
import { listMembers } from '../src/data/memberRepository';
import type { MemberItem } from '../src/types/member';

export default function LoginScreen() {
  const db = useSQLiteContext();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingInId, setSigningInId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listMembers(db)
      .then((rows) => {
        if (active) setMembers(rows);
      })
      .catch(console.error)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [db]);

  const enterTrainerMode = async () => {
    setSigningInId('trainer');
    try {
      await saveAppSession(db, { role: 'trainer', trainerId: 'local-trainer' });
      router.replace('/');
    } finally {
      setSigningInId(null);
    }
  };

  const enterMemberMode = async (member: MemberItem) => {
    setSigningInId(member.id);
    try {
      await saveAppSession(db, { role: 'member', memberId: member.id });
      router.replace(memberHomeRoute(member.id) as never);
    } finally {
      setSigningInId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandBlock}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>BK</Text>
          </View>
          <Text style={styles.brand}>비케이짐 스케줄</Text>
          <Text style={styles.subtitle}>사용할 모드를 선택해 주세요.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>강사</Text>
          <Text style={styles.cardTitle}>트레이너 모드</Text>
          <Text style={styles.cardText}>
            시간표, 회원 관리, 운동 기록을 관리하는 기존 화면으로 들어갑니다.
          </Text>
          <Pressable
            style={[styles.primaryButton, signingInId !== null && styles.disabled]}
            onPress={() => void enterTrainerMode()}
            disabled={signingInId !== null}
          >
            <Text style={styles.primaryButtonText}>
              {signingInId === 'trainer' ? '접속 중...' : '강사로 시작하기'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>회원 모드 테스트</Text>
            <Text style={styles.sectionSub}>
              현재 이 기기에 저장된 회원 중 한 명을 선택합니다.
            </Text>
          </View>
          <View style={styles.testBadge}>
            <Text style={styles.testBadgeText}>로컬 테스트</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#4B68FF" />
          </View>
        ) : members.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>등록된 회원이 없어요.</Text>
            <Text style={styles.emptyText}>
              먼저 강사 모드에서 회원을 등록한 뒤 다시 테스트해 주세요.
            </Text>
          </View>
        ) : (
          <View style={styles.memberList}>
            {members.map((member) => (
              <Pressable
                key={member.id}
                style={[styles.memberRow, signingInId !== null && styles.disabled]}
                onPress={() => void enterMemberMode(member)}
                disabled={signingInId !== null}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{member.name.slice(0, 1)}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberMeta}>
                    {member.phone || '연락처 미등록'}
                    {member.ptRemainingSessions !== null
                      ? ` · PT ${member.ptRemainingSessions}회 남음`
                      : ''}
                  </Text>
                </View>
                <Text style={styles.chevron}>
                  {signingInId === member.id ? '…' : '›'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>지금 단계는 로그인 흐름 확인용이에요.</Text>
          <Text style={styles.noticeText}>
            실제 회원 휴대폰 로그인과 실시간 데이터 동기화는 서버 연결 단계에서 붙입니다.
            현재 회원 모드는 이 기기에 저장된 데이터만 사용합니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { padding: 18, paddingBottom: 40 },
  brandBlock: { alignItems: 'center', paddingTop: 28, paddingBottom: 24 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4058D6',
  },
  logoText: { fontSize: 23, fontWeight: '900', color: '#FFFFFF' },
  brand: { marginTop: 13, fontSize: 24, fontWeight: '900', color: '#20242C' },
  subtitle: { marginTop: 6, fontSize: 12, color: '#8A919C' },
  card: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  cardEyebrow: { fontSize: 10, fontWeight: '900', color: '#6978C7' },
  cardTitle: { marginTop: 4, fontSize: 19, fontWeight: '900', color: '#252A32' },
  cardText: { marginTop: 7, fontSize: 12, lineHeight: 18, color: '#7C8490' },
  primaryButton: {
    height: 50,
    marginTop: 16,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4058D6',
  },
  primaryButtonText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 9,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#272C34' },
  sectionSub: { marginTop: 4, fontSize: 10, color: '#9299A4' },
  testBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: '#EEF1FF',
  },
  testBadgeText: { fontSize: 9, fontWeight: '900', color: '#6573BE' },
  loadingBox: {
    height: 120,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyCard: { padding: 22, borderRadius: 20, backgroundColor: '#FFFFFF' },
  emptyTitle: { fontSize: 14, fontWeight: '900', color: '#4A515B' },
  emptyText: { marginTop: 5, fontSize: 11, lineHeight: 17, color: '#939AA5' },
  memberList: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  memberRow: {
    minHeight: 68,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EBEDF1',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF1FF',
  },
  avatarText: { fontSize: 15, fontWeight: '900', color: '#4058D6' },
  memberInfo: { flex: 1, marginLeft: 11 },
  memberName: { fontSize: 14, fontWeight: '900', color: '#30353D' },
  memberMeta: { marginTop: 3, fontSize: 10, color: '#9097A2' },
  chevron: { fontSize: 24, fontWeight: '400', color: '#A5ABB4' },
  notice: {
    marginTop: 18,
    padding: 14,
    borderRadius: 15,
    backgroundColor: '#EAEDF4',
  },
  noticeTitle: { fontSize: 11, fontWeight: '900', color: '#59616D' },
  noticeText: { marginTop: 5, fontSize: 10, lineHeight: 16, color: '#7D8591' },
  disabled: { opacity: 0.55 },
});
