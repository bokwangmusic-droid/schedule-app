import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SignaturePreview } from '../src/components/SignaturePreview';
import { SimpleDatePickerModal } from '../src/components/SimpleDatePickerModal';
import {
  createMember,
  deleteMember,
  listMembers,
  updateMember,
} from '../src/data/memberRepository';
import {
  listSignedMemberSessions,
  type SignedMemberSession,
} from '../src/data/scheduleRepository';
import type { MemberItem } from '../src/types/member';

type DatePickerTarget = 'start' | 'end' | null;

export default function MembersScreen() {
  const db = useSQLiteContext();
  const scrollRef = useRef<ScrollView>(null);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [membershipStartDate, setMembershipStartDate] = useState('');
  const [membershipEndDate, setMembershipEndDate] = useState('');
  const [ptTotalSessions, setPtTotalSessions] = useState('');
  const [ptRemainingSessions, setPtRemainingSessions] = useState('');
  const [memo, setMemo] = useState('');
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget>(null);
  const [historyMember, setHistoryMember] = useState<MemberItem | null>(null);
  const [signedSessions, setSignedSessions] = useState<SignedMemberSession[]>([]);
  const [selectedSignedSession, setSelectedSignedSession] = useState<SignedMemberSession | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
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

  const resetForm = () => {
    setEditingMemberId(null);
    setName('');
    setPhone('');
    setMembershipStartDate('');
    setMembershipEndDate('');
    setPtTotalSessions('');
    setPtRemainingSessions('');
    setMemo('');
    setDatePickerTarget(null);
  };

  const beginEdit = (member: MemberItem) => {
    setEditingMemberId(member.id);
    setName(member.name);
    setPhone(member.phone ?? '');
    setMembershipStartDate(member.membershipStartDate ?? '');
    setMembershipEndDate(member.membershipEndDate ?? '');
    setPtTotalSessions(
      member.ptTotalSessions === null ? '' : String(member.ptTotalSessions),
    );
    setPtRemainingSessions(
      member.ptRemainingSessions === null ? '' : String(member.ptRemainingSessions),
    );
    setMemo(member.memo ?? '');
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  };

  const saveMember = async () => {
    if (!name.trim()) {
      Alert.alert('회원 이름을 입력해 주세요.');
      return;
    }

    const start = membershipStartDate.trim();
    const end = membershipEndDate.trim();
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
      const input = {
        name,
        phone,
        membershipStartDate: start || null,
        membershipEndDate: end || null,
        ptTotalSessions: total,
        ptRemainingSessions: remaining,
        memo,
      };

      if (editingMemberId) {
        await updateMember(db, editingMemberId, input);
      } else {
        await createMember(db, input);
      }

      resetForm();
      await loadMembers();
    } catch (error) {
      console.error(error);
      Alert.alert(editingMemberId ? '회원 정보를 수정하지 못했어요.' : '회원을 등록하지 못했어요.');
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
            if (editingMemberId === member.id) resetForm();
            await loadMembers();
          })();
        },
      },
    ]);
  };

  const openSignatureHistory = async (member: MemberItem) => {
    setHistoryMember(member);
    setSignedSessions([]);
    setHistoryLoading(true);
    try {
      setSignedSessions(await listSignedMemberSessions(db, member.id));
    } catch (error) {
      console.error(error);
      Alert.alert('서명 기록을 불러오지 못했어요.');
      setHistoryMember(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeSignatureHistory = () => {
    setHistoryMember(null);
    setSignedSessions([]);
    setSelectedSignedSession(null);
    setHistoryLoading(false);
  };

  const shortDate = (value: string) => {
    const [, month, day] = value.split('-').map(Number);
    return `${month}/${day}`;
  };

  const selectedPickerDate =
    datePickerTarget === 'start' ? membershipStartDate : membershipEndDate;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>‹ 시간표</Text>
        </Pressable>
        <Text style={styles.headerTitle}>회원 관리</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.formHeader}>
            <Text style={styles.sectionTitle}>{editingMemberId ? '회원 수정' : '회원 등록'}</Text>
            {editingMemberId ? (
              <Pressable onPress={resetForm} hitSlop={10}>
                <Text style={styles.cancelEditText}>수정 취소</Text>
              </Pressable>
            ) : null}
          </View>

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
            <Pressable
              style={[styles.dateButton, styles.halfInput]}
              onPress={() => setDatePickerTarget('start')}
            >
              <Text style={membershipStartDate ? styles.dateValue : styles.datePlaceholder}>
                {membershipStartDate || '시작일 선택'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.dateButton, styles.halfInput]}
              onPress={() => setDatePickerTarget('end')}
            >
              <Text style={membershipEndDate ? styles.dateValue : styles.datePlaceholder}>
                {membershipEndDate || '종료일 선택'}
              </Text>
            </Pressable>
          </View>
          {(membershipStartDate || membershipEndDate) ? (
            <View style={styles.dateClearRow}>
              {membershipStartDate ? (
                <Pressable onPress={() => setMembershipStartDate('')}>
                  <Text style={styles.clearDateText}>시작일 지우기</Text>
                </Pressable>
              ) : <View />}
              {membershipEndDate ? (
                <Pressable onPress={() => setMembershipEndDate('')}>
                  <Text style={styles.clearDateText}>종료일 지우기</Text>
                </Pressable>
              ) : <View />}
            </View>
          ) : null}

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
              placeholder="현재 잔여"
              placeholderTextColor="#A4AAB5"
              keyboardType="number-pad"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <Text style={styles.helpText}>
            현재 잔여 횟수를 기준으로 앞으로 잡힌 PT 예약의 잔여 횟수가 자동 계산됩니다.
          </Text>

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
            <Text style={styles.saveButtonText}>
              {saving ? '저장 중...' : editingMemberId ? '회원 정보 저장' : '회원 등록'}
            </Text>
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
                    PT 현재 잔여 {member.ptRemainingSessions}/{member.ptTotalSessions}
                  </Text>
                ) : null}
                {member.memo ? <Text numberOfLines={3} style={styles.memberMemo}>{member.memo}</Text> : null}
              </View>
              <View style={styles.memberActions}>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/member-view/[id]', params: { id: member.id } } as never)
                  }
                  hitSlop={8}
                >
                  <Text style={styles.memberViewText}>회원화면</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/member/[id]', params: { id: member.id } } as never)
                  }
                  hitSlop={8}
                >
                  <Text style={styles.recordText}>운동기록</Text>
                </Pressable>
                <Pressable onPress={() => void openSignatureHistory(member)} hitSlop={8}>
                  <Text style={styles.historyText}>서명기록</Text>
                </Pressable>
                <Pressable onPress={() => beginEdit(member)} hitSlop={8}>
                  <Text style={styles.editText}>수정</Text>
                </Pressable>
                <Pressable onPress={() => confirmDelete(member)} hitSlop={8}>
                  <Text style={styles.deleteText}>삭제</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={historyMember !== null}
        transparent
        animationType="slide"
        onRequestClose={closeSignatureHistory}
      >
        <View style={styles.historyBackdrop}>
          <View style={styles.historySheet}>
            <View style={styles.historyHandle} />
            <View style={styles.historyHeader}>
              <View>
                <Text style={styles.historyTitle}>
                  {historyMember ? `${historyMember.name} · PT 서명 기록` : 'PT 서명 기록'}
                </Text>
                <Text style={styles.historySubTitle}>
                  회원이 직접 서명하고 소진된 수업을 날짜별로 확인합니다.
                </Text>
              </View>
              <Pressable onPress={closeSignatureHistory} hitSlop={10}>
                <Text style={styles.historyClose}>닫기</Text>
              </Pressable>
            </View>

            {historyLoading ? (
              <View style={styles.historyLoading}>
                <ActivityIndicator color="#4B68FF" />
              </View>
            ) : signedSessions.length === 0 ? (
              <View style={styles.historyEmpty}>
                <Text style={styles.historyEmptyText}>아직 저장된 PT 서명이 없어요.</Text>
              </View>
            ) : (
              <View style={styles.historyGrid}>
                {signedSessions.slice(0, 50).map((session) => (
                  <Pressable
                    key={session.id}
                    style={styles.historyChip}
                    onPress={() => setSelectedSignedSession(session)}
                  >
                    <Text style={styles.historyChipDate}>
                      {session.sessionNumber}회째 {shortDate(session.date)}
                    </Text>
                    <View style={styles.historyChipSignature}>
                      <SignaturePreview
                        signatureJson={session.signatureJson}
                        height={18}
                        compact
                      />
                    </View>
                  </Pressable>
                ))}
                {signedSessions.length > 50 ? (
                  <Text style={styles.historyMoreText}>
                    최근 50개만 표시 중 · 총 {signedSessions.length}개
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={selectedSignedSession !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSignedSession(null)}
      >
        <View style={styles.signatureDetailBackdrop}>
          <View style={styles.signatureDetailCard}>
            <View style={styles.signatureDetailHeader}>
              <View>
                <Text style={styles.signatureDetailTitle}>
                  {selectedSignedSession
                    ? `${selectedSignedSession.sessionNumber}회째 · ${shortDate(selectedSignedSession.date)} PT 서명`
                    : 'PT 서명'}
                </Text>
                {selectedSignedSession?.startTime ? (
                  <Text style={styles.signatureDetailTime}>
                    {selectedSignedSession.startTime.slice(0, 5)}
                    {selectedSignedSession.endTime ? `–${selectedSignedSession.endTime.slice(0, 5)}` : ''}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => setSelectedSignedSession(null)} hitSlop={10}>
                <Text style={styles.historyClose}>닫기</Text>
              </Pressable>
            </View>
            {selectedSignedSession ? (
              <>
                <SignaturePreview
                  signatureJson={selectedSignedSession.signatureJson}
                  height={180}
                />
                {selectedSignedSession.sessionNote ? (
                  <View style={styles.historyNote}>
                    <Text style={styles.historyNoteLabel}>수업 메모</Text>
                    <Text style={styles.historyNoteText}>{selectedSignedSession.sessionNote}</Text>
                  </View>
                ) : null}
                <Text style={styles.historySignedAt}>
                  서명 저장 {new Date(selectedSignedSession.signedAt).toLocaleString('ko-KR')}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <SimpleDatePickerModal
        visible={datePickerTarget !== null}
        title={datePickerTarget === 'start' ? '회원권 시작일' : '회원권 종료일'}
        selectedDate={selectedPickerDate || null}
        onClose={() => setDatePickerTarget(null)}
        onSelect={(date) => {
          if (datePickerTarget === 'start') setMembershipStartDate(date);
          if (datePickerTarget === 'end') setMembershipEndDate(date);
        }}
      />
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
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#22262E' },
  cancelEditText: { fontSize: 13, fontWeight: '800', color: '#7B8290' },
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
  halfInput: { flex: 1, minWidth: 0 },
  dateButton: {
    minHeight: 50,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    justifyContent: 'center',
    backgroundColor: '#F3F5F8',
  },
  dateValue: { fontSize: 13, fontWeight: '800', color: '#303640' },
  datePlaceholder: { fontSize: 13, fontWeight: '700', color: '#A4AAB5' },
  dateClearRow: {
    marginTop: 7,
    paddingHorizontal: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clearDateText: { fontSize: 11, fontWeight: '700', color: '#8A909B' },
  helpText: { marginTop: 8, fontSize: 11, lineHeight: 16, color: '#9097A3' },
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
  memberActions: { marginLeft: 12, gap: 10, alignItems: 'flex-end' },
  memberViewText: { fontSize: 13, fontWeight: '900', color: '#7A4CC8' },
  recordText: { fontSize: 13, fontWeight: '900', color: '#2D7A57' },
  historyText: { fontSize: 13, fontWeight: '900', color: '#5266C7' },
  editText: { fontSize: 13, fontWeight: '900', color: '#4B68FF' },
  deleteText: { fontSize: 13, fontWeight: '800', color: '#D9364F' },
  historyBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16,20,28,0.42)',
  },
  historySheet: {
    height: '92%',
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 16,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#F7F8FA',
  },
  historyHandle: {
    width: 40,
    height: 4,
    marginBottom: 14,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: '#D7DAE1',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyTitle: { fontSize: 19, fontWeight: '900', color: '#20242C' },
  historySubTitle: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 16,
    color: '#858C98',
  },
  historyClose: { fontSize: 13, fontWeight: '900', color: '#5968B5' },
  historyLoading: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyEmpty: {
    height: 160,
    marginTop: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  historyEmptyText: { fontSize: 13, fontWeight: '700', color: '#9298A3' },
  historyGrid: {
    flex: 1,
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    columnGap: 6,
    rowGap: 2,
  },
  historyChip: {
    width: '49%',
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E1E4EA',
  },
  historyChipDate: {
    width: 68,
    fontSize: 9,
    fontWeight: '900',
    color: '#303640',
  },
  historyChipSignature: {
    flex: 1,
    height: 18,
    marginLeft: 4,
  },
  historyMoreText: {
    width: '100%',
    marginTop: 4,
    fontSize: 10,
    color: '#8D949F',
    textAlign: 'center',
  },
  signatureDetailBackdrop: {
    flex: 1,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,20,28,0.52)',
  },
  signatureDetailCard: {
    width: '100%',
    maxWidth: 420,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  signatureDetailHeader: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  signatureDetailTitle: { fontSize: 18, fontWeight: '900', color: '#22262E' },
  signatureDetailTime: { marginTop: 3, fontSize: 12, fontWeight: '700', color: '#7A818D' },
  historyNote: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F5F7FA',
  },
  historyNoteLabel: { fontSize: 10, fontWeight: '900', color: '#878E99' },
  historyNoteText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: '#424852',
  },
  historySignedAt: {
    marginTop: 8,
    fontSize: 10,
    color: '#9AA0AA',
    textAlign: 'right',
  },
});
