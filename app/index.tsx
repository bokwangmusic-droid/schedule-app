import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
  startOfWeekMonday,
  toLocalDateString,
} from '../src/lib/date';
import type { ScheduleItem } from '../src/types/schedule';

const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_HEIGHT = 30;
const TIME_GUTTER = 30;
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const EVENT_COLORS = ['#5B8DEF', '#91D948', '#FF4E7D', '#9C6ADE', '#FF9F43', '#37B8A5'];
const NOW_COLOR = '#FF4D5A';

function timeToMinutes(value: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function scheduleColor(schedule: ScheduleItem) {
  if (schedule.color) return schedule.color;

  let hash = 0;
  for (let index = 0; index < schedule.title.length; index += 1) {
    hash = (hash * 31 + schedule.title.charCodeAt(index)) >>> 0;
  }
  return EVENT_COLORS[hash % EVENT_COLORS.length];
}

function scheduleLabel(schedule: ScheduleItem) {
  return schedule.memberName ?? schedule.title;
}

function getWeekOfMonthLabel(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const mondayBasedOffset = (first.getDay() + 6) % 7;
  const week = Math.ceil((date.getDate() + mondayBasedOffset) / 7);
  return `${date.getMonth() + 1}월 ${week}주차`;
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const today = useMemo(() => new Date(), []);
  const todayWeekStart = useMemo(() => startOfWeekMonday(today), [today]);
  const [weekStart, setWeekStart] = useState(todayWeekStart);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [weekMenuOpen, setWeekMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekStartString = toLocalDateString(weekDates[0]);
  const weekEndString = toLocalDateString(weekDates[6]);
  const todayString = toLocalDateString(today);
  const dayWidth = Math.max((width - TIME_GUTTER) / 7, 38);
  const timetableWidth = TIME_GUTTER + dayWidth * 7;
  const gridHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
  const weekLabelDate = addDays(weekStart, 3);
  const weekLabel = getWeekOfMonthLabel(weekLabelDate);

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

  const openSchedule = (id: string) => {
    router.push({ pathname: '/schedule/[id]', params: { id } });
  };

  const moveWeek = (days: number) => {
    setWeekMenuOpen(false);
    setWeekStart((current) => addDays(current, days));
  };

  const goToday = () => {
    setWeekMenuOpen(false);
    setWeekStart(todayWeekStart);
  };

  const notReadyYet = (title: string) => {
    setMoreMenuOpen(false);
    Alert.alert(title, '이 기능은 다음 단계에서 바로 이어서 붙일게요.');
  };

  const todayDayIndex = weekDates.findIndex(
    (date) => toLocalDateString(date) === todayString,
  );
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentLineVisible =
    todayDayIndex >= 0 &&
    currentMinutes >= START_HOUR * 60 &&
    currentMinutes < END_HOUR * 60;
  const currentLineTop = ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="이전 주"
          style={styles.headerIconButton}
          onPress={() => moveWeek(-7)}
        >
          <Text style={styles.chevronText}>‹</Text>
        </Pressable>

        <Pressable style={styles.titleButton} onPress={() => setWeekMenuOpen(true)}>
          <Text numberOfLines={1} style={styles.weekTitle}>{weekLabel}</Text>
          <Text style={styles.dropArrow}>⌄</Text>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable style={styles.smallHeaderButton} onPress={() => router.push('./members')}>
            <Text style={styles.smallHeaderButtonText}>회원</Text>
          </Pressable>
          <Pressable style={styles.addButton} onPress={() => openNewSchedule(todayString)}>
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="더보기"
            style={styles.moreButton}
            onPress={() => setMoreMenuOpen(true)}
          >
            <Text style={styles.moreButtonText}>⋮</Text>
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.allDayContent}
          >
            {allDaySchedules.map((schedule) => (
              <Pressable
                key={schedule.id}
                style={[styles.allDayChip, { backgroundColor: scheduleColor(schedule) }]}
                onPress={() => openSchedule(schedule.id)}
              >
                <Text numberOfLines={1} style={styles.allDayChipText}>{scheduleLabel(schedule)}</Text>
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
                <View key={`hour-${hour}`} pointerEvents="none">
                  <View style={[styles.hourLine, { top }]} />
                  {hour < END_HOUR && (
                    <Text
                      style={[
                        styles.hourLabel,
                        { top: index === 0 ? 2 : top - 7 },
                      ]}
                    >
                      {hour}
                    </Text>
                  )}
                </View>
              );
            })}

            {weekDates.map((date, dayIndex) => {
              const dateString = toLocalDateString(date);
              const isToday = dateString === todayString;
              return (
                <View
                  key={`column-${dateString}`}
                  pointerEvents="none"
                  style={[
                    styles.dayColumn,
                    isToday && styles.todayColumn,
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

            {currentLineVisible && (
              <View
                pointerEvents="none"
                style={[
                  styles.currentTimeWrap,
                  {
                    left: TIME_GUTTER + todayDayIndex * dayWidth,
                    top: currentLineTop,
                    width: dayWidth,
                  },
                ]}
              >
                <View style={styles.currentTimeDot} />
                <View style={styles.currentTimeLine} />
              </View>
            )}

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
              const height = Math.max(((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT, 17);

              return (
                <Pressable
                  key={schedule.id}
                  style={[
                    styles.eventBlock,
                    {
                      left: TIME_GUTTER + dayIndex * dayWidth + 1,
                      top: top + 1,
                      width: Math.max(dayWidth - 2, 32),
                      height: Math.max(height - 2, 15),
                      backgroundColor: scheduleColor(schedule),
                      opacity: schedule.isCompleted ? 0.55 : 1,
                    },
                  ]}
                  onPress={() => openSchedule(schedule.id)}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                    style={styles.eventTitle}
                  >
                    {scheduleLabel(schedule)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={weekMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWeekMenuOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setWeekMenuOpen(false)}>
          <Pressable style={styles.weekMenuCard} onPress={() => undefined}>
            <Text style={styles.menuTitle}>주간 이동</Text>
            <Pressable style={styles.weekMenuItem} onPress={() => moveWeek(-7)}>
              <Text style={styles.weekMenuItemText}>지난주</Text>
            </Pressable>
            <Pressable style={styles.weekMenuItem} onPress={goToday}>
              <Text style={[styles.weekMenuItemText, styles.weekMenuItemPrimary]}>이번 주</Text>
            </Pressable>
            <Pressable style={styles.weekMenuItem} onPress={() => moveWeek(7)}>
              <Text style={styles.weekMenuItemText}>다음주</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={moreMenuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMoreMenuOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setMoreMenuOpen(false)}>
          <Pressable style={styles.bottomSheet} onPress={() => undefined}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>시간표 메뉴</Text>

            <Pressable
              style={styles.sheetItem}
              onPress={() => {
                setMoreMenuOpen(false);
                router.push('./members');
              }}
            >
              <Text style={styles.sheetIcon}>👤</Text>
              <Text style={styles.sheetItemText}>회원 관리</Text>
            </Pressable>

            <Pressable style={styles.sheetItem} onPress={() => notReadyYet('시간표 디자인/설정')}>
              <Text style={styles.sheetIcon}>⚙</Text>
              <Text style={styles.sheetItemText}>시간표 디자인/설정</Text>
            </Pressable>

            <Pressable style={styles.sheetItem} onPress={() => notReadyYet('시간표 복사')}>
              <Text style={styles.sheetIcon}>▣</Text>
              <Text style={styles.sheetItemText}>시간표 복사</Text>
            </Pressable>

            <Pressable style={styles.sheetItem} onPress={() => notReadyYet('겹쳐보기')}>
              <Text style={styles.sheetIcon}>◇</Text>
              <Text style={styles.sheetItemText}>겹치는 일정 보기</Text>
            </Pressable>

            <Pressable style={styles.sheetItem} onPress={() => notReadyYet('이미지로 저장')}>
              <Text style={styles.sheetIcon}>⇩</Text>
              <Text style={styles.sheetItemText}>이미지로 저장</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: {
    height: 58,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECEEF2',
    backgroundColor: '#FFFFFF',
  },
  headerIconButton: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronText: {
    marginTop: -4,
    fontSize: 34,
    fontWeight: '300',
    color: '#24272D',
  },
  titleButton: {
    minWidth: 0,
    flex: 1,
    height: 44,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekTitle: {
    flexShrink: 1,
    fontSize: 19,
    fontWeight: '900',
    color: '#1F2228',
  },
  dropArrow: {
    marginLeft: 5,
    marginTop: -4,
    fontSize: 23,
    color: '#3B3F46',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  smallHeaderButton: {
    height: 34,
    paddingHorizontal: 9,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F2F6',
  },
  smallHeaderButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#555D6B',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.7,
    borderColor: '#202329',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  addButtonText: {
    marginTop: -3,
    fontSize: 27,
    fontWeight: '400',
    color: '#202329',
  },
  moreButton: {
    width: 30,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonText: {
    marginTop: -3,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '900',
    color: '#202329',
  },
  dayHeader: {
    height: 48,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D9DCE2',
    backgroundColor: '#FFFFFF',
  },
  dayHeaderCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B9098',
  },
  dayNumberWrap: {
    minWidth: 22,
    height: 20,
    marginTop: 1,
    paddingHorizontal: 3,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayNumberWrap: {
    backgroundColor: '#4B68FF',
  },
  dayNumber: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666D78',
  },
  todayText: {
    color: '#4B68FF',
  },
  todayNumber: {
    color: '#FFFFFF',
  },
  allDayStrip: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FAFBFC',
  },
  allDayLabel: {
    width: TIME_GUTTER,
    textAlign: 'center',
    fontSize: 8,
    fontWeight: '700',
    color: '#8A909B',
  },
  allDayContent: {
    gap: 4,
    paddingVertical: 3,
    paddingRight: 8,
  },
  allDayChip: {
    maxWidth: 90,
    minHeight: 22,
    paddingHorizontal: 6,
    borderRadius: 5,
    justifyContent: 'center',
  },
  allDayChipText: {
    fontSize: 9,
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
  hourLabel: {
    position: 'absolute',
    left: 0,
    width: TIME_GUTTER - 4,
    height: 14,
    paddingRight: 4,
    textAlign: 'right',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    color: '#7B818A',
    zIndex: 2,
  },
  hourLine: {
    position: 'absolute',
    left: TIME_GUTTER,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#DDE0E5',
  },
  dayColumn: {
    position: 'absolute',
    top: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#DADDE2',
  },
  todayColumn: {
    backgroundColor: '#F7F8FB',
  },
  slotButton: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  currentTimeWrap: {
    position: 'absolute',
    zIndex: 3,
    height: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentTimeDot: {
    width: 5,
    height: 5,
    marginLeft: -2.5,
    borderRadius: 2.5,
    backgroundColor: NOW_COLOR,
  },
  currentTimeLine: {
    flex: 1,
    height: 1.4,
    backgroundColor: NOW_COLOR,
  },
  eventBlock: {
    position: 'absolute',
    zIndex: 4,
    paddingHorizontal: 2,
    borderRadius: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    paddingTop: 90,
    paddingHorizontal: 48,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  weekMenuCard: {
    alignSelf: 'flex-start',
    minWidth: 180,
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  menuTitle: {
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 7,
    fontSize: 12,
    fontWeight: '800',
    color: '#8B909A',
  },
  weekMenuItem: {
    height: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 10,
  },
  weekMenuItemText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#272B32',
  },
  weekMenuItemPrimary: {
    color: '#4B68FF',
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  bottomSheet: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    marginBottom: 12,
    borderRadius: 3,
    backgroundColor: '#D8DBE1',
  },
  sheetTitle: {
    marginBottom: 6,
    fontSize: 17,
    fontWeight: '900',
    color: '#1F2228',
  },
  sheetItem: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECEEF2',
  },
  sheetIcon: {
    width: 38,
    fontSize: 18,
    textAlign: 'center',
  },
  sheetItemText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#272B32',
  },
});
