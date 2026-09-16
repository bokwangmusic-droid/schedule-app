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

function addOneHour(time: string) {
  if (!isValidTimeInput(time)) return '10:00';
  const [hour, minute] = time.split(':').map(Number);
  if (hour >= 23) return '23:59';
  return `${String(hour + 1).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export default function NewScheduleScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ date?: string; startTime?: string }>();
  const today = useMemo(() => new Date(), []);
  const todayString = useMemo(() => toLocalDateString(today), [today]);
  const tomorrowString = useMemo(() => toLocalDateString(addDays(today, 1)), [today]);
  const initialDate = typeof params.date === 'string' && isValidDateInput(params.date)
    ? params.date
    : todayString;
  const initialStartTime = typeof params.startTime === 'string' && isValidTimeInput(params.startTime)
    ? params.startTime
    : '09:00';

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(addOneHour(initialStartTime));
  const [memo, setMemo] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listMembers(db).then(setMembers).catch(console.error);
  }, [db]);

  const selectedMember = members.find((member) => member.id === memberId) ?? null;

  const chooseMember = (member: MemberItem | null) => {
    const previousName = selectedMember?.name ?? '';
    if (member) {
      if (!title.trim() || title === previousName) setTitle(member.name);
      setMemberId(member.id);
    } else {
      if (title === previousName) setTitle('');
      setMemberId(null);
    }
    setMemberOpen(false);
  };

  const save = async () => {
    const trimmedTitle = title.trim() || selectedMember?.name || '';

    if (!trimmedTitle) {
      Alert.alert('일정 이름이나 회원을 선택해 주세요.');
      return;
    }

    if (!isValidDateInput(date)) {
      Alert.alert('날짜를 확인해 주세요.', '예: 2026-09-16');
      return;
    }

    if (!isAllDay && (!isValidTimeInput(startTime) || !isValidTimeInput(endTime))) {
      Alert.alert('시간을 확인해 주세요.', '24시간 형식으로 입력해 주세요. 예: 09:30');
      return;
    }

    if (!isAllDay && startTime >= endTime) {
      Alert.alert('종료 시간을 확인해 주세요.', '종료 시간은 시작 시간보다 늦어야 해요.');
      return;
    }

    try {
      setSaving(true);
      await createSchedule(db, {
        title: trimmedTitle,
        date,
        startTime: isAllDay ? null : startTime,
        endTime: isAllDay ? null : endTime,
        memo,
        color,
        memberId,
        isAllDay,
      });
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
          <Text style={styles.label}>회원 선택</Text>
          <Pressable style={styles.dropdownButton} onPress={() => setMemberOpen((open) => !open)}>
            <Text style={[styles.dropdownText, !selectedMember && styles.dropdownPlaceholder]}>
              {selectedMember?.name ?? '회원을 선택하세요'}
            </Text>
            <Text style={styles.dropdownArrow}>{memberOpen ? '▲' : '▼'}</Text>
          </Pressable>
          {memberOpen && (
            <View style={styles.dropdownMenu}>
              <Pressable style={styles.dropdownItem} onPress={() => chooseMember(null)}>
                <Text style={styles.dropdownItemText}>회원 지정 안 함</Text>
              </Pressable>
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

          <View style={styles.section}>
            <Text style={styles.label}>일정명</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="예: 홍길동 PT"
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
                <View style={styles.timeField}>
                  <Text style={styles.smallLabel}>시작</Text>
                  <TextInput
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="09:00"
                    placeholderTextColor="#A4AAB5"
                    style={styles.input}
                    maxLength={5}
                  />
                </View>
                <View style={styles.timeField}>
                  <Text style={styles.smallLabel}>종료</Text>
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="10:00"
                    placeholderTextColor="#A4AAB5"
                    style={styles.input}
                    maxLength={5}
                  />
                </View>
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
  dropdownItemText: { fontSize: 14, fontWeight: '700', color: '#646B77' },
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
  timeField: { flex: 1 },
  smallLabel: { marginBottom: 8, fontSize: 13, fontWeight: '700', color: '#7C8493' },
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
