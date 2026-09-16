import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimePickerField } from '../../src/components/TimePickerField';
import { listMembers } from '../../src/data/memberRepository';
import {
  deleteSchedule,
  getScheduleById,
  updateSchedule,
} from '../../src/data/scheduleRepository';
import { isValidDateInput, isValidTimeInput } from '../../src/lib/date';
import type { MemberItem } from '../../src/types/member';

const COLORS = ['#5B8DEF', '#91D948', '#FF4E7D', '#9C6ADE', '#FF9F43', '#37B8A5'];
type ScheduleKind = 'member' | 'personal';

function addOneHour(time: string) {
  if (!isValidTimeInput(time)) return '10:00';
  const [hour, minute] = time.split(':').map(Number);
  if (hour >= 23) return '23:59';
  return `${String(hour + 1).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export default function EditScheduleScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [loading, setLoading] = useState(true);
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

  const chooseKind = (kind: ScheduleKind) => {
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

  const confirmDelete = () => {
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
