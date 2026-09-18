import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
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
import { createSchedule } from '../../src/data/scheduleRepository';
import {
  addDays,
  isValidDateInput,
  isValidTimeInput,
  toLocalDateString,
} from '../../src/lib/date';
import type { MemberItem } from '../../src/types/member';

const COLORS = ['#5B8DEF', '#91D948', '#FF4E7D', '#9C6ADE', '#FF9F43', '#37B8A5'];
type ScheduleKind = 'member' | 'personal';
const REPEAT_COUNTS = [1, 4, 8, 12] as const;

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addOneHour(time: string) {
  if (!isValidTimeInput(time)) return '10:00';
  const [hour, minute] = time.split(':').map(Number);
  if (hour >= 23) return '23:59';
  return `${String(hour + 1).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export default function NewScheduleScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ date?: string; startTime?: string; endTime?: string }>();
  const today = useMemo(() => new Date(), []);
  const todayString = useMemo(() => toLocalDateString(today), [today]);
  const tomorrowString = useMemo(() => toLocalDateString(addDays(today, 1)), [today]);
  const initialDate = typeof params.date === 'string' && isValidDateInput(params.date)
    ? params.date
    : todayString;
  const initialStartTime = typeof params.startTime === 'string' && isValidTimeInput(params.startTime)
    ? params.startTime
    : '09:00';
  const initialEndTime =
    typeof params.endTime === 'string' &&
    isValidTimeInput(params.endTime) &&
    params.endTime > initialStartTime
      ? params.endTime
      : addOneHour(initialStartTime);

  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>('member');
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [memo, setMemo] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [repeatCount, setRepeatCount] = useState<(typeof REPEAT_COUNTS)[number]>(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listMembers(db).then(setMembers).catch(console.error);
  }, [db]);

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
      const occurrences = scheduleKind === 'member' ? repeatCount : 1;
      const firstDate = parseLocalDate(date);

      for (let index = 0; index < occurrences; index += 1) {
        await createSchedule(db, {
          title: trimmedTitle,
          date: toLocalDateString(addDays(firstDate, index * 7)),
          startTime: isAllDay ? null : startTime,
          endTime: isAllDay ? null : endTime,
          memo,
          color,
          memberId: scheduleKind === 'member' ? memberId : null,
          isAllDay,
        });
      }
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('일정을 저장하지 못했어요.', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

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
          <Text style={styles.headerTitle}>새 일정</Text>
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
                  {members.length === 0 ? (
                    <Text style={styles.dropdownEmpty}>먼저 시간표의 회원 메뉴에서 회원을 등록해 주세요.</Text>
                  ) : null}
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
              returnKeyType="next"
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
                    accessibilityLabel={`일정 색상 ${item}`}
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
            <View style={styles.quickRow}>
              <Pressable
                style={[styles.quickButton, date === todayString && styles.quickButtonActive]}
                onPress={() => setDate(todayString)}
              >
                <Text style={[styles.quickButtonText, date === todayString && styles.quickButtonTextActive]}>오늘</Text>
              </Pressable>
              <Pressable
                style={[styles.quickButton, date === tomorrowString && styles.quickButtonActive]}
                onPress={() => setDate(tomorrowString)}
              >
                <Text style={[styles.quickButtonText, date === tomorrowString && styles.quickButtonTextActive]}>내일</Text>
              </Pressable>
            </View>
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

          {scheduleKind === 'member' ? (
            <View style={styles.section}>
              <Text style={styles.label}>반복 예약</Text>
              <View style={styles.repeatRow}>
                {REPEAT_COUNTS.map((count) => {
                  const selected = repeatCount === count;
                  return (
                    <Pressable
                      key={count}
                      style={[styles.repeatButton, selected && styles.repeatButtonActive]}
                      onPress={() => setRepeatCount(count)}
                    >
                      <Text style={[styles.repeatButtonText, selected && styles.repeatButtonTextActive]}>
                        {count === 1 ? '1회' : `${count}주`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.repeatHint}>
                매주 같은 요일·시간으로 생성되며, 생성 후 각 수업은 따로 이동하거나 취소할 수 있어요.
              </Text>
            </View>
          ) : null}

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
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && !saving && styles.saveButtonPressed,
              saving && styles.saveButtonDisabled,
            ]}
            onPress={save}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{saving ? '저장 중...' : '일정 저장'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F8FA' },
  flex: { flex: 1 },
  header: {
    height: 58,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F7F8FA',
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
  dropdownEmpty: { padding: 14, fontSize: 12, lineHeight: 18, color: '#9298A3' },
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
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  quickButton: {
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECEEF2',
  },
  quickButtonActive: { backgroundColor: '#E9EDFF' },
  quickButtonText: { fontSize: 14, fontWeight: '700', color: '#686F7D' },
  quickButtonTextActive: { color: '#4B68FF' },
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
  repeatRow: { flexDirection: 'row', gap: 8 },
  repeatButton: {
    flex: 1,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECEEF2',
  },
  repeatButtonActive: { backgroundColor: '#E9EDFF' },
  repeatButtonText: { fontSize: 13, fontWeight: '800', color: '#777E8A' },
  repeatButtonTextActive: { color: '#4B68FF' },
  repeatHint: { marginTop: 8, fontSize: 11, lineHeight: 16, color: '#8D949F' },
  memoInput: { minHeight: 100, paddingTop: 16, paddingBottom: 16 },
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
