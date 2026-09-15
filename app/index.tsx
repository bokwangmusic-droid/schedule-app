import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  listSchedulesForDate,
  setScheduleCompleted,
} from '../src/data/scheduleRepository';
import { formatKoreanDate, toLocalDateString } from '../src/lib/date';
import type { ScheduleItem } from '../src/types/schedule';

function scheduleTimeLabel(schedule: ScheduleItem) {
  if (schedule.isAllDay) return '하루 종일';
  if (schedule.startTime && schedule.endTime) {
    return `${schedule.startTime} - ${schedule.endTime}`;
  }
  return schedule.startTime ?? '시간 미정';
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const today = useMemo(() => new Date(), []);
  const todayString = useMemo(() => toLocalDateString(today), [today]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSchedules = useCallback(async () => {
    try {
      const rows = await listSchedulesForDate(db, todayString);
      setSchedules(rows);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [db, todayString]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadSchedules();
    }, [loadSchedules]),
  );

  const toggleCompleted = async (schedule: ScheduleItem) => {
    await setScheduleCompleted(db, schedule.id, !schedule.isCompleted);
    await loadSchedules();
  };

  const remainingCount = schedules.filter((item) => !item.isCompleted).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MY SCHEDULE</Text>
            <Text style={styles.title}>오늘 일정</Text>
            <Text style={styles.subtitle}>
              {formatKoreanDate(today)} · {remainingCount === 0 ? '남은 일정 없음' : `${remainingCount}개 남음`}
            </Text>
          </View>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeDay}>{today.getDate()}</Text>
            <Text style={styles.dateBadgeMonth}>{today.getMonth() + 1}월</Text>
          </View>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={schedules.length === 0 ? styles.emptyListContent : styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color="#4B68FF" />
            </View>
          ) : schedules.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>✓</Text>
              <Text style={styles.emptyTitle}>오늘은 비어 있어요</Text>
              <Text style={styles.emptyDescription}>
                첫 일정을 추가해서 하루 계획을 시작해보세요.
              </Text>
            </View>
          ) : (
            schedules.map((schedule) => (
              <View key={schedule.id} style={styles.scheduleCard}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: schedule.isCompleted }}
                  style={[
                    styles.checkButton,
                    schedule.isCompleted && styles.checkButtonCompleted,
                  ]}
                  onPress={() => void toggleCompleted(schedule)}
                >
                  <Text
                    style={[
                      styles.checkMark,
                      schedule.isCompleted && styles.checkMarkCompleted,
                    ]}
                  >
                    ✓
                  </Text>
                </Pressable>

                <View style={styles.scheduleContent}>
                  <Text
                    style={[
                      styles.scheduleTime,
                      schedule.isCompleted && styles.completedText,
                    ]}
                  >
                    {scheduleTimeLabel(schedule)}
                  </Text>
                  <Text
                    style={[
                      styles.scheduleTitle,
                      schedule.isCompleted && styles.completedTitle,
                    ]}
                  >
                    {schedule.title}
                  </Text>
                  {!!schedule.memo && (
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.scheduleMemo,
                        schedule.isCompleted && styles.completedText,
                      ]}
                    >
                      {schedule.memo}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          onPress={() => router.push('/schedule/new')}
        >
          <Text style={styles.addButtonText}>+ 일정 추가</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#7C8493',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    color: '#171A21',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#7C8493',
  },
  dateBadge: {
    width: 62,
    minHeight: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  dateBadgeDay: {
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '900',
    color: '#4B68FF',
  },
  dateBadgeMonth: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: '#8A91A0',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 12,
    paddingBottom: 18,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  loadingWrap: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 42,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 28,
    fontWeight: '700',
    color: '#4B68FF',
    backgroundColor: '#EEF1FF',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#171A21',
  },
  emptyDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#7C8493',
    textAlign: 'center',
  },
  scheduleCard: {
    minHeight: 92,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.035,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  checkButton: {
    width: 34,
    height: 34,
    marginRight: 14,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#D8DDE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonCompleted: {
    borderColor: '#4B68FF',
    backgroundColor: '#4B68FF',
  },
  checkMark: {
    fontSize: 17,
    fontWeight: '900',
    color: 'transparent',
  },
  checkMarkCompleted: {
    color: '#FFFFFF',
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleTime: {
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '800',
    color: '#4B68FF',
  },
  scheduleTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    color: '#20232A',
  },
  scheduleMemo: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#858C99',
  },
  completedTitle: {
    color: '#9AA0AC',
    textDecorationLine: 'line-through',
  },
  completedText: {
    color: '#A7ADB8',
  },
  addButton: {
    height: 56,
    marginTop: 10,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4B68FF',
  },
  addButtonPressed: {
    opacity: 0.88,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
