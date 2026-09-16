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
import { listSchedulesForRange } from '../src/data/scheduleRepository';
import { addDays, toLocalDateString } from '../src/lib/date';
import type { ScheduleItem } from '../src/types/schedule';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const FALLBACK_COLORS = ['#5B8DEF', '#91D948', '#FF4E7D', '#9C6ADE', '#FF9F43', '#37B8A5'];

function startOfCalendarGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  return addDays(first, -offset);
}

function monthTitle(month: Date) {
  return `${month.getFullYear()}년 ${month.getMonth() + 1}월`;
}

function scheduleColor(schedule: ScheduleItem) {
  if (schedule.color) return schedule.color;
  let hash = 0;
  for (let index = 0; index < schedule.title.length; index += 1) {
    hash = (hash * 31 + schedule.title.charCodeAt(index)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function scheduleLabel(schedule: ScheduleItem) {
  return schedule.memberName ?? schedule.title;
}

export default function CalendarScreen() {
  const db = useSQLiteContext();
  const today = useMemo(() => new Date(), []);
  const todayString = toLocalDateString(today);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayString);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const gridStart = useMemo(() => startOfCalendarGrid(month), [month]);
  const gridDates = useMemo(
    () => Array.from({ length: 42 }, (_, index) => addDays(gridStart, index)),
    [gridStart],
  );
  const gridStartString = toLocalDateString(gridDates[0]);
  const gridEndString = toLocalDateString(gridDates[41]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await listSchedulesForRange(db, gridStartString, gridEndString);
      setSchedules(rows);
    } finally {
      setLoading(false);
    }
  }, [db, gridEndString, gridStartString]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const schedule of schedules) {
      const items = map.get(schedule.date) ?? [];
      items.push(schedule);
      map.set(schedule.date, items);
    }
    return map;
  }, [schedules]);

  const selectedSchedules = schedulesByDate.get(selectedDate) ?? [];

  const changeMonth = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    setSelectedDate(toLocalDateString(next));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>달력</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.monthHeader}>
        <Pressable style={styles.monthArrowButton} onPress={() => changeMonth(-1)}>
          <Text style={styles.monthArrowText}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{monthTitle(month)}</Text>
        <Pressable style={styles.monthArrowButton} onPress={() => changeMonth(1)}>
          <Text style={styles.monthArrowText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {DAYS.map((day) => (
          <View key={day} style={styles.weekCell}>
            <Text style={styles.weekText}>{day}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#4B68FF" />
        </View>
      ) : (
        <>
          <View style={styles.calendarGrid}>
            {gridDates.map((date) => {
              const dateString = toLocalDateString(date);
              const inMonth = date.getMonth() === month.getMonth();
              const isToday = dateString === todayString;
              const selected = dateString === selectedDate;
              const daySchedules = schedulesByDate.get(dateString) ?? [];

              return (
                <Pressable
                  key={dateString}
                  style={[styles.dateCell, selected && styles.dateCellSelected]}
                  onPress={() => setSelectedDate(dateString)}
                >
                  <View style={[styles.dateNumberWrap, isToday && styles.todayWrap]}>
                    <Text
                      style={[
                        styles.dateNumber,
                        !inMonth && styles.outMonthText,
                        isToday && styles.todayText,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                  <View style={styles.dotRow}>
                    {daySchedules.slice(0, 3).map((item) => (
                      <View
                        key={item.id}
                        style={[styles.dot, { backgroundColor: scheduleColor(item) }]}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.selectedHeader}>
            <Text style={styles.selectedTitle}>{selectedDate}</Text>
            <Pressable
              style={styles.addButton}
              onPress={() => router.push({ pathname: '/schedule/new', params: { date: selectedDate } })}
            >
              <Text style={styles.addButtonText}>+ 일정</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scheduleList} contentContainerStyle={styles.scheduleListContent}>
            {selectedSchedules.length === 0 ? (
              <Text style={styles.emptyText}>등록된 일정이 없어요.</Text>
            ) : (
              selectedSchedules.map((schedule) => (
                <Pressable
                  key={schedule.id}
                  style={styles.scheduleRow}
                  onPress={() => router.push({ pathname: '/schedule/[id]', params: { id: schedule.id } })}
                >
                  <View style={[styles.colorBar, { backgroundColor: scheduleColor(schedule) }]} />
                  <View style={styles.scheduleTextWrap}>
                    <Text style={styles.scheduleTitle}>{scheduleLabel(schedule)}</Text>
                    <Text style={styles.scheduleTime}>
                      {schedule.isAllDay
                        ? '하루 종일'
                        : `${schedule.startTime ?? '--:--'} - ${schedule.endTime ?? '--:--'}`}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E7E9ED',
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { marginTop: -4, fontSize: 34, fontWeight: '300', color: '#252932' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '900', color: '#1E2229' },
  headerSpacer: { width: 44 },
  monthHeader: {
    height: 54,
    paddingHorizontal: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthArrowButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  monthArrowText: { marginTop: -4, fontSize: 30, fontWeight: '300', color: '#30343B' },
  monthTitle: { fontSize: 18, fontWeight: '900', color: '#22262D' },
  weekRow: { height: 30, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E4E8' },
  weekCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  weekText: { fontSize: 11, fontWeight: '800', color: '#838995' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  calendarGrid: { height: 300, flexDirection: 'row', flexWrap: 'wrap' },
  dateCell: {
    width: `${100 / 7}%`,
    height: 50,
    alignItems: 'center',
    paddingTop: 5,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  dateCellSelected: { backgroundColor: '#F2F5FF' },
  dateNumberWrap: { minWidth: 24, height: 24, paddingHorizontal: 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  todayWrap: { backgroundColor: '#4B68FF' },
  dateNumber: { fontSize: 12, fontWeight: '800', color: '#333842' },
  outMonthText: { color: '#B8BDC6' },
  todayText: { color: '#FFFFFF' },
  dotRow: { height: 8, marginTop: 2, flexDirection: 'row', gap: 2, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  selectedHeader: {
    height: 54,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E1E4E9',
  },
  selectedTitle: { fontSize: 15, fontWeight: '900', color: '#252932' },
  addButton: { height: 34, paddingHorizontal: 12, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4B68FF' },
  addButtonText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  scheduleList: { flex: 1, backgroundColor: '#F7F8FA' },
  scheduleListContent: { padding: 14, gap: 8 },
  emptyText: { paddingTop: 32, textAlign: 'center', fontSize: 14, color: '#939AA6' },
  scheduleRow: {
    minHeight: 58,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  colorBar: { width: 5, alignSelf: 'stretch', borderRadius: 3 },
  scheduleTextWrap: { flex: 1, marginLeft: 12 },
  scheduleTitle: { fontSize: 15, fontWeight: '900', color: '#242830' },
  scheduleTime: { marginTop: 3, fontSize: 12, color: '#7D8490' },
});
