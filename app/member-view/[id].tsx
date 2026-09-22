import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  clearAppSession,
  getAppSession,
  memberHomeRoute,
  type AppSession,
} from '../../src/auth/appSession';
import {
  listBodyRecords,
  listTrainingLogs,
} from '../../src/data/memberFitnessRepository';
import { getMemberById } from '../../src/data/memberRepository';
import { listMemberUpcomingSchedules } from '../../src/data/scheduleRepository';
import { toLocalDateString } from '../../src/lib/date';
import type { BodyRecordItem, TrainingLogItem } from '../../src/types/memberFitness';
import type { MemberItem } from '../../src/types/member';
import type { ScheduleItem } from '../../src/types/schedule';

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function dateLabel(value: string) {
  const date = parseDate(value);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return (date.getMonth() + 1) + '월 ' + date.getDate() + '일 (' + weekdays[date.getDay()] + ')';
}

function shortDate(value: string) {
  const date = parseDate(value);
  return (date.getMonth() + 1) + '/' + date.getDate();
}

function membershipLabel(endDate: string | null) {
  if (!endDate) return '이용 중인 회원권 정보가 없어요';
  const end = parseDate(endDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return '회원권 오늘 만료';
  if (diff > 0) return '회원권 D-' + diff;
  return '회원권 만료 +' + Math.abs(diff) + '일';
}

function scheduleTimeLabel(schedule: ScheduleItem) {
  if (schedule.isAllDay) return '종일';
  if (!schedule.startTime) return '시간 미정';
  const start = schedule.startTime.slice(0, 5);
  const end = schedule.endTime ? schedule.endTime.slice(0, 5) : '';
  return end ? start + ' - ' + end : start;
}

function exerciseVolume(exercise: TrainingLogItem['exercises'][number]) {
  return exercise.sets.reduce((total, set) => {
    if (set.weight === null || set.reps === null) return total;
    return total + set.weight * set.reps;
  }, 0);
}

function trainingVolume(log: TrainingLogItem) {
  return log.exercises.reduce((total, exercise) => total + exerciseVolume(exercise), 0);
}

function formatVolume(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString('ko-KR')
    : value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
}

function metric(value: number | null, suffix: string) {
  return value === null ? '-' : value + suffix;
}

function metricDelta(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  return (diff >= 0 ? '+' : '') + diff.toFixed(1);
}

function isStillUpcoming(schedule: ScheduleItem, today: string, currentTime: string) {
  if (schedule.date > today) return true;
  if (schedule.date < today) return false;
  if (schedule.isAllDay || !schedule.startTime) return true;
  return schedule.startTime.slice(0, 5) >= currentTime;
}

export default function MemberViewScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [member, setMember] = useState<MemberItem | null>(null);
  const [trainingLogs, setTrainingLogs] = useState<TrainingLogItem[]>([]);
  const [bodyRecords, setBodyRecords] = useState<BodyRecordItem[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [appSession, setAppSession] = useState<AppSession | null>(null);

  useEffect(() => {
    let active = true;
    void getAppSession(db)
      .then((session) => {
        if (!active) return;
        setAppSession(session);
        if (session?.role === 'member' && session.memberId !== id) {
          router.replace(memberHomeRoute(session.memberId) as never);
        }
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, [db, id]);

  const loadAll = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    const today = toLocalDateString(new Date());
    try {
      setLoadError(false);
      const [memberRow, logs, body, schedules] = await Promise.all([
        getMemberById(db, id),
        listTrainingLogs(db, id, 12),
        listBodyRecords(db, id, 8),
        listMemberUpcomingSchedules(db, id, today, 20),
      ]);
      const now = new Date();
      const currentTime =
        String(now.getHours()).padStart(2, '0') +
        ':' +
        String(now.getMinutes()).padStart(2, '0');
      setMember(memberRow);
      setTrainingLogs(logs);
      setBodyRecords(body);
      setUpcomingSchedules(
        schedules.filter((schedule) => isStillUpcoming(schedule, today, currentTime)).slice(0, 3),
      );
    } catch (error) {
      console.error(error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadAll();
    }, [loadAll]),
  );

  const latestBody = bodyRecords[0] ?? null;
  const previousBody = bodyRecords[1] ?? null;
  const feedbackLog = useMemo(
    () => trainingLogs.find((log) => Boolean(log.feedback?.trim())) ?? null,
    [trainingLogs],
  );

  if (loading && !member) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color="#4B68FF" />
          <Text style={styles.loadingText}>회원 화면을 준비하고 있어요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!member || loadError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backText}>‹ 뒤로</Text>
          </Pressable>
          <Text style={styles.headerTitle}>회원용 화면</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>회원 정보를 불러오지 못했어요.</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadAll()}>
            <Text style={styles.retryButtonText}>다시 불러오기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const total = member.ptTotalSessions ?? 0;
  const remaining = member.ptRemainingSessions ?? 0;
  const completed = Math.max(total - remaining, 0);
  const progress = total > 0 ? Math.min(completed / total, 1) : 0;
  const nextSchedule = upcomingSchedules[0] ?? null;
  const isMemberMode =
    appSession?.role === 'member' && appSession.memberId === member.id;

  const logoutMember = async () => {
    await clearAppSession(db);
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {isMemberMode ? (
          <View style={styles.headerSpacer} />
        ) : (
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backText}>‹ 관리자</Text>
          </Pressable>
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{isMemberMode ? '내 운동' : '회원용 화면'}</Text>
          {!isMemberMode ? <Text style={styles.previewBadge}>미리보기</Text> : null}
        </View>
        {isMemberMode ? (
          <Pressable onPress={() => void logoutMember()} hitSlop={12}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroAvatar}>
              <Text style={styles.heroAvatarText}>{member.name.slice(0, 1)}</Text>
            </View>
            <View style={styles.heroGreeting}>
              <Text style={styles.hello}>안녕하세요,</Text>
              <Text style={styles.heroName}>{member.name}님 👋</Text>
              <Text style={styles.heroMembership}>{membershipLabel(member.membershipEndDate)}</Text>
            </View>
          </View>

          <View style={styles.ptSummary}>
            <View>
              <Text style={styles.ptLabel}>남은 PT</Text>
              <View style={styles.ptNumberRow}>
                <Text style={styles.ptNumber}>{member.ptRemainingSessions ?? '-'}</Text>
                <Text style={styles.ptUnit}>회</Text>
              </View>
            </View>
            <View style={styles.ptRight}>
              <Text style={styles.ptProgressText}>
                {total > 0 ? completed + ' / ' + total + '회 완료' : 'PT 횟수 미등록'}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` as `${number}%` }]} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>다음 예약</Text>
          <Text style={styles.sectionHint}>예정된 수업</Text>
        </View>

        {nextSchedule ? (
          <View style={styles.nextCard}>
            <View style={styles.calendarBadge}>
              <Text style={styles.calendarMonth}>{parseDate(nextSchedule.date).getMonth() + 1}월</Text>
              <Text style={styles.calendarDay}>{parseDate(nextSchedule.date).getDate()}</Text>
            </View>
            <View style={styles.nextInfo}>
              <Text style={styles.nextDate}>{dateLabel(nextSchedule.date)}</Text>
              <Text style={styles.nextTime}>{scheduleTimeLabel(nextSchedule)}</Text>
              <Text style={styles.nextTitle} numberOfLines={1}>
                {nextSchedule.title || 'PT 수업'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyTitle}>예정된 예약이 없어요.</Text>
            <Text style={styles.emptySub}>다음 수업이 등록되면 이곳에 바로 표시돼요.</Text>
          </View>
        )}

        {upcomingSchedules.length > 1 ? (
          <View style={styles.upcomingList}>
            {upcomingSchedules.slice(1).map((schedule) => (
              <View key={schedule.id} style={styles.upcomingRow}>
                <Text style={styles.upcomingDate}>{shortDate(schedule.date)}</Text>
                <Text style={styles.upcomingTime}>{scheduleTimeLabel(schedule)}</Text>
                <Text style={styles.upcomingTitle} numberOfLines={1}>{schedule.title}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>트레이너 피드백</Text>
          <Text style={styles.sectionHint}>{feedbackLog ? dateLabel(feedbackLog.date) : '최근 기록'}</Text>
        </View>

        <View style={styles.feedbackCard}>
          <View style={styles.feedbackIcon}>
            <Text style={styles.feedbackIconText}>✓</Text>
          </View>
          <View style={styles.feedbackBody}>
            {feedbackLog ? (
              <>
                <Text style={styles.feedbackTitle}>이번 운동도 잘 해냈어요!</Text>
                <Text style={styles.feedbackText}>{feedbackLog.feedback}</Text>
              </>
            ) : (
              <>
                <Text style={styles.feedbackTitle}>아직 등록된 피드백이 없어요.</Text>
                <Text style={styles.feedbackText}>운동일지에 트레이너 피드백이 작성되면 여기에 보여요.</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>최근 운동</Text>
          <Text style={styles.sectionHint}>{trainingLogs.length}개 기록</Text>
        </View>

        {trainingLogs.length > 0 ? (
          <View style={styles.workoutList}>
            {trainingLogs.slice(0, 3).map((log) => {
              const volume = trainingVolume(log);
              const exerciseNames = log.exercises
                .map((exercise) => exercise.name)
                .filter(Boolean)
                .slice(0, 4)
                .join(' · ');
              return (
                <View key={log.id} style={styles.workoutCard}>
                  <View style={styles.workoutHeader}>
                    <View>
                      <Text style={styles.workoutDate}>{dateLabel(log.date)}</Text>
                      <Text style={styles.workoutPart}>{log.bodyPart || '운동 기록'}</Text>
                    </View>
                    {volume > 0 ? (
                      <View style={styles.volumeBadge}>
                        <Text style={styles.volumeBadgeText}>{formatVolume(volume)}kg</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.exerciseNames} numberOfLines={2}>
                    {exerciseNames || '운동 종목 기록 없음'}
                  </Text>
                  {log.summary ? (
                    <Text style={styles.workoutSummary} numberOfLines={2}>{log.summary}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🏋️</Text>
            <Text style={styles.emptyTitle}>아직 운동 기록이 없어요.</Text>
            <Text style={styles.emptySub}>수업 후 작성된 운동일지가 여기에 쌓여요.</Text>
          </View>
        )}

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>인바디 변화</Text>
          <Text style={styles.sectionHint}>{latestBody ? latestBody.measuredDate : '측정 기록'}</Text>
        </View>

        {latestBody ? (
          <View style={styles.bodyCard}>
            <View style={styles.bodyMetricRow}>
              <View style={styles.bodyMetric}>
                <Text style={styles.bodyMetricLabel}>몸무게</Text>
                <Text style={styles.bodyMetricValue}>{metric(latestBody.weight, 'kg')}</Text>
                {previousBody ? (
                  <Text style={styles.bodyMetricDelta}>
                    {metricDelta(latestBody.weight, previousBody.weight) ?? '-'}
                  </Text>
                ) : null}
              </View>
              <View style={styles.bodyMetric}>
                <Text style={styles.bodyMetricLabel}>골격근량</Text>
                <Text style={styles.bodyMetricValue}>{metric(latestBody.skeletalMuscle, 'kg')}</Text>
                {previousBody ? (
                  <Text style={styles.bodyMetricDelta}>
                    {metricDelta(latestBody.skeletalMuscle, previousBody.skeletalMuscle) ?? '-'}
                  </Text>
                ) : null}
              </View>
              <View style={styles.bodyMetric}>
                <Text style={styles.bodyMetricLabel}>체지방률</Text>
                <Text style={styles.bodyMetricValue}>{metric(latestBody.bodyFatPercentage, '%')}</Text>
                {previousBody ? (
                  <Text style={styles.bodyMetricDelta}>
                    {metricDelta(latestBody.bodyFatPercentage, previousBody.bodyFatPercentage) ?? '-'}
                  </Text>
                ) : null}
              </View>
            </View>

            {bodyRecords.length > 1 ? (
              <View style={styles.bodyHistory}>
                {bodyRecords.slice(0, 4).map((record) => (
                  <View key={record.id} style={styles.bodyHistoryRow}>
                    <Text style={styles.bodyHistoryDate}>{shortDate(record.measuredDate)}</Text>
                    <Text style={styles.bodyHistoryValue}>{metric(record.weight, 'kg')}</Text>
                    <Text style={styles.bodyHistoryValue}>근육 {metric(record.skeletalMuscle, 'kg')}</Text>
                    <Text style={styles.bodyHistoryValue}>지방 {metric(record.bodyFatPercentage, '%')}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📈</Text>
            <Text style={styles.emptyTitle}>아직 인바디 기록이 없어요.</Text>
            <Text style={styles.emptySub}>측정값이 등록되면 변화 추이를 확인할 수 있어요.</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6FA' },
  header: {
    height: 58,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E4EA',
    backgroundColor: '#FFFFFF',
  },
  backText: { width: 76, fontSize: 14, fontWeight: '800', color: '#4B68FF' },
  headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: '#20242C' },
  previewBadge: {
    marginTop: 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 8,
    fontWeight: '900',
    color: '#6677CB',
    backgroundColor: '#EEF1FF',
  },
  headerSpacer: { width: 76 },
  logoutText: { width: 76, textAlign: 'right', fontSize: 12, fontWeight: '800', color: '#6F7784' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  loadingText: { marginTop: 10, fontSize: 12, color: '#858C98' },
  errorTitle: { fontSize: 14, fontWeight: '900', color: '#4A505A' },
  retryButton: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#4B68FF',
  },
  retryButtonText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  content: { padding: 14, paddingBottom: 42 },
  contentTablet: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 56,
  },
  heroCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#4058D6',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroAvatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  heroAvatarText: { fontSize: 22, fontWeight: '900', color: '#4058D6' },
  heroGreeting: { flex: 1, marginLeft: 13 },
  hello: { fontSize: 11, fontWeight: '700', color: '#CFD6FF' },
  heroName: { marginTop: 1, fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  heroMembership: { marginTop: 5, fontSize: 10, fontWeight: '800', color: '#DCE1FF' },
  ptSummary: {
    marginTop: 18,
    padding: 14,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  ptLabel: { fontSize: 10, fontWeight: '800', color: '#DCE1FF' },
  ptNumberRow: { flexDirection: 'row', alignItems: 'baseline' },
  ptNumber: { marginTop: 1, fontSize: 31, fontWeight: '900', color: '#FFFFFF' },
  ptUnit: { marginLeft: 3, fontSize: 12, fontWeight: '800', color: '#DCE1FF' },
  ptRight: { flex: 1, marginLeft: 22 },
  ptProgressText: { fontSize: 10, fontWeight: '800', color: '#EEF0FF' },
  progressTrack: {
    height: 7,
    marginTop: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  progressFill: { height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  sectionTitleRow: {
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#242932' },
  sectionHint: { fontSize: 10, fontWeight: '700', color: '#969DA9' },
  nextCard: {
    minHeight: 104,
    padding: 15,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  calendarBadge: {
    width: 60,
    height: 70,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF1FF',
  },
  calendarMonth: { fontSize: 10, fontWeight: '900', color: '#6675C6' },
  calendarDay: { marginTop: 1, fontSize: 27, fontWeight: '900', color: '#4058D6' },
  nextInfo: { flex: 1, marginLeft: 14 },
  nextDate: { fontSize: 11, fontWeight: '800', color: '#7E8590' },
  nextTime: { marginTop: 3, fontSize: 19, fontWeight: '900', color: '#252A32' },
  nextTitle: { marginTop: 4, fontSize: 11, fontWeight: '800', color: '#59616D' },
  upcomingList: {
    marginTop: 7,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  upcomingRow: {
    minHeight: 42,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ECEEF2',
  },
  upcomingDate: { width: 42, fontSize: 10, fontWeight: '900', color: '#5968B5' },
  upcomingTime: { width: 88, fontSize: 10, fontWeight: '800', color: '#747B86' },
  upcomingTitle: { flex: 1, fontSize: 10, fontWeight: '800', color: '#424851' },
  feedbackCard: {
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    backgroundColor: '#FFFDF5',
    borderWidth: 1,
    borderColor: '#F2E9C8',
  },
  feedbackIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E5A9',
  },
  feedbackIconText: { fontSize: 18, fontWeight: '900', color: '#826A12' },
  feedbackBody: { flex: 1, marginLeft: 12 },
  feedbackTitle: { fontSize: 13, fontWeight: '900', color: '#4B4530' },
  feedbackText: { marginTop: 5, fontSize: 12, lineHeight: 18, color: '#756E55' },
  workoutList: { gap: 8 },
  workoutCard: { padding: 15, borderRadius: 18, backgroundColor: '#FFFFFF' },
  workoutHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  workoutDate: { fontSize: 11, fontWeight: '800', color: '#858C98' },
  workoutPart: { marginTop: 3, fontSize: 15, fontWeight: '900', color: '#2C3139' },
  volumeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EAF6F0',
  },
  volumeBadgeText: { fontSize: 10, fontWeight: '900', color: '#2D7A57' },
  exerciseNames: { marginTop: 11, fontSize: 11, lineHeight: 17, fontWeight: '800', color: '#606873' },
  workoutSummary: { marginTop: 7, fontSize: 11, lineHeight: 17, color: '#8A919C' },
  bodyCard: { padding: 14, borderRadius: 20, backgroundColor: '#FFFFFF' },
  bodyMetricRow: { flexDirection: 'row', gap: 8 },
  bodyMetric: {
    flex: 1,
    minHeight: 88,
    padding: 11,
    borderRadius: 14,
    backgroundColor: '#F6F7F9',
  },
  bodyMetricLabel: { fontSize: 9, fontWeight: '800', color: '#8A919C' },
  bodyMetricValue: { marginTop: 7, fontSize: 17, fontWeight: '900', color: '#2B3038' },
  bodyMetricDelta: { marginTop: 4, fontSize: 10, fontWeight: '900', color: '#5265BD' },
  bodyHistory: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E9EBEF' },
  bodyHistoryRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center' },
  bodyHistoryDate: { width: 42, fontSize: 10, fontWeight: '900', color: '#59616D' },
  bodyHistoryValue: { flex: 1, fontSize: 9, color: '#7F8792' },
  emptyCard: { paddingVertical: 18, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center', backgroundColor: '#FFFFFF' },
  emptyEmoji: { fontSize: 25 },
  emptyTitle: { marginTop: 8, fontSize: 13, fontWeight: '900', color: '#4A515B' },
  emptySub: { marginTop: 4, fontSize: 10, textAlign: 'center', color: '#959CA7' },
});
