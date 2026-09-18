import * as MediaLibrary from 'expo-media-library/legacy';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { captureRef } from 'react-native-view-shot';
import { DraggableScheduleBlock } from '../src/components/DraggableScheduleBlock';
import { ScheduleRangeSelector } from '../src/components/ScheduleRangeSelector';
import { TimetableMoreMenu } from '../src/components/TimetableMoreMenu';
import { TimetableSettingsModal } from '../src/components/TimetableSettingsModal';
import {
  getTimetableSettings,
  saveHourHeight,
  saveOverlapView,
  saveShowPtRemaining,
  saveWidgetPrivacyMode,
} from '../src/data/appSettingsRepository';
import {
  createSchedule,
  deleteSchedule,
  listSchedulesForRange,
  updateSchedule,
} from '../src/data/scheduleRepository';
import { addDays, startOfWeekMonday, toLocalDateString } from '../src/lib/date';
import type { ScheduleItem } from '../src/types/schedule';
import { refreshWeeklyTimetableWidget } from '../src/widgets/widgetController';

const START_HOUR = 6;
const END_HOUR = 24;
const TIME_GUTTER = 32;
const SCREEN_MARGIN = 10;
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const EVENT_COLORS = ['#5B8DEF', '#91D948', '#FF4E7D', '#9C6ADE', '#FF9F43', '#37B8A5'];
const NOW_COLOR = '#FF4D5A';
const TRASH_ZONE_HEIGHT = 76;
const TRASH_ZONE_BOTTOM = 18;

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

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function findFreeSlots(schedules: ScheduleItem[]) {
  const intervals = schedules
    .filter(
      (schedule) =>
        !schedule.isAllDay &&
        schedule.startTime &&
        schedule.endTime &&
        schedule.attendanceStatus !== 'canceled' &&
        schedule.attendanceStatus !== 'no_show',
    )
    .map((schedule) => ({
      start: timeToMinutes(schedule.startTime) ?? 0,
      end: timeToMinutes(schedule.endTime) ?? 0,
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);

  if (intervals.length < 2) return [];

  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
    } else {
      last.end = Math.max(last.end, interval.end);
    }
  }

  const gaps: string[] = [];
  for (let index = 0; index < merged.length - 1; index += 1) {
    const start = merged[index].end;
    const end = merged[index + 1].start;
    if (end - start >= 30) gaps.push(`${formatMinutes(start)}–${formatMinutes(end)}`);
  }
  return gaps;
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
  if (!schedule.memberName || remaining === null || schedule.memberPtTotalSessions === null) {
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

function copySignature(schedule: ScheduleItem, date = schedule.date) {
  return [
    schedule.title,
    date,
    schedule.startTime ?? '',
    schedule.endTime ?? '',
    schedule.memberId ?? '',
    schedule.isAllDay ? '1' : '0',
  ].join('|');
}

function overlapPlacement(schedule: ScheduleItem, schedules: ScheduleItem[], enabled: boolean) {
  if (!enabled) return { lane: 0, count: 1 };
  const start = timeToMinutes(schedule.startTime);
  const end = timeToMinutes(schedule.endTime);
  if (start === null || end === null) return { lane: 0, count: 1 };

  const overlapping = schedules
    .filter((item) => {
      if (item.date !== schedule.date || item.isAllDay) return false;
      const otherStart = timeToMinutes(item.startTime);
      const otherEnd = timeToMinutes(item.endTime);
      return otherStart !== null && otherEnd !== null && otherStart < end && otherEnd > start;
    })
    .sort((a, b) => {
      const diff = (timeToMinutes(a.startTime) ?? 0) - (timeToMinutes(b.startTime) ?? 0);
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });

  if (overlapping.length <= 1) return { lane: 0, count: 1 };
  return {
    lane: Math.max(0, overlapping.findIndex((item) => item.id === schedule.id)),
    count: overlapping.length,
  };
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { width, height: screenHeight } = useWindowDimensions();
  const today = useMemo(() => new Date(), []);
  const todayWeekStart = useMemo(() => startOfWeekMonday(today), [today]);
  const timetableRef = useRef<View>(null);

  const [weekStart, setWeekStart] = useState(todayWeekStart);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [movingScheduleId, setMovingScheduleId] = useState<string | null>(null);
  const [trashVisible, setTrashVisible] = useState(false);
  const [trashActive, setTrashActive] = useState(false);
  const [hourHeight, setHourHeight] = useState(30);
  const [showPtRemaining, setShowPtRemaining] = useState(true);
  const [overlapView, setOverlapView] = useState(false);
  const [widgetPrivacyMode, setWidgetPrivacyMode] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void getTimetableSettings(db)
      .then((settings) => {
        if (!active) return;
        setHourHeight(settings.hourHeight);
        setShowPtRemaining(settings.showPtRemaining);
        setOverlapView(settings.overlapView);
        setWidgetPrivacyMode(settings.widgetPrivacyMode);
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, [db]);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekStartString = toLocalDateString(weekDates[0]);
  const weekEndString = toLocalDateString(weekDates[6]);
  const todayString = toLocalDateString(today);
  const timetableWidth = Math.max(width - SCREEN_MARGIN * 2, 320);
  const dayWidth = (timetableWidth - TIME_GUTTER) / 7;
  const gridHeight = (END_HOUR - START_HOUR) * hourHeight;
  const weekLabel = getWeekOfMonthLabel(addDays(weekStart, 3));
  const deleteDropY = screenHeight - TRASH_ZONE_HEIGHT - TRASH_ZONE_BOTTOM - 8;

  const loadSchedules = useCallback(async () => {
    try {
      const rows = await listSchedulesForRange(db, weekStartString, weekEndString, todayString);
      setSchedules(rows);
      void refreshWeeklyTimetableWidget().catch(console.error);
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

  const openNewSchedule = (date?: string, startTime?: string, endTime?: string) => {
    router.push({
      pathname: '/schedule/new',
      params: {
        ...(date ? { date } : {}),
        ...(startTime ? { startTime } : {}),
        ...(endTime ? { endTime } : {}),
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
    ) return;

    setMovingScheduleId(schedule.id);
    setSchedules((current) =>
      current.map((item) =>
        item.id === schedule.id
          ? { ...item, date: targetDate, startTime: targetStartTime, endTime: targetEndTime }
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

  const deleteDraggedSchedule = async (schedule: ScheduleItem) => {
    setMovingScheduleId(schedule.id);
    setSchedules((current) => current.filter((item) => item.id !== schedule.id));
    try {
      await deleteSchedule(db, schedule.id);
      await loadSchedules();
    } catch (error) {
      console.error(error);
      Alert.alert('삭제 실패', '일정을 삭제하지 못했어요. 다시 시도해 주세요.');
      await loadSchedules();
    } finally {
      setMovingScheduleId(null);
    }
  };

  const handleScheduleDragStateChange = (dragging: boolean) => {
    setTrashVisible(dragging);
    if (!dragging) setTrashActive(false);
  };

  const handleDragMoveY = (pageY: number) => {
    setTrashActive(pageY >= deleteDropY);
  };

  const changeHourHeight = async (value: number) => {
    setHourHeight(value);
    try {
      await saveHourHeight(db, value);
    } catch (error) {
      console.error(error);
    }
  };

  const changeShowPtRemaining = async (value: boolean) => {
    setShowPtRemaining(value);
    try {
      await saveShowPtRemaining(db, value);
    } catch (error) {
      console.error(error);
    }
  };

  const changeWidgetPrivacyMode = async (value: boolean) => {
    setWidgetPrivacyMode(value);
    try {
      await saveWidgetPrivacyMode(db, value);
      void refreshWeeklyTimetableWidget().catch(console.error);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleOverlapView = async () => {
    const next = !overlapView;
    setMoreMenuOpen(false);
    setOverlapView(next);
    try {
      await saveOverlapView(db, next);
    } catch (error) {
      console.error(error);
    }
  };

  const copyCurrentWeekToNextWeek = () => {
    setMoreMenuOpen(false);
    Alert.alert(
      '다음 주로 복사',
      `${weekLabel}의 일정을 다음 주로 복사할까요?\n이미 같은 회원·시간 일정이 있으면 건너뜁니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '복사',
          onPress: () => {
            void (async () => {
              try {
                const nextWeekStart = addDays(weekDates[0], 7);
                const nextWeekEnd = addDays(weekDates[6], 7);
                const existingNextWeek = await listSchedulesForRange(
                  db,
                  toLocalDateString(nextWeekStart),
                  toLocalDateString(nextWeekEnd),
                  todayString,
                );
                const existing = new Set(existingNextWeek.map((item) => copySignature(item)));
                let copied = 0;

                for (const schedule of schedules) {
                  const targetDate = toLocalDateString(addDays(parseLocalDate(schedule.date), 7));
                  const signature = copySignature(schedule, targetDate);
                  if (existing.has(signature)) continue;

                  await createSchedule(db, {
                    title: schedule.title,
                    date: targetDate,
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                    memo: schedule.memo,
                    color: schedule.color,
                    memberId: schedule.memberId,
                    isAllDay: schedule.isAllDay,
                  });
                  existing.add(signature);
                  copied += 1;
                }

                Alert.alert(
                  '복사 완료',
                  copied > 0 ? `다음 주에 ${copied}개의 일정을 복사했어요.` : '복사할 새 일정이 없어요.',
                );
              } catch (error) {
                console.error(error);
                Alert.alert('복사 실패', '시간표를 복사하지 못했어요. 다시 시도해 주세요.');
              }
            })();
          },
        },
      ],
    );
  };

  const saveTimetableImage = async () => {
    setMoreMenuOpen(false);
    if (!timetableRef.current || savingImage) return;

    try {
      setSavingImage(true);
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        Alert.alert('사진 권한 필요', '시간표 이미지를 저장하려면 사진 저장 권한이 필요해요.');
        return;
      }
      const uri = await captureRef(timetableRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('저장 완료', '현재 시간표를 사진에 저장했어요.');
    } catch (error) {
      console.error(error);
      Alert.alert('저장 실패', '시간표 이미지를 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSavingImage(false);
    }
  };

  const showDailySummary = () => {
    setMoreMenuOpen(false);
    const todayItems = schedules.filter((schedule) => schedule.date === todayString);
    const memberItems = todayItems.filter((schedule) => schedule.memberId);
    const completed = memberItems.filter(
      (schedule) => schedule.attendanceStatus === 'completed' || schedule.ptConsumed,
    ).length;
    const canceled = memberItems.filter(
      (schedule) => schedule.attendanceStatus === 'canceled',
    ).length;
    const noShow = memberItems.filter(
      (schedule) => schedule.attendanceStatus === 'no_show',
    ).length;
    const pending = Math.max(memberItems.length - completed - canceled - noShow, 0);
    const consumed = memberItems.filter((schedule) => schedule.ptConsumed).length;

    Alert.alert(
      '오늘 마감 요약',
      [
        `오늘 회원 수업 ${memberItems.length}타임`,
        `완료 ${completed} · 취소 ${canceled} · 노쇼 ${noShow} · 미처리 ${pending}`,
        `회원 서명으로 소진된 PT ${consumed}회`,
        '',
        completed > 0
          ? `오늘도 ${completed}명의 운동을 함께했습니다. 수고 많으셨어요.`
          : '오늘도 일정 정리하느라 수고 많으셨어요.',
      ].join('\n'),
    );
  };

  const todayDayIndex = weekDates.findIndex(
    (date) => toLocalDateString(date) === todayString,
  );
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentLineVisible =
    todayDayIndex >= 0 &&
    currentMinutes >= START_HOUR * 60 &&
    currentMinutes < END_HOUR * 60;
  const currentLineTop = ((currentMinutes - START_HOUR * 60) / 60) * hourHeight;
  const showingCurrentWeek = toLocalDateString(weekDates[0]) === toLocalDateString(todayWeekStart);
  const todaySchedules = schedules.filter(
    (schedule) => schedule.date === todayString && schedule.attendanceStatus !== 'canceled',
  );
  const todayTimedSchedules = todaySchedules.filter(
    (schedule) => !schedule.isAllDay && schedule.startTime && schedule.endTime,
  );
  const todayFreeSlots = findFreeSlots(todayTimedSchedules);
  const firstTodayTime = todayTimedSchedules
    .map((schedule) => schedule.startTime)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null;
  const lastTodayTime = todayTimedSchedules
    .map((schedule) => schedule.endTime)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  const lowPtMembers = new Set(
    todaySchedules
      .filter(
        (schedule) =>
          schedule.memberId &&
          schedule.memberPtRemainingSessions !== null &&
          schedule.memberPtRemainingSessions <= 3,
      )
      .map((schedule) => schedule.memberId),
  ).size;

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

      {showingCurrentWeek ? (
        <View style={styles.briefingCard}>
          <View style={styles.briefingTopRow}>
            <Text style={styles.briefingTitle}>오늘 수업 브리핑</Text>
            <Text style={styles.briefingSummary}>
              {todayTimedSchedules.length}타임
              {firstTodayTime ? ` · 첫 ${firstTodayTime.slice(0, 5)}` : ''}
              {lastTodayTime ? ` · 마지막 ${lastTodayTime.slice(0, 5)}` : ''}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.briefingDetail}>
            {todayFreeSlots.length > 0
              ? `빈 시간 ${todayFreeSlots.slice(0, 3).join(' · ')}`
              : todayTimedSchedules.length > 0
                ? '수업 사이 30분 이상 빈 시간이 없어요.'
                : '오늘 등록된 수업이 없어요.'}
            {lowPtMembers > 0 ? `  ·  PT 3회 이하 회원 ${lowPtMembers}명` : ''}
          </Text>
        </View>
      ) : null}

      <View
        ref={timetableRef}
        collapsable={false}
        style={[styles.timetableShell, { width: timetableWidth }]}
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
                const top = index * hourHeight;
                return (
                  <View key={`hour-${hour}`} pointerEvents="none">
                    <View style={[styles.hourLine, { top }]} />
                    {hour < END_HOUR && (
                      <Text style={[styles.hourLabel, { top: index === 0 ? 2 : top - 7 }]}>
                        {hour}
                      </Text>
                    )}
                  </View>
                );
              })}

              {weekDates.map((date, dayIndex) => {
                const dateString = toLocalDateString(date);
                return (
                  <ScheduleRangeSelector
                    key={`range-${dateString}`}
                    left={TIME_GUTTER + dayIndex * dayWidth}
                    width={dayWidth}
                    height={gridHeight}
                    startHour={START_HOUR}
                    endHour={END_HOUR}
                    hourHeight={hourHeight}
                    disabled={movingScheduleId !== null}
                    onRangeSelected={(startTime, endTime) =>
                      openNewSchedule(dateString, startTime, endTime)
                    }
                    onWeekSwipe={(direction) =>
                      setWeekStart((current) => addDays(current, direction === 'next' ? 7 : -7))
                    }
                  />
                );
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
                const top = ((visibleStart - gridStartMinutes) / 60) * hourHeight;
                const blockHeight = Math.max(((visibleEnd - visibleStart) / 60) * hourHeight, 17);
                const ptLabel = schedulePtLabel(schedule);
                const showPtLabel = Boolean(showPtRemaining && ptLabel && blockHeight >= 26);
                const placement = overlapPlacement(schedule, timedSchedules, overlapView);
                const availableWidth = Math.max(dayWidth - 4, 30);
                const laneWidth = availableWidth / placement.count;

                return (
                  <DraggableScheduleBlock
                    key={schedule.id}
                    label={scheduleLabel(schedule)}
                    metaLabel={ptLabel}
                    showMeta={showPtLabel}
                    dayWidth={dayWidth}
                    hourHeight={hourHeight}
                    disabled={movingScheduleId !== null}
                    deleteDropY={deleteDropY}
                    onPress={() => openSchedule(schedule.id)}
                    onMove={(dayDelta, minuteDelta) =>
                      moveTimedSchedule(schedule, dayDelta, minuteDelta)
                    }
                    onDelete={() => deleteDraggedSchedule(schedule)}
                    onDragStateChange={handleScheduleDragStateChange}
                    onDragMoveY={handleDragMoveY}
                    style={{
                      left:
                        TIME_GUTTER +
                        dayIndex * dayWidth +
                        2 +
                        placement.lane * laneWidth,
                      top: top + 2,
                      width: Math.max(laneWidth - (placement.count > 1 ? 1 : 0), 12),
                      height: Math.max(blockHeight - 4, 14),
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

      {trashVisible && (
        <View
          pointerEvents="none"
          style={[
            styles.trashZone,
            trashActive && styles.trashZoneActive,
            { height: TRASH_ZONE_HEIGHT, bottom: TRASH_ZONE_BOTTOM },
          ]}
        >
          <Text style={styles.trashIcon}>🗑️</Text>
          <Text style={[styles.trashText, trashActive && styles.trashTextActive]}>
            {trashActive ? '놓으면 삭제' : '여기로 끌어 삭제'}
          </Text>
        </View>
      )}

      <TimetableMoreMenu
        visible={moreMenuOpen}
        overlapView={overlapView}
        onClose={() => setMoreMenuOpen(false)}
        onMembers={() => {
          setMoreMenuOpen(false);
          router.push('./members');
        }}
        onCalendar={() => {
          setMoreMenuOpen(false);
          router.push('./calendar');
        }}
        onSettings={() => {
          setMoreMenuOpen(false);
          setSettingsOpen(true);
        }}
        onCopyWeek={copyCurrentWeekToNextWeek}
        onToggleOverlap={() => {
          void toggleOverlapView();
        }}
        onDailySummary={showDailySummary}
        onSaveImage={() => {
          void saveTimetableImage();
        }}
      />

      <TimetableSettingsModal
        visible={settingsOpen}
        hourHeight={hourHeight}
        showPtRemaining={showPtRemaining}
        widgetPrivacyMode={widgetPrivacyMode}
        onClose={() => setSettingsOpen(false)}
        onHourHeightChange={(value) => {
          void changeHourHeight(value);
        }}
        onShowPtRemainingChange={(value) => {
          void changeShowPtRemaining(value);
        }}
        onWidgetPrivacyModeChange={(value) => {
          void changeWidgetPrivacyMode(value);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F6F8' },
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
  weekArrowText: { marginTop: -3, fontSize: 29, fontWeight: '300', color: '#2D3138' },
  weekLabelButton: {
    minWidth: 0,
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekTitle: { fontSize: 17, fontWeight: '900', color: '#1F232A' },
  headerActions: { marginLeft: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  smallHeaderButton: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  smallHeaderButtonText: { fontSize: 10, fontWeight: '900', color: '#5B6270' },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#24282F',
  },
  addButtonText: { marginTop: -2, fontSize: 23, fontWeight: '400', color: '#FFFFFF' },
  moreButton: {
    width: 28,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  moreButtonText: { marginTop: -2, fontSize: 25, lineHeight: 27, fontWeight: '900', color: '#2D3138' },
  briefingCard: {
    marginTop: 8,
    marginHorizontal: SCREEN_MARGIN,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E6F2',
    backgroundColor: '#F8F9FF',
  },
  briefingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  briefingTitle: { fontSize: 12, fontWeight: '900', color: '#333A52' },
  briefingSummary: { fontSize: 10, fontWeight: '800', color: '#5667B1' },
  briefingDetail: { marginTop: 4, fontSize: 10, fontWeight: '600', color: '#7C8493' },
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
  dayHeaderGutter: { width: TIME_GUTTER, borderRightWidth: 1, borderRightColor: '#E6E8EC' },
  dayHeaderCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#E6E8EC',
  },
  dayName: { fontSize: 10, fontWeight: '700', color: '#8A9099' },
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
  allDayLabel: { width: TIME_GUTTER, textAlign: 'center', fontSize: 8, fontWeight: '700', color: '#8A909B' },
  allDayContent: { gap: 5, paddingVertical: 4, paddingRight: 8 },
  allDayChip: {
    maxWidth: 90,
    minHeight: 22,
    paddingHorizontal: 7,
    borderRadius: 6,
    justifyContent: 'center',
  },
  allDayChipText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  gridScroll: { flex: 1, backgroundColor: '#FFFFFF' },
  grid: { position: 'relative', backgroundColor: '#FFFFFF' },
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
  todayColumn: { backgroundColor: '#F6F7FB' },
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
  currentTimeLine: { flex: 1, height: 1.4, backgroundColor: NOW_COLOR },
  trashZone: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1.5,
    borderColor: '#F0B9BE',
    borderRadius: 22,
    backgroundColor: '#FFF3F4',
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  trashZoneActive: {
    borderColor: '#E73345',
    backgroundColor: '#E73345',
    transform: [{ scale: 1.03 }],
  },
  trashIcon: { fontSize: 25 },
  trashText: { fontSize: 14, fontWeight: '900', color: '#D83D4B' },
  trashTextActive: { color: '#FFFFFF' },
});
