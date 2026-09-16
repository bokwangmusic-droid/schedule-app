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
import type { MemberItem } from '../src/types/member';

export default function MembersScreen() {
  const db = useSQLiteContext();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
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

    try {
      setSaving(true);
      await createMember(db, { name, phone, memo });
      setName('');
      setPhone('');
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
          <TextInput
            value={memo}
            onChangeText={setMemo}
            placeholder="메모 (선택)"
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
                {member.memo ? <Text numberOfLines={2} style={styles.memberMemo}>{member.memo}</Text> : null}
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
  input: {
    minHeight: 50,
    marginTop: 12,
    paddingHorizontal: 15,
    borderRadius: 14,
    backgroundColor: '#F3F5F8',
    fontSize: 16,
    color: '#171A21',
  },
  memoInput: { minHeight: 82, paddingTop: 14, paddingBottom: 14 },
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
    minHeight: 70,
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
  memberMeta: { marginTop: 3, fontSize: 13, color: '#727986' },
  memberMemo: { marginTop: 4, fontSize: 12, lineHeight: 17, color: '#9298A3' },
  deleteText: { marginLeft: 12, fontSize: 13, fontWeight: '800', color: '#D9364F' },
});
