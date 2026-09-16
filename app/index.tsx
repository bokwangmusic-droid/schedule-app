import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type GestureResponderEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DraggableScheduleBlock } from '../src/components/DraggableScheduleBlock';
import {
  listSchedulesForRange,
  updateSchedule,
} from '../src/data/scheduleRepository';
import { addDays, startOfWeekMonday, toLocalDateString } from '../src/lib/date';
import type { ScheduleItem } from '../src/types/schedule';

const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_HEIGHT = 30;
const TIME_GUTTER = 32;
const SCREEN_MARGIN = 10;
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const EVENT_COLORS = ['#5B8DEF', '#91D948', '#FF4E7D', '#9C6ADE', '#FF9F43', '#37B8A5'];
const NOW_COLOR = '#FF4D5A';
const WEEK_SWIPE_DISTANCE = 58;

function timeToMinutes(value: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function minutesToTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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

function schedulePtLabel(schedule: ScheduleItem) {
  const remaining =
    schedule.memberPtProjectedRemainingSessions ?? schedule.memberPtRemainingSessions;

  if (
    !schedule.memberName ||
    remaining === null ||
    schedule.memberPtTotalSessions === null
  ) {
    return null;
  }

  return `잔여 ${remaining}/${schedule.memberPtTotalSessions}`;
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [movingScheduleId, setMovingScheduleId] = useState<string | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeBlockedUntilRef = useRef(0);

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
  const timetableWidth = Math.max(width - SCREEN_MARGIN * 2, 320);
  const dayWidth = (timetableWidth - TIME_GUTTER) / 7;
  const gridHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
  const weekLabel = getWeekOfMonthLabel(addDays(weekStart, 3));

  const loadSchedules = useCallback(async () => {
    try {
      const rows = await listSchedulesForRange(
        db,
        weekStartString,
        weekEndString,
        todayString,
      );
      setSchedules(rows);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [db, todayString, weekEndString, weekStartString]);

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

  const moveTimedSchedule = async (
    schedule: ScheduleItem,
    dayDelta: number,
    minuteDelta: number,
  ) => {
    const startMinutes = timeToMinutes(schedule.startTime);
    const endMinutes = timeToMinutes(schedule.endTime);
    if (startMinutes === null || endMinutes === null) return;

    const currentDayIndex = weekDates.findIndex(
      (date) => toLocalDateString(date) === schedule.date,
    );
    if (currentDayIndex < 0) return;

    const duration = Math.max(endMinutes - startMinutes, 15);
    const gridStartMinutes = START_HOUR * 60;
    const gridEndMinutes = END_HOUR * 60;
    const targetDayIndex = Math.max(0, Math.min(6, currentDayIndex + dayDelta));
    const maxStartMinutes = Math.max(gridStartMinutes, gridEndMinutes - duration);
    const targetStartMinutes = Math.max(
      gridStartMinutes,
      Math.min(maxStartMinutes, startMinutes + minuteDelta),
    );
    const targetEndMinutes = targetStartMinutes + duration;
    const targetDate = toLocalDateString(weekDates[targetDayIndex]);
    const targetStartTime = minutesToTime(targetStartMinutes);
    const targetEndTime = minutesToTime(targetEndMinutes);

    if (
      targetDate === schedule.date &&
      targetStartTime === schedule.startTime &&
      targetEndTime === schedule.endTime
    ) {
      return;
    }

    setMovingScheduleId(schedule.id);
    setSchedules((current) =>
      current.map((item) =>
        item.id === schedule.id
          ? {
              ...item,
              date: targetDate,
              startTime: targetStartTime,
              endTime: targetEndTime,
            }
          : item,
      ),
    );

    try {
      await updateSchedule(db, schedule.id, {
        title: schedule.title,
        date: targetDate,
        startTime: targetStartTime,
        endTime: targetEndTime,
        memo: schedule.memo,
        color: schedule.color,
        memberId: schedule.memberId,
        isAllDay: false,
      });
      await loadSchedules();
    } catch (error) {
      console.error(error);
      Alert.alert('일정 이동 실패', '일정을 옮기지 못했어요. 다시 시도해 주세요.');
      await loadSchedules();
    } finally {
      setMovingScheduleId(null);
    }
  };

  const handleTimetableTouchStart = (event: GestureResponderEvent) => {
    if (Date.now() < swipeBlockedUntilRef.current) {
      swipeStartRef.current = null;
      return;
    }

    swipeStartRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
  };

  const handleTimetableTouchEnd = (event: GestureResponderEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (!start || Date.now() < swipeBlockedUntilRef.current) return;

    const dx = event.nativeEvent.pageX - start.x;
    const dy = event.nativeEvent.pageY - start.y;
    const horizontalEnough = Math.abs(dx) >= WEEK_SWIPE_DISTANCE;
    const mostlyHorizontal = Math.abs(dx) > Math.abs(dy) * 1.35;

    if (!horizontalEnough || !mostlyHorizontal) return;

    setWeekStart((current) => addDays(current, dx < 0 ? 7 : -7));
  };

  const handleScheduleDragStateChange = (dragging: boolean) => {
    if (dragging) {
      swipeStartRef.current = null;
      swipeBlockedUntilRef.current = Number.POSITIVE_INFINITY;
      return;
    }

    swipeBlockedUntilRef.current = Date.now() + 400;
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
        <View style={styles.weekSwitcher}>
          <Pressable
            accessibilityLabel="이전 주"
            style={styles.weekArrowButton}
            onPress={() => setWeekStart((current) => addDays(current, -7))}
          >
            <Text style={styles.weekArrowText}>‹</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="이번 주로 이동"
            style={styles.weekLabelButton}
            onPress={() => setWeekStart(todayWeekStart)}
          >
            <Text numberOfLines={1} style={styles.weekTitle}>{weekLabel}</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="다음 주"
            style={styles.weekArrowButton}
            onPress={() => setWeekStart((current) => addDays(current, 7))}
          >
            <Text style={styles.weekArrowText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.smallHeaderButton} onPress={() => router.push('./members')}>
            <Text style={styles.smallHeaderButtonText}>회원</Text>
          </Pressable>
          <Pressable style={styles.smallHeaderButton} onPress={() => router.push('./calendar')}>
            <Text style={styles.smallHeaderButtonText}>달력</Text>
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

      <View
        style={[styles.timetableShell, { width: timetableWidth }]}
        onTouchStart={handleTimetableTouchStart}
        onTouchEnd={handleTimetableTouchEnd}
        onTouchCancel={() => {
          swipeStartRef.current = null;
        }}
      >
        <View style={[styles.dayHeader, { width: timetableWidth }]}>
          <View style={styles.dayHeaderGutter} />
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
                const ptLabel = schedulePtLabel(schedule);
                const showPtLabel = Boolean(ptLabel && height >= 26);

                return (
                  <DraggableScheduleBlock
                    key={schedule.id}
                    label={scheduleLabel(schedule)}
                    metaLabel={ptLabel}
                    showMeta={showPtLabel}
                    dayWidth={dayWidth}
                    hourHeight={HOUR_HEIGHT}
                    disabled={movingScheduleId !== null}
                    onPress={() => openSchedule(schedule.id)}
                    onMove={(dayDelta, minuteDelta) =>
                      moveTimedSchedule(schedule, dayDelta, minuteDelta)
                    }
                    onDragStateChange={handleScheduleDragStateChange}
                    style={{
                      left: TIME_GUTTER + dayIndex * dayWidth + 2,
                      top: top + 2,
                      width: Math.max(dayWidth - 4, 30),
                      height: Math.max(height - 4, 14),
                      backgroundColor: scheduleColor(schedule),
                      opacity: schedule.isCompleted ? 0.55 : 1,
                    }}
                  />
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

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

            <Pressable
              style={styles.sheetItem}
              onPress={() => {
                setMoreMenuOpen(false);
                router.push('./calendar');
              }}
            >
              <Text style={styles.sheetIcon}>▦</Text>
              <Text style={styles.sheetItemText}>달력 보기</Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  topBar: {
    height: 58,
    marginTop: 6,
    marginHorizontal: SCREEN_MARGIN,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  weekSwitcher: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekArrowButton: {
    width: 30,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  weekArrowText: {
    marginTop: -3,
    fontSize: 29,
    fontWeight: '300',
    color: '#2D3138',
  },
  weekLabelButton: {
    minWidth: 0,
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1F232A',
  },
  headerActions: {
    marginLeft: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  smallHeaderButton: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  smallHeaderButtonText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#5B6270',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#24282F',
  },
  addButtonText: {
    marginTop: -2,
    fontSize: 23,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  moreButton: {
    width: 28,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  moreButtonText: {
    marginTop: -2,
    fontSize: 25,
    lineHeight: 27,
    fontWeight: '900',
    color: '#2D3138',
  },
  timetableShell: {
    flex: 1,
    alignSelf: 'center',
    marginTop: 9,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E3E8',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  dayHeader: {
    height: 48,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E4E9',
    backgroundColor: '#FBFBFC',
  },
  dayHeaderGutter: {
    width: TIME_GUTTER,
    borderRightWidth: 1,
    borderRightColor: '#E6E8EC',
  },
  dayHeaderCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#E6E8EC',
  },
  dayName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8A9099',
  },
  dayNumberWrap: {
    minWidth: 22,
    height: 20,
    marginTop: 2,
    paddingHorizontal: 3,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayNumberWrap: { backgroundColor: '#4B68FF' },
  dayNumber: { fontSize: 10, fontWeight: '800', color: '#646B77' },
  todayText: { color: '#4B68FF' },
  todayNumber: { color: '#FFFFFF' },
  allDayStrip: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E3E6EA',
    backgroundColor: '#FAFBFC',
  },
  allDayLabel: {
    width: TIME_GUTTER,
    textAlign: 'center',
    fontSize: 8,
    fontWeight: '700',
    color: '#8A909B',
  },
  allDayContent: { gap: 5, paddingVertical: 4, paddingRight: 8 },
  allDayChip: {
    maxWidth: 90,
    minHeight: 22,
    paddingHorizontal: 7,
    borderRadius: 6,
    justifyContent: 'center',
  },
  allDayChipText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
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
    width: TIME_GUTTER - 5,
    height: 14,
    paddingRight: 3,
    textAlign: 'right',
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '600',
    color: '#747B86',
    zIndex: 3,
  },
  hourLine: {
    position: 'absolute',
    left: TIME_GUTTER,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#DEE2E7',
    zIndex: 2,
  },
  dayColumn: {
    position: 'absolute',
    top: 0,
    zIndex: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#E1E4E8',
  },
  todayColumn: {
    backgroundColor: '#F6F7FB',
  },
  slotButton: {
    position: 'absolute',
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  currentTimeWrap: {
    position: 'absolute',
    zIndex: 4,
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
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.38)',
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
  sheetIcon: { width: 38, fontSize: 18, textAlign: 'center' },
  sheetItemText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#272B32',
  },
});
