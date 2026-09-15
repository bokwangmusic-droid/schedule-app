import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listSchedulesForRange } from '../src/data/scheduleRepository';
import {
  addDays,
  formatWeekRange,
  startOfWeekMonday,
  toLocalDateString,
} from '../src/lib/date';
import type { ScheduleItem } from '../src/types/schedule';

const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_HEIGHT = 64;
const TIME_GUTTER = 38;
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const EVENT_COLORS = ['#5B8DEF', '#91D948', '#FF4E7D', '#9C6ADE', '#FF9F43', '#37B8A5'];

function timeToMinutes(value: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function scheduleColor(schedule: ScheduleItem) {
  let hash = 0;
  for (let index = 0; index < schedule.title.length; index += 1) {
    hash = (hash * 31 + schedule.title.charCodeAt(index)) >>> 0;
  }
  return EVENT_COLORS[hash % EVENT_COLORS.length];
}

function scheduleTimeLabel(schedule: ScheduleItem) {
  if (schedule.isAllDay) return '하루 종일';
  if (schedule.startTime && schedule.endTime) return `${schedule.startTime} - ${schedule.endTime}`;
  return schedule.startTime ?? '시간 미정';
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const today = useMemo(() => new Date(), []);
  const todayWeekStart = useMemo(() => startOfWeekMonday(today), [today]);
  const [weekStart, setWeekStart] = useState(todayWeekStart);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekStartString = toLocalDateString(weekDates[0]);
  const weekEndString = toLocalDateString(weekDates[6]);
  const todayString = toLocalDateString(today);
  const dayWidth = Math.max((width - TIME_GUTTER) / 7, 42);
  const timetableWidth = TIME_GUTTER + dayWidth * 7;
  const gridHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  const loadSchedules = useCallback(async () => {
    try {
      const rows = await listSchedulesForRange(db, weekStartString, weekEndString);
      setSchedules(rows);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [db, weekEndString, weekStartString]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadSchedules();
    }, [loadSchedules]),
  );

  const timedSchedules = schedules.filter(
    (item) => !item.isAllDay && item.startTime && item.endTime,
  );
  const allDaySchedules = schedules.filter((item) => item.isAllDay);

  const openNewSchedule = (date?: string, startTime?: string) => {
    router.push({
      pathname: '/schedule/new',
      params: {
        ...(date ? { date } : {}),
        ...(startTime ? { startTime } : {}),
      },
    });
  };

  const showSchedule = (schedule: ScheduleItem) => {
    const memo = schedule.memo ? `\n\n${schedule.memo}` : '';
    Alert.alert(schedule.title, `${scheduleTimeLabel(schedule)}${memo}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.weekNavigation}>
          <Pressable
            accessibilityLabel="이전 주"
            style={styles.roundButton}
            onPress={() => setWeekStart((current) => addDays(current, -7))}
          >
            <Text style={styles.roundButtonText}>‹</Text>
          </Pressable>

          <View style={styles.weekTitleWrap}>
            <Text style={styles.weekTitle}>{formatWeekRange(weekStart)}</Text>
            <Text style={styles.weekSubtitle}>주간 시간표</Text>
          </View>

          <Pressable
            accessibilityLabel="다음 주"
            style={styles.roundButton}
            onPress={() => setWeekStart((current) => addDays(current, 7))}
          >
            <Text style={styles.roundButtonText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.todayButton} onPress={() => setWeekStart(todayWeekStart)}>
            <Text style={styles.todayButtonText}>오늘</Text>
          </Pressable>
          <Pressable style={styles.addButton} onPress={() => openNewSchedule(todayString)}>
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.dayHeader, { width: timetableWidth }]}>
        <View style={{ width: TIME_GUTTER }} />
        {weekDates.map((date, index) => {
          const dateString = toLocalDateString(date);
          const isToday = dateString === todayString;
          return (
            <View key={dateString} style={[styles.dayHeaderCell, { width: dayWidth }]}>
              <Text style={[styles.dayName, isToday && styles.todayText]}>{DAYS[index]}</Text>
              <View style={[styles.dayNumberWrap, isToday && styles.todayNumberWrap]}>
                <Text style={[styles.dayNumber, isToday && styles.todayNumber]}>{date.getDate()}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {allDaySchedules.length > 0 && (
        <View style={styles.allDayStrip}>
          <Text style={styles.allDayLabel}>종일</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.allDayContent}>
            {allDaySchedules.map((schedule) => (
              <Pressable
                key={schedule.id}
                style={[styles.allDayChip, { backgroundColor: scheduleColor(schedule) }]}
                onPress={() => showSchedule(schedule)}
              >
                <Text numberOfLines={1} style={styles.allDayChipText}>{schedule.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#4B68FF" />
        </View>
      ) : (
        <ScrollView style={styles.gridScroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.grid, { width: timetableWidth, height: gridHeight }]}>
            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => {
              const hour = START_HOUR + index;
              const top = index * HOUR_HEIGHT;
              return (
                <View key={`hour-${hour}`} style={[styles.hourLineRow, { top }]} pointerEvents="none">
                  {hour < END_HOUR && <Text style={styles.hourLabel}>{hour}</Text>}
                  <View style={styles.hourLine} />
                </View>
              );
            })}

            {weekDates.map((date, dayIndex) => {
              const dateString = toLocalDateString(date);
              return (
                <View
                  key={`column-${dateString}`}
                  pointerEvents="none"
                  style={[
                    styles.dayColumn,
                    {
                      left: TIME_GUTTER + dayIndex * dayWidth,
                      width: dayWidth,
                      height: gridHeight,
                    },
                  ]}
                />
              );
            })}

            {weekDates.flatMap((date, dayIndex) => {
              const dateString = toLocalDateString(date);
              return Array.from({ length: END_HOUR - START_HOUR }, (_, hourIndex) => {
                const hour = START_HOUR + hourIndex;
                const startTime = `${String(hour).padStart(2, '0')}:00`;
                return (
                  <Pressable
                    key={`${dateString}-${hour}`}
                    accessibilityLabel={`${dateString} ${startTime} 일정 추가`}
                    style={[
                      styles.slotButton,
                      {
                        left: TIME_GUTTER + dayIndex * dayWidth,
                        top: hourIndex * HOUR_HEIGHT,
                        width: dayWidth,
                        height: HOUR_HEIGHT,
                      },
                    ]}
                    onPress={() => openNewSchedule(dateString, startTime)}
                  />
                );
              });
            })}

            {timedSchedules.map((schedule) => {
              const dayIndex = weekDates.findIndex(
                (date) => toLocalDateString(date) === schedule.date,
              );
              const startMinutes = timeToMinutes(schedule.startTime);
              const endMinutes = timeToMinutes(schedule.endTime);
              if (dayIndex < 0 || startMinutes === null || endMinutes === null) return null;

              const gridStartMinutes = START_HOUR * 60;
              const gridEndMinutes = END_HOUR * 60;
              if (endMinutes <= gridStartMinutes || startMinutes >= gridEndMinutes) return null;

              const visibleStart = Math.max(startMinutes, gridStartMinutes);
              const visibleEnd = Math.min(Math.max(endMinutes, visibleStart + 15), gridEndMinutes);
              const top = ((visibleStart - gridStartMinutes) / 60) * HOUR_HEIGHT;
              const height = Math.max(((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT, 24);

              return (
                <Pressable
                  key={schedule.id}
                  style={[
                    styles.eventBlock,
                    {
                      left: TIME_GUTTER + dayIndex * dayWidth + 2,
                      top: top + 1,
                      width: Math.max(dayWidth - 4, 36),
                      height: height - 2,
                      backgroundColor: scheduleColor(schedule),
                      opacity: schedule.isCompleted ? 0.55 : 1,
                    },
                  ]}
                  onPress={() => showSchedule(schedule)}
                >
                  <Text numberOfLines={height < 42 ? 1 : 3} style={styles.eventTitle}>
                    {schedule.title}
                  </Text>
                  {height >= 58 && schedule.startTime && (
                    <Text numberOfLines={1} style={styles.eventTime}>{schedule.startTime}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
  },
  roundButtonText: {
    marginTop: -3,
    fontSize: 34,
    fontWeight: '300',
    color: '#30343B',
  },
  weekTitleWrap: {
    minWidth: 170,
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#171A21',
  },
  weekSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: '#9298A3',
  },
  actions: {
    position: 'absolute',
    right: 12,
    top: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayButton: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F2F6',
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#59606D',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4B68FF',
  },
  addButtonText: {
    marginTop: -2,
    fontSize: 26,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  dayHeader: {
    minHeight: 58,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDE1E7',
    backgroundColor: '#FFFFFF',
  },
  dayHeaderCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 5,
  },
  dayName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A909B',
  },
  dayNumberWrap: {
    minWidth: 28,
    height: 26,
    marginTop: 2,
    paddingHorizontal: 4,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayNumberWrap: {
    backgroundColor: '#4B68FF',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5E6572',
  },
  todayText: {
    color: '#4B68FF',
  },
  todayNumber: {
    color: '#FFFFFF',
  },
  allDayStrip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FAFBFC',
  },
  allDayLabel: {
    width: TIME_GUTTER,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: '#8A909B',
  },
  allDayContent: {
    gap: 6,
    paddingVertical: 5,
    paddingRight: 12,
  },
  allDayChip: {
    maxWidth: 120,
    minHeight: 28,
    paddingHorizontal: 9,
    borderRadius: 8,
    justifyContent: 'center',
  },
  allDayChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  grid: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  hourLineRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourLabel: {
    width: TIME_GUTTER - 5,
    marginTop: -18,
    paddingRight: 4,
    textAlign: 'right',
    fontSize: 10,
    color: '#9298A3',
  },
  hourLine: {
    position: 'absolute',
    left: TIME_GUTTER,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#DDE1E7',
  },
  dayColumn: {
    position: 'absolute',
    top: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#E1E4E9',
  },
  slotButton: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  eventBlock: {
    position: 'absolute',
    zIndex: 2,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  eventTime: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
});
