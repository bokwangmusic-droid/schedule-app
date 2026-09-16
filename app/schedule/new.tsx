import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
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
import { createSchedule } from '../../src/data/scheduleRepository';
import {
  addDays,
  isValidDateInput,
  isValidTimeInput,
  toLocalDateString,
} from '../../src/lib/date';

const COLORS = ['#5B8DEF', '#91D948', '#FF4E7D', '#9C6ADE', '#FF9F43', '#37B8A5'];

function addOneHour(time: string) {
  if (!isValidTimeInput(time)) return '10:00';
  const [hour, minute] = time.split(':').map(Number);
  return `${String(Math.min(hour + 1, 23)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(addOneHour(initialStartTime));
  const [memo, setMemo] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      Alert.alert('일정 이름을 입력해 주세요.');
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
          <Text style={styles.label}>일정</Text>
          <TextInput
            autoFocus
            value={title}
            onChangeText={setTitle}
            placeholder="무엇을 할 예정인가요?"
            placeholderTextColor="#A4AAB5"
            style={styles.titleInput}
            returnKeyType="next"
          />

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
                <Text style={[styles.quickButtonText, date === todayString && styles.quickButtonTextActive]}>
                  오늘
                </Text>
              </Pressable>
              <Pressable
                style={[styles.quickButton, date === tomorrowString && styles.quickButtonActive]}
                onPress={() => setDate(tomorrowString)}
              >
                <Text style={[styles.quickButtonText, date === tomorrowString && styles.quickButtonTextActive]}>
                  내일
                </Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  flex: {
    flex: 1,
  },
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
  headerAction: {
    minWidth: 52,
    fontSize: 16,
    color: '#606775',
  },
  headerSpacer: {
    width: 52,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#171A21',
  },
  content: {
    padding: 24,
    paddingBottom: 32,
  },
  label: {
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '800',
    color: '#4B5260',
  },
  labelWithoutMargin: {
    fontSize: 16,
    fontWeight: '700',
    color: '#252932',
  },
  titleInput: {
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    color: '#171A21',
  },
  section: {
    marginTop: 28,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
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
  colorCheck: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#171A21',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  quickButton: {
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECEEF2',
  },
  quickButtonActive: {
    backgroundColor: '#E9EDFF',
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#686F7D',
  },
  quickButtonTextActive: {
    color: '#4B68FF',
  },
  switchRow: {
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  timeField: {
    flex: 1,
  },
  smallLabel: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#7C8493',
  },
  memoInput: {
    minHeight: 120,
    paddingTop: 16,
    paddingBottom: 16,
  },
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
  saveButtonPressed: {
    opacity: 0.88,
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
