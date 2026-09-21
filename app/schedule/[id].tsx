import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MemberSignatureHistoryModal } from '../../src/components/MemberSignatureHistoryModal';
import { SessionSignatureModal } from '../../src/components/SessionSignatureModal';
import { TimePickerField } from '../../src/components/TimePickerField';
import { getTrainingLogForSchedule } from '../../src/data/memberFitnessRepository';
import { listMembers } from '../../src/data/memberRepository';
import {
  completeMemberSessionWithSignature,
  deleteSchedule,
  getLatestMemberSessionNote,
  getScheduleById,
  listSignedMemberSessions,
  setScheduleAttendanceStatus,
  updateSchedule,
  type SignedMemberSession,
} from '../../src/data/scheduleRepository';
import { isValidDateInput, isValidTimeInput } from '../../src/lib/date';
import type { MemberItem } from '../../src/types/member';
import type { ScheduleItem } from '../../src/types/schedule';
import { refreshWeeklyTimetableWidget } from '../../src/widgets/widgetController';

const COLORS = ['#5B8DEF', '#91D948', '#FF4E7D', '#9C6ADE', '#FF9F43', '#37B8A5'];
type ScheduleKind = 'member' | 'personal';

function addOneHour(time: string) {
  if (!isValidTimeInput(time)) return '10:00';
  const [hour, minute] = time.split(':').map(Number);
  if (hour >= 23) return '23:59';
  return `${String(hour + 1).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function membershipDday(endDate: string | null) {
  if (!endDate) return null;
  const [year, month, day] = endDate.split('-').map(Number);
  const end = new Date(year, month - 1, day, 12, 0, 0, 0);
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - base.getTime()) / 86_400_000);
  if (diff === 0) return '오늘 만료';
  if (diff > 0) return `D-${diff}`;
  return `만료 +${Math.abs(diff)}일`;
}

export default function EditScheduleScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [loading, setLoading] = useState(true);
  const [scheduleRecord, setScheduleRecord] = useState<ScheduleItem | null>(null);
  const [latestSessionNote, setLatestSessionNote] = useState<{
    note: string;
    date: string;
    startTime: string | null;
  } | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signatureHistoryOpen, setSignatureHistoryOpen] = useState(false);
  const [signatureHistoryLoading, setSignatureHistoryLoading] = useState(false);
  const [signedSessions, setSignedSessions] = useState<SignedMemberSession[]>([]);
  const [hasTrainingLog, setHasTrainingLog] = useState(false);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>('personal');
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [memo, setMemo] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const [schedule, memberRows] = await Promise.all([
          getScheduleById(db, id),
          listMembers(db),
        ]);
        if (!active) return;

        setMembers(memberRows);

        if (!schedule) {
          Alert.alert('일정을 찾을 수 없어요.');
          router.back();
          return;
        }

        setScheduleRecord(schedule);
        const trainingLog = await getTrainingLogForSchedule(db, schedule.id);
        if (active) setHasTrainingLog(Boolean(trainingLog));
        if (schedule.memberId) {
          const previousNote = await getLatestMemberSessionNote(db, schedule.memberId, schedule.id);
          if (active) setLatestSessionNote(previousNote);
        } else {
          setLatestSessionNote(null);
        }

        setTitle(schedule.title);
        setDate(schedule.date);
        setMemberId(schedule.memberId);
        setScheduleKind(schedule.memberId ? 'member' : 'personal');
        setIsAllDay(schedule.isAllDay);
        setStartTime(schedule.startTime ?? '09:00');
        setEndTime(schedule.endTime ?? '10:00');
        setMemo(schedule.memo ?? '');
        setColor(schedule.color ?? COLORS[0]);
      } catch (error) {
        console.error(error);
        Alert.alert('일정을 불러오지 못했어요.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [db, id]);

  const selectedMember = members.find((member) => member.id === memberId) ?? null;
  const dday = membershipDday(selectedMember?.membershipEndDate ?? null);

  const chooseKind = (kind: ScheduleKind) => {
    if (scheduleRecord?.ptConsumed) {
      Alert.alert('소진 완료 수업', '회원 서명이 완료된 수업은 회원 구분을 변경할 수 없어요.');
      return;
    }
    if (kind === scheduleKind) return;

    if (kind === 'personal') {
      const selectedName = selectedMember?.name ?? '';
      if (title === selectedName) setTitle('');
      setMemberId(null);
      setMemberOpen(false);
    }

    setScheduleKind(kind);
  };

  const chooseMember = (member: MemberItem) => {
    if (scheduleRecord?.ptConsumed) {
      Alert.alert('소진 완료 수업', 'PT가 소진된 수업은 다른 회원으로 변경할 수 없어요.');
      return;
    }
    const previousName = selectedMember?.name ?? '';
    if (!title.trim() || title === previousName) setTitle(member.name);
    setMemberId(member.id);
    setMemberOpen(false);
  };

  const changeStartTime = (value: string) => {
    setStartTime(value);
    if (endTime <= value) setEndTime(addOneHour(value));
  };

  const save = async () => {
    if (scheduleKind === 'member' && !selectedMember) {
      Alert.alert('회원을 선택해 주세요.');
      return;
    }

    const trimmedTitle = title.trim() || selectedMember?.name || '';

    if (!trimmedTitle) {
      Alert.alert('일정 이름을 입력해 주세요.');
      return;
    }
    if (!isValidDateInput(date)) {
      Alert.alert('날짜를 확인해 주세요.', '예: 2026-09-16');
      return;
    }
    if (!isAllDay && (!isValidTimeInput(startTime) || !isValidTimeInput(endTime))) {
      Alert.alert('시간을 확인해 주세요.');
      return;
    }
    if (!isAllDay && startTime >= endTime) {
      Alert.alert('종료 시간을 확인해 주세요.', '종료 시간은 시작 시간보다 늦어야 해요.');
      return;
    }

    try {
      setSaving(true);
      await updateSchedule(db, id, {
        title: trimmedTitle,
        date,
        startTime: isAllDay ? null : startTime,
        endTime: isAllDay ? null : endTime,
        memo,
        color,
        memberId: scheduleKind === 'member' ? memberId : null,
        isAllDay,
      });
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('일정을 수정하지 못했어요.', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const reloadSessionState = async () => {
    const [schedule, memberRows] = await Promise.all([
      getScheduleById(db, id),
      listMembers(db),
    ]);
    setScheduleRecord(schedule);
    setMembers(memberRows);
    setHasTrainingLog(schedule ? Boolean(await getTrainingLogForSchedule(db, schedule.id)) : false);
    if (schedule?.memberId) {
      setLatestSessionNote(
        await getLatestMemberSessionNote(db, schedule.memberId, schedule.id),
      );
    } else {
      setLatestSessionNote(null);
    }
  };

  const openSignatureHistory = async () => {
    if (!selectedMember) return;
    setSignatureHistoryOpen(true);
    setSignatureHistoryLoading(true);
    try {
      setSignedSessions(await listSignedMemberSessions(db, selectedMember.id));
    } catch (error) {
      console.error(error);
      setSignatureHistoryOpen(false);
      Alert.alert('서명 기록을 불러오지 못했어요.');
    } finally {
      setSignatureHistoryLoading(false);
    }
  };

  const markAttendance = async (status: 'canceled' | 'no_show') => {
    try {
      setAttendanceBusy(true);
      await setScheduleAttendanceStatus(db, id, status);
      await reloadSessionState();
      void refreshWeeklyTimetableWidget().catch(console.error);
    } catch (error) {
      console.error(error);
      Alert.alert('수업 상태를 변경하지 못했어요.');
    } finally {
      setAttendanceBusy(false);
    }
  };

  const completeWithSignature = async (signatureJson: string, sessionNote: string) => {
    try {
      setAttendanceBusy(true);
      const result = await completeMemberSessionWithSignature(
        db,
        id,
        signatureJson,
        sessionNote,
      );
      setSignatureOpen(false);
      await reloadSessionState();
      void refreshWeeklyTimetableWidget().catch(console.error);
      Alert.alert('수업 완료', `회원 서명이 저장되고 PT 1회가 소진되었습니다.\n잔여 ${result.remainingSessions}회`);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : '';
      if (message.includes('PT_BALANCE_NOT_SET')) {
        Alert.alert('PT 횟수를 먼저 등록해 주세요.', '회원 관리에서 총 횟수와 현재 잔여 횟수를 입력해 주세요.');
      } else if (message.includes('NO_PT_REMAINING')) {
        Alert.alert('남은 PT가 없어요.');
      } else if (message.includes('PT_ALREADY_CONSUMED')) {
        Alert.alert('이미 소진 처리된 수업이에요.');
      } else {
        Alert.alert('PT 소진 처리를 완료하지 못했어요.');
      }
    } finally {
      setAttendanceBusy(false);
    }
  };

  const shareSchedule = async () => {
    const who = selectedMember?.name ?? (title.trim() || '일정');
    const timeText = isAllDay ? '종일' : `${startTime}~${endTime}`;
    await Share.share({
      message: `${who} 일정 안내\n${date} ${timeText}\n확인 부탁드립니다.`,
    });
  };

  const confirmDelete = () => {
    if (scheduleRecord?.ptConsumed) {
      Alert.alert(
        '삭제할 수 없어요.',
        '회원 서명으로 PT가 소진된 수업은 기록 보호를 위해 삭제할 수 없어요.',
      );
      return;
    }
    Alert.alert('일정 삭제', '이 일정을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              setDeleting(true);
              await deleteSchedule(db, id);
              router.back();
            } catch (error) {
              console.error(error);
              Alert.alert('일정을 삭제하지 못했어요.');
              setDeleting(false);
            }
          })();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#4B68FF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.headerAction}>취소</Text>
          </Pressable>
          <Text style={styles.headerTitle}>일정 수정</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>일정 종류</Text>
          <View style={styles.kindRow}>
            <Pressable
              style={[styles.kindButton, scheduleKind === 'member' && styles.kindButtonActive]}
              onPress={() => chooseKind('member')}
            >
              <Text style={[styles.kindButtonText, scheduleKind === 'member' && styles.kindButtonTextActive]}>
                회원 일정
              </Text>
            </Pressable>
            <Pressable
              style={[styles.kindButton, scheduleKind === 'personal' && styles.kindButtonActive]}
              onPress={() => chooseKind('personal')}
            >
              <Text style={[styles.kindButtonText, scheduleKind === 'personal' && styles.kindButtonTextActive]}>
                개인 일정
              </Text>
            </Pressable>
          </View>

          {scheduleKind === 'member' ? (
            <View style={styles.sectionSmall}>
              <Text style={styles.label}>회원 선택</Text>
              <Pressable style={styles.dropdownButton} onPress={() => setMemberOpen((open) => !open)}>
                <Text style={[styles.dropdownText, !selectedMember && styles.dropdownPlaceholder]}>
                  {selectedMember?.name ?? '회원을 선택하세요'}
                </Text>
                <Text style={styles.dropdownArrow}>{memberOpen ? '▲' : '▼'}</Text>
              </Pressable>
              {memberOpen && (
                <View style={styles.dropdownMenu}>
                  {members.map((member) => (
                    <Pressable key={member.id} style={styles.dropdownItem} onPress={() => chooseMember(member)}>
                      <View style={styles.dropdownMemberInfo}>
                        <Text style={styles.dropdownMemberName}>{member.name}</Text>
                        {member.phone ? <Text style={styles.dropdownMemberPhone}>{member.phone}</Text> : null}
                      </View>
                      {member.id === memberId ? <Text style={styles.dropdownCheck}>✓</Text> : null}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {scheduleKind === 'member' && selectedMember && scheduleRecord ? (
            <View style={styles.sessionCard}>
              <View style={styles.sessionTitleRow}>
                <View style={styles.sessionTitleInfo}>
                  <Text style={styles.sessionTitle}>수업 관리</Text>
                  <Text style={styles.sessionSubText}>
                    PT 잔여 {selectedMember.ptRemainingSessions ?? '-'}회
                    {dday ? ` · 회원권 ${dday}` : ''}
                  </Text>
                </View>
                <View style={styles.sessionTitleActions}>
                  <View style={styles.sessionActionRow}>
                    <Pressable
                      style={styles.memberRecordButton}
                      onPress={() =>
                        router.push({
                          pathname: '/member/[id]',
                          params: {
                            id: selectedMember.id,
                            scheduleId: id,
                            date,
                          },
                        } as never)
                      }
                    >
                      <Text style={styles.memberRecordButtonText}>회원 기록</Text>
                    </Pressable>
                    <Pressable
                      style={styles.historyButton}
                      onPress={() => void openSignatureHistory()}
                    >
                      <Text style={styles.historyButtonText}>서명 기록</Text>
                    </Pressable>
                  </View>
                  {selectedMember.ptRemainingSessions !== null && selectedMember.ptRemainingSessions <= 3 ? (
                    <View style={styles.warningBadge}>
                      <Text style={styles.warningBadgeText}>재등록 체크</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <Pressable
                style={styles.trainingLogButton}
                onPress={() =>
                  router.push({
                    pathname: '/member/[id]',
                    params: {
                      id: selectedMember.id,
                      scheduleId: id,
                      date,
                      newLog: hasTrainingLog ? '0' : '1',
                    },
                  } as never)
                }
              >
                <Text style={styles.trainingLogButtonTitle}>
                  {hasTrainingLog ? '운동일지 보기' : '오늘 운동일지 작성'}
                </Text>
                <Text style={styles.trainingLogButtonSub}>
                  운동 · 세트 · 컨디션 · 식단 · 피드백 기록
                </Text>
              </Pressable>

              {latestSessionNote ? (
                <View style={styles.previousNoteCard}>
                  <Text style={styles.previousNoteLabel}>
                    지난 수업 · {latestSessionNote.date}
                    {latestSessionNote.startTime ? ` ${latestSessionNote.startTime.slice(0, 5)}` : ''}
                  </Text>
                  <Text style={styles.previousNoteText}>{latestSessionNote.note}</Text>
                </View>
              ) : null}

              {scheduleRecord.ptConsumed ? (
                <View style={styles.completedCard}>
                  <Text style={styles.completedTitle}>✓ 회원 서명 완료 · PT 1회 소진</Text>
                  {scheduleRecord.sessionNote ? (
                    <Text style={styles.completedNote}>{scheduleRecord.sessionNote}</Text>
                  ) : null}
                </View>
              ) : scheduleRecord.attendanceStatus === 'canceled' ? (
                <View style={styles.statusCard}>
                  <Text style={styles.statusText}>수업 취소로 처리됨 · PT 차감 없음</Text>
                </View>
              ) : scheduleRecord.attendanceStatus === 'no_show' ? (
                <View style={styles.statusCard}>
                  <Text style={styles.statusText}>노쇼로 처리됨 · PT 차감 없음</Text>
                </View>
              ) : (
                <>
                  <Pressable
                    style={[styles.signatureButton, attendanceBusy && styles.saveButtonDisabled]}
                    onPress={() => setSignatureOpen(true)}
                    disabled={attendanceBusy}
                  >
                    <Text style={styles.signatureButtonText}>수업 완료 · 회원 서명 받기</Text>
                    <Text style={styles.signatureButtonHint}>서명 후에만 PT 1회가 소진됩니다</Text>
                  </Pressable>
                  <View style={styles.attendanceRow}>
                    <Pressable
                      style={styles.attendanceButton}
                      onPress={() => void markAttendance('canceled')}
                      disabled={attendanceBusy}
                    >
                      <Text style={styles.attendanceButtonText}>수업 취소</Text>
                    </Pressable>
                    <Pressable
                      style={styles.attendanceButton}
                      onPress={() => void markAttendance('no_show')}
                      disabled={attendanceBusy}
                    >
                      <Text style={styles.attendanceButtonText}>노쇼</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.label}>{scheduleKind === 'member' ? '일정명' : '개인 일정명'}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={scheduleKind === 'member' ? '예: 홍길동 PT' : '예: 병원, 가족약속, 운동'}
              placeholderTextColor="#A4AAB5"
              style={styles.titleInput}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>색상</Text>
            <View style={styles.colorRow}>
              {COLORS.map((item) => {
                const selected = item === color;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.colorButton,
                      { backgroundColor: item },
                      selected && styles.colorButtonSelected,
                    ]}
                    onPress={() => setColor(item)}
                  >
                    {selected && <Text style={styles.colorCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>날짜</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#A4AAB5"
              style={styles.input}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.section}>
            <View style={styles.switchRow}>
              <Text style={styles.labelWithoutMargin}>하루 종일</Text>
              <Switch value={isAllDay} onValueChange={setIsAllDay} />
            </View>

            {!isAllDay && (
              <View style={styles.timeRow}>
                <TimePickerField label="시작" value={startTime} onChange={changeStartTime} />
                <TimePickerField label="종료" value={endTime} onChange={setEndTime} />
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>메모</Text>
            <TextInput
              value={memo}
              onChangeText={setMemo}
              placeholder="필요한 내용을 적어두세요."
              placeholderTextColor="#A4AAB5"
              style={[styles.input, styles.memoInput]}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.shareButton, pressed && styles.deleteButtonPressed]}
            onPress={() => void shareSchedule()}
          >
            <Text style={styles.shareButtonText}>
              {scheduleKind === 'member' ? '회원에게 일정 공유' : '일정 공유'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
            onPress={confirmDelete}
            disabled={saving || deleting}
          >
            <Text style={styles.deleteButtonText}>{deleting ? '삭제 중...' : '일정 삭제'}</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && !saving && styles.saveButtonPressed,
              (saving || deleting) && styles.saveButtonDisabled,
            ]}
            onPress={save}
            disabled={saving || deleting}
          >
            <Text style={styles.saveButtonText}>{saving ? '저장 중...' : '변경사항 저장'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {selectedMember ? (
        <MemberSignatureHistoryModal
          visible={signatureHistoryOpen}
          memberName={selectedMember.name}
          sessions={signedSessions}
          loading={signatureHistoryLoading}
          onClose={() => setSignatureHistoryOpen(false)}
        />
      ) : null}

      {selectedMember ? (
        <SessionSignatureModal
          visible={signatureOpen}
          memberName={selectedMember.name}
          remainingSessions={selectedMember.ptRemainingSessions}
          submitting={attendanceBusy}
          onClose={() => setSignatureOpen(false)}
          onSubmit={(signatureJson, sessionNote) =>
            void completeWithSignature(signatureJson, sessionNote)
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F8FA' },
  flex: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    height: 58,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerAction: { minWidth: 52, fontSize: 16, color: '#606775' },
  headerSpacer: { width: 52 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#171A21' },
  content: { padding: 24, paddingBottom: 32 },
  label: { marginBottom: 10, fontSize: 14, fontWeight: '800', color: '#4B5260' },
  labelWithoutMargin: { fontSize: 16, fontWeight: '700', color: '#252932' },
  section: { marginTop: 26 },
  sectionSmall: { marginTop: 16 },
  kindRow: {
    height: 48,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
    borderRadius: 16,
    backgroundColor: '#EDEFF3',
  },
  kindButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  kindButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  kindButtonText: { fontSize: 14, fontWeight: '800', color: '#858C98' },
  kindButtonTextActive: { color: '#252A32' },
  titleInput: {
    minHeight: 56,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    color: '#171A21',
  },
  dropdownButton: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  dropdownText: { flex: 1, fontSize: 16, fontWeight: '800', color: '#22262E' },
  dropdownPlaceholder: { fontWeight: '600', color: '#9AA0AA' },
  dropdownArrow: { marginLeft: 10, fontSize: 11, color: '#727986' },
  dropdownMenu: {
    marginTop: 6,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0E4EA',
  },
  dropdownItem: {
    minHeight: 48,
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECEFF3',
  },
  dropdownMemberInfo: { flex: 1 },
  dropdownMemberName: { fontSize: 15, fontWeight: '900', color: '#22262E' },
  dropdownMemberPhone: { marginTop: 2, fontSize: 12, color: '#8A909B' },
  dropdownCheck: { fontSize: 17, fontWeight: '900', color: '#4B68FF' },
  colorRow: { flexDirection: 'row', gap: 12 },
  colorButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorButtonSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  colorCheck: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  input: {
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#171A21',
  },
  switchRow: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  memoInput: { minHeight: 100, paddingTop: 16, paddingBottom: 16 },
  sessionCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sessionTitleInfo: { flex: 1, minWidth: 0 },
  sessionTitleActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  sessionActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  memberRecordButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EAF6F0',
  },
  memberRecordButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#2D7A57',
  },
  historyButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EEF1FF',
  },
  historyButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#4B68FF',
  },
  sessionTitle: { fontSize: 16, fontWeight: '900', color: '#20242C' },
  sessionSubText: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#7A818D' },
  warningBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#FFF2E4',
  },
  warningBadgeText: { fontSize: 10, fontWeight: '900', color: '#D97615' },
  trainingLogButton: {
    minHeight: 54,
    marginTop: 12,
    paddingHorizontal: 13,
    borderRadius: 13,
    justifyContent: 'center',
    backgroundColor: '#EAF6F0',
  },
  trainingLogButtonTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#2D7A57',
  },
  trainingLogButtonSub: {
    marginTop: 3,
    fontSize: 10,
    color: '#5E8875',
  },
  previousNoteCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F5F7FA',
  },
  previousNoteLabel: { fontSize: 10, fontWeight: '800', color: '#858C98' },
  previousNoteText: { marginTop: 5, fontSize: 13, lineHeight: 18, color: '#343A44' },
  completedCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 13,
    backgroundColor: '#EAF8EE',
  },
  completedTitle: { fontSize: 13, fontWeight: '900', color: '#278149' },
  completedNote: { marginTop: 6, fontSize: 12, lineHeight: 17, color: '#4F6958' },
  statusCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 13,
    backgroundColor: '#F0F2F5',
  },
  statusText: { fontSize: 13, fontWeight: '800', color: '#69707B' },
  signatureButton: {
    minHeight: 62,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4B68FF',
  },
  signatureButtonText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  signatureButtonHint: { marginTop: 3, fontSize: 10, fontWeight: '600', color: '#DDE3FF' },
  attendanceRow: { marginTop: 9, flexDirection: 'row', gap: 8 },
  attendanceButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF1F4',
  },
  attendanceButtonText: { fontSize: 12, fontWeight: '800', color: '#626A76' },
  shareButton: {
    height: 48,
    marginTop: 26,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF1FF',
  },
  shareButtonText: { fontSize: 14, fontWeight: '800', color: '#4B68FF' },
  deleteButton: {
    height: 52,
    marginTop: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F2',
  },
  deleteButtonPressed: { opacity: 0.8 },
  deleteButtonText: { fontSize: 15, fontWeight: '800', color: '#D9364F' },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: '#F7F8FA',
  },
  saveButton: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4B68FF',
  },
  saveButtonPressed: { opacity: 0.88 },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
