import { router } from 'expo-router';
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

export default function NewScheduleScreen() {
  const db = useSQLiteContext();
  const today = useMemo(() => new Date(), []);
  const todayString = useMemo(() => toLocalDateString(today), [today]);
  const tomorrowString = useMemo(() => toLocalDateString(addDays(today, 1)), [today]);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayString);
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      Alert.alert('일정 이름을 입력해 주세요.');
      return;
    }

    if (!isValidDateInput(date)) {
      Alert.alert('날짜를 확인해 주세요.', '예: 2026-09-15');
      return;
    }

    if (!isAllDay && (!isValidTimeInput(startTime) || !isValidTimeInput(endTime))) {
      Alert.alert('시간을 확인해 주세요.', '24시간 형식으로 입력해 주세요. 예: 09:30');
      return;
    }

    if (!isAllDay && startTime > endTime) {
      Alert.alert('종료 시간을 확인해 주세요.', '종료 시간은 시작 시간보다 빠를 수 없어요.');
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
          <Pressable onPress={save} disabled={saving} hitSlop={12}>
            <Text style={[styles.headerSave, saving && styles.disabledText]}>
              {saving ? '저장 중' : '저장'}
            </Text>
          </Pressable>
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
            <Text style={styles.label}>날짜</Text>
            <View style={styles.quickRow}>
              <Pressable
                style={[styles.quickButton, date === todayString && styles.quickButtonActive]}
                onPress={() => setDate(todayString)}
              >
                <Text
                  style={[
                    styles.quickButtonText,
                    date === todayString && styles.quickButtonTextActive,
                  ]}
                >
                  오늘
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.quickButton,
                  date === tomorrowString && styles.quickButtonActive,
                ]}
                onPress={() => setDate(tomorrowString)}
              >
                <Text
                  style={[
                    styles.quickButtonText,
                    date === tomorrowString && styles.quickButtonTextActive,
                  ]}
                >
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#171A21',
  },
  headerSave: {
    minWidth: 52,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '800',
    color: '#4B68FF',
  },
  disabledText: {
    opacity: 0.45,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
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
});
