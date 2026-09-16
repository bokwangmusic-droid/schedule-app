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
import {
  deleteSchedule,
  getScheduleById,
  updateSchedule,
} from '../../src/data/scheduleRepository';
import { isValidDateInput, isValidTimeInput } from '../../src/lib/date';

const COLORS = ['#5B8DEF', '#91D948', '#FF4E7D', '#9C6ADE', '#FF9F43', '#37B8A5'];

export default function EditScheduleScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [loading, setLoading] = useState(true);
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
        const schedule = await getScheduleById(db, id);
        if (!active) return;

        if (!schedule) {
          Alert.alert('일정을 찾을 수 없어요.');
          router.back();
          return;
        }

        setTitle(schedule.title);
        setDate(schedule.date);
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
      await updateSchedule(db, id, {
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
          <Text style={styles.label}>일정</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="무엇을 할 예정인가요?"
            placeholderTextColor="#A4AAB5"
            style={styles.titleInput}
          />

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
                <View style={styles.timeField}>
                  <Text style={styles.smallLabel}>시작</Text>
                  <TextInput
                    value={startTime}
                    onChangeText={setStartTime}
                    style={styles.input}
                    maxLength={5}
                  />
                </View>
                <View style={styles.timeField}>
                  <Text style={styles.smallLabel}>종료</Text>
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
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
  titleInput: {
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    color: '#171A21',
  },
  section: { marginTop: 28 },
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
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#171A21',
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
  timeRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  timeField: { flex: 1 },
  smallLabel: { marginBottom: 8, fontSize: 13, fontWeight: '700', color: '#7C8493' },
  memoInput: { minHeight: 120, paddingTop: 16, paddingBottom: 16 },
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
