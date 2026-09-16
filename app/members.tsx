import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createMember, deleteMember, listMembers } from '../src/data/memberRepository';
import { isValidDateInput } from '../src/lib/date';
import type { MemberItem } from '../src/types/member';

export default function MembersScreen() {
  const db = useSQLiteContext();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [membershipStartDate, setMembershipStartDate] = useState('');
  const [membershipEndDate, setMembershipEndDate] = useState('');
  const [ptTotalSessions, setPtTotalSessions] = useState('');
  const [ptRemainingSessions, setPtRemainingSessions] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  const loadMembers = useCallback(async () => {
    const rows = await listMembers(db);
    setMembers(rows);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void loadMembers();
    }, [loadMembers]),
  );

  const saveMember = async () => {
    if (!name.trim()) {
      Alert.alert('회원 이름을 입력해 주세요.');
      return;
    }

    const start = membershipStartDate.trim();
    const end = membershipEndDate.trim();
    if (start && !isValidDateInput(start)) {
      Alert.alert('회원권 시작일을 확인해 주세요.', '예: 2026-09-16');
      return;
    }
    if (end && !isValidDateInput(end)) {
      Alert.alert('회원권 종료일을 확인해 주세요.', '예: 2026-12-16');
      return;
    }
    if (start && end && start > end) {
      Alert.alert('회원권 기간을 확인해 주세요.', '종료일은 시작일보다 늦어야 해요.');
      return;
    }

    const totalText = ptTotalSessions.trim();
    const remainingText = ptRemainingSessions.trim();
    const hasPt = Boolean(totalText || remainingText);
    let total: number | null = null;
    let remaining: number | null = null;

    if (hasPt) {
      if (!totalText || !remainingText) {
        Alert.alert('PT 횟수를 확인해 주세요.', '총 횟수와 잔여 횟수를 모두 입력해 주세요.');
        return;
      }
      total = Number(totalText);
      remaining = Number(remainingText);
      if (!Number.isInteger(total) || total < 0 || !Number.isInteger(remaining) || remaining < 0) {
        Alert.alert('PT 횟수는 0 이상의 숫자로 입력해 주세요.');
        return;
      }
      if (remaining > total) {
        Alert.alert('PT 잔여 횟수를 확인해 주세요.', '잔여 횟수는 총 횟수보다 클 수 없어요.');
        return;
      }
    }

    try {
      setSaving(true);
      await createMember(db, {
        name,
        phone,
        membershipStartDate: start || null,
        membershipEndDate: end || null,
        ptTotalSessions: total,
        ptRemainingSessions: remaining,
        memo,
      });
      setName('');
      setPhone('');
      setMembershipStartDate('');
      setMembershipEndDate('');
      setPtTotalSessions('');
      setPtRemainingSessions('');
      setMemo('');
      await loadMembers();
    } catch (error) {
      console.error(error);
      Alert.alert('회원을 등록하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (member: MemberItem) => {
    Alert.alert('회원 삭제', `${member.name} 회원을 삭제할까요?\n기존 일정은 남아 있습니다.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteMember(db, member.id);
            await loadMembers();
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>‹ 시간표</Text>
        </Pressable>
        <Text style={styles.headerTitle}>회원 관리</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>회원 등록</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="회원 이름"
            placeholderTextColor="#A4AAB5"
            style={styles.input}
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="연락처 (선택)"
            placeholderTextColor="#A4AAB5"
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text style={styles.fieldTitle}>회원권 기간</Text>
          <View style={styles.twoColumnRow}>
            <TextInput
              value={membershipStartDate}
              onChangeText={setMembershipStartDate}
              placeholder="시작일 YYYY-MM-DD"
              placeholderTextColor="#A4AAB5"
              style={[styles.input, styles.halfInput]}
              autoCapitalize="none"
            />
            <TextInput
              value={membershipEndDate}
              onChangeText={setMembershipEndDate}
              placeholder="종료일 YYYY-MM-DD"
              placeholderTextColor="#A4AAB5"
              style={[styles.input, styles.halfInput]}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.fieldTitle}>PT 횟수</Text>
          <View style={styles.twoColumnRow}>
            <TextInput
              value={ptTotalSessions}
              onChangeText={setPtTotalSessions}
              placeholder="총 횟수"
              placeholderTextColor="#A4AAB5"
              keyboardType="number-pad"
              style={[styles.input, styles.halfInput]}
            />
            <TextInput
              value={ptRemainingSessions}
              onChangeText={setPtRemainingSessions}
              placeholder="잔여 횟수"
              placeholderTextColor="#A4AAB5"
              keyboardType="number-pad"
              style={[styles.input, styles.halfInput]}
            />
          </View>

          <TextInput
            value={memo}
            onChangeText={setMemo}
            placeholder="메모 (운동 목표, 주의사항 등)"
            placeholderTextColor="#A4AAB5"
            style={[styles.input, styles.memoInput]}
            multiline
            textAlignVertical="top"
          />
          <Pressable
            style={[styles.saveButton, saving && styles.disabled]}
            onPress={saveMember}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{saving ? '등록 중...' : '회원 등록'}</Text>
          </Pressable>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>등록 회원</Text>
          <Text style={styles.countText}>{members.length}명</Text>
        </View>

        {members.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>등록된 회원이 없습니다.</Text>
          </View>
        ) : (
          members.map((member) => (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                {member.phone ? <Text style={styles.memberMeta}>{member.phone}</Text> : null}
                {member.membershipStartDate || member.membershipEndDate ? (
                  <Text style={styles.memberMeta}>
                    회원권 {member.membershipStartDate ?? '미입력'} ~ {member.membershipEndDate ?? '미입력'}
                  </Text>
                ) : null}
                {member.ptTotalSessions !== null && member.ptRemainingSessions !== null ? (
                  <Text style={styles.ptMeta}>
                    PT 잔여 {member.ptRemainingSessions}/{member.ptTotalSessions}
                  </Text>
                ) : null}
                {member.memo ? <Text numberOfLines={3} style={styles.memberMemo}>{member.memo}</Text> : null}
              </View>
              <Pressable onPress={() => confirmDelete(member)} hitSlop={10}>
                <Text style={styles.deleteText}>삭제</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F8FA' },
  header: {
    height: 58,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backText: { minWidth: 70, fontSize: 15, fontWeight: '700', color: '#4B68FF' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#171A21' },
  headerSpacer: { width: 70 },
  content: { padding: 18, paddingBottom: 40 },
  card: { padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#22262E' },
  fieldTitle: {
    marginTop: 16,
    marginBottom: -2,
    fontSize: 13,
    fontWeight: '800',
    color: '#616977',
  },
  input: {
    minHeight: 50,
    marginTop: 12,
    paddingHorizontal: 15,
    borderRadius: 14,
    backgroundColor: '#F3F5F8',
    fontSize: 16,
    color: '#171A21',
  },
  twoColumnRow: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1, minWidth: 0, fontSize: 13 },
  memoInput: { minHeight: 88, paddingTop: 14, paddingBottom: 14 },
  saveButton: {
    height: 52,
    marginTop: 14,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4B68FF',
  },
  saveButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  disabled: { opacity: 0.55 },
  listHeader: {
    marginTop: 26,
    marginBottom: 10,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countText: { fontSize: 13, fontWeight: '700', color: '#8A909B' },
  emptyCard: { padding: 22, borderRadius: 16, alignItems: 'center', backgroundColor: '#FFFFFF' },
  emptyText: { fontSize: 14, color: '#8A909B' },
  memberCard: {
    minHeight: 84,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 16, fontWeight: '900', color: '#22262E' },
  memberMeta: { marginTop: 3, fontSize: 12, color: '#727986' },
  ptMeta: { marginTop: 4, fontSize: 13, fontWeight: '900', color: '#4B68FF' },
  memberMemo: { marginTop: 5, fontSize: 12, lineHeight: 17, color: '#9298A3' },
  deleteText: { marginLeft: 12, fontSize: 13, fontWeight: '800', color: '#D9364F' },
});
