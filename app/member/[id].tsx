import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BodyRecordModal } from '../../src/components/BodyRecordModal';
import { MemberSignatureHistoryModal } from '../../src/components/MemberSignatureHistoryModal';
import { TrainingLogModal } from '../../src/components/TrainingLogModal';
import {
  createBodyRecord,
  createTrainingLog,
  listBodyRecords,
  listTrainingLogs,
} from '../../src/data/memberFitnessRepository';
import { getMemberById } from '../../src/data/memberRepository';
import {
  listSignedMemberSessions,
  type SignedMemberSession,
} from '../../src/data/scheduleRepository';
import { toLocalDateString } from '../../src/lib/date';
import type { BodyRecordItem, CreateBodyRecordInput, CreateTrainingLogInput, TrainingLogItem } from '../../src/types/memberFitness';
import type { MemberItem } from '../../src/types/member';

function shortDate(value: string) {
  const [, month, day] = value.split('-').map(Number);
  return `${month}/${day}`;
}

function membershipDday(endDate: string | null) {
  if (!endDate) return null;
  const [year, month, day] = endDate.split('-').map(Number);
  const end = new Date(year, month - 1, day, 12, 0, 0, 0);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return '오늘 만료';
  if (diff > 0) return `D-${diff}`;
  return `만료 +${Math.abs(diff)}일`;
}

function formatMetric(value: number | null, suffix = '') {
  return value === null ? '-' : `${value}${suffix}`;
}

function exerciseVolume(exercise: TrainingLogItem['exercises'][number]) {
  return exercise.sets.reduce((total, set) => {
    if (set.weight === null || set.reps === null) return total;
    return total + set.weight * set.reps;
  }, 0);
}

function trainingLogVolume(log: TrainingLogItem) {
  return log.exercises.reduce(
    (total, exercise) => total + exerciseVolume(exercise),
    0,
  );
}

function formatVolume(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString('ko-KR')
    : value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
}

export default function MemberDetailScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;
  const params = useLocalSearchParams<{
    id?: string;
    scheduleId?: string;
    date?: string;
    newLog?: string;
  }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const scheduleId = typeof params.scheduleId === 'string' ? params.scheduleId : null;
  const routeDate =
    typeof params.date === 'string' ? params.date : toLocalDateString(new Date());

  const [member, setMember] = useState<MemberItem | null>(null);
  const [trainingLogs, setTrainingLogs] = useState<TrainingLogItem[]>([]);
  const [bodyRecords, setBodyRecords] = useState<BodyRecordItem[]>([]);
  const [signedSessions, setSignedSessions] = useState<SignedMemberSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [bodyModalOpen, setBodyModalOpen] = useState(false);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [savingBody, setSavingBody] = useState(false);
  const [didAutoOpen, setDidAutoOpen] = useState(false);

  const loadAll = useCallback(async () => {
    if (!id) return;
    try {
      const [memberRow, logs, body, signatures] = await Promise.all([
        getMemberById(db, id),
        listTrainingLogs(db, id, 50),
        listBodyRecords(db, id, 50),
        listSignedMemberSessions(db, id),
      ]);
      setMember(memberRow);
      setTrainingLogs(logs);
      setBodyRecords(body);
      setSignedSessions(signatures);
    } catch (error) {
      console.error(error);
      Alert.alert('회원 기록을 불러오지 못했어요.');
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

  useEffect(() => {
    if (didAutoOpen || params.newLog !== '1' || !member) return;
    setDidAutoOpen(true);
    setLogModalOpen(true);
  }, [didAutoOpen, member, params.newLog]);

  const signedSessionNumberByScheduleId = useMemo(
    () => new Map(signedSessions.map((session) => [session.id, session.sessionNumber])),
    [signedSessions],
  );

  const latestBody = bodyRecords[0] ?? null;
  const previousBody = bodyRecords[1] ?? null;
  const dday = membershipDday(member?.membershipEndDate ?? null);

  const saveTrainingLog = async (input: CreateTrainingLogInput) => {
    try {
      setSavingLog(true);
      await createTrainingLog(db, input);
      setLogModalOpen(false);
      await loadAll();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : '';
      if (message.includes('TRAINING_LOG_ALREADY_EXISTS')) {
        Alert.alert('이미 작성된 수업일지예요.', '이 시간표 수업에는 이미 운동일지가 저장되어 있어요.');
      } else {
        Alert.alert('운동일지를 저장하지 못했어요.');
      }
    } finally {
      setSavingLog(false);
    }
  };

  const saveBodyRecord = async (input: CreateBodyRecordInput) => {
    try {
      setSavingBody(true);
      await createBodyRecord(db, input);
      setBodyModalOpen(false);
      await loadAll();
    } catch (error) {
      console.error(error);
      Alert.alert('인바디 기록을 저장하지 못했어요.');
    } finally {
      setSavingBody(false);
    }
  };

  if (loading && !member) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <ActivityIndicator color="#4B68FF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!member) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.backText}>‹ 뒤로</Text>
          </Pressable>
          <Text style={styles.headerTitle}>회원 기록</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loading}>
          <Text style={styles.emptyText}>회원을 찾을 수 없어요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.backText}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.headerTitle}>회원 기록</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isTablet && styles.contentTablet,
        ]}
      >
        <View style={[styles.profileCard, isTablet && styles.profileCardTablet]}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{member.name.slice(0, 1)}</Text>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberMeta}>
                PT 잔여 {member.ptRemainingSessions ?? '-'} / {member.ptTotalSessions ?? '-'}회
                {dday ? ` · 회원권 ${dday}` : ''}
              </Text>
              {member.phone ? <Text style={styles.memberPhone}>{member.phone}</Text> : null}
            </View>
          </View>

          <View style={styles.quickActions}>
            <Pressable
              style={[styles.primaryAction, isTablet && styles.primaryActionTablet]}
              onPress={() => setLogModalOpen(true)}
            >
              <Text style={styles.primaryActionTitle}>+ 운동일지</Text>
              <Text style={styles.primaryActionSub}>오늘 수업 기록</Text>
            </Pressable>
            <Pressable style={[styles.quickAction, isTablet && styles.quickActionTablet]} onPress={() => setBodyModalOpen(true)}>
              <Text style={styles.quickActionTitle}>인바디</Text>
              <Text style={styles.quickActionSub}>체성분 기록</Text>
            </Pressable>
            <Pressable style={[styles.quickAction, isTablet && styles.quickActionTablet]} onPress={() => setSignatureModalOpen(true)}>
              <Text style={styles.quickActionTitle}>서명</Text>
              <Text style={styles.quickActionSub}>{signedSessions.length}개 기록</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>인바디 변화</Text>
          <Text style={styles.sectionCount}>{bodyRecords.length}회 측정</Text>
        </View>

        {latestBody ? (
          <View style={styles.bodyCard}>
            <View style={styles.bodyCardHeader}>
              <Text style={styles.bodyDate}>{latestBody.measuredDate}</Text>
              {previousBody ? (
                <Text style={styles.bodyCompare}>직전 측정 대비</Text>
              ) : null}
            </View>
            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>몸무게</Text>
                <Text style={styles.metricValue}>{formatMetric(latestBody.weight, 'kg')}</Text>
                {previousBody?.weight !== null && previousBody?.weight !== undefined && latestBody.weight !== null ? (
                  <Text style={styles.metricDelta}>
                    {latestBody.weight - previousBody.weight >= 0 ? '+' : ''}
                    {(latestBody.weight - previousBody.weight).toFixed(1)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>골격근</Text>
                <Text style={styles.metricValue}>{formatMetric(latestBody.skeletalMuscle, 'kg')}</Text>
                {previousBody?.skeletalMuscle !== null &&
                previousBody?.skeletalMuscle !== undefined &&
                latestBody.skeletalMuscle !== null ? (
                  <Text style={styles.metricDelta}>
                    {latestBody.skeletalMuscle - previousBody.skeletalMuscle >= 0 ? '+' : ''}
                    {(latestBody.skeletalMuscle - previousBody.skeletalMuscle).toFixed(1)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>체지방률</Text>
                <Text style={styles.metricValue}>{formatMetric(latestBody.bodyFatPercentage, '%')}</Text>
                {previousBody?.bodyFatPercentage !== null &&
                previousBody?.bodyFatPercentage !== undefined &&
                latestBody.bodyFatPercentage !== null ? (
                  <Text style={styles.metricDelta}>
                    {latestBody.bodyFatPercentage - previousBody.bodyFatPercentage >= 0 ? '+' : ''}
                    {(latestBody.bodyFatPercentage - previousBody.bodyFatPercentage).toFixed(1)}
                  </Text>
                ) : null}
              </View>
            </View>

            {bodyRecords.slice(0, 6).map((record) => (
              <View key={record.id} style={styles.bodyHistoryRow}>
                <Text style={styles.bodyHistoryDate}>{shortDate(record.measuredDate)}</Text>
                <Text style={styles.bodyHistoryText}>
                  {formatMetric(record.weight, 'kg')} · 근육 {formatMetric(record.skeletalMuscle, 'kg')} · 지방 {formatMetric(record.bodyFatPercentage, '%')}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Pressable style={styles.emptyCard} onPress={() => setBodyModalOpen(true)}>
            <Text style={styles.emptyTitle}>아직 인바디 기록이 없어요.</Text>
            <Text style={styles.emptyText}>첫 측정값을 입력해 주세요.</Text>
          </Pressable>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>운동일지</Text>
          <Text style={styles.sectionCount}>{trainingLogs.length}개 기록</Text>
        </View>

        {trainingLogs.length === 0 ? (
          <Pressable style={styles.emptyCard} onPress={() => setLogModalOpen(true)}>
            <Text style={styles.emptyTitle}>아직 운동일지가 없어요.</Text>
            <Text style={styles.emptyText}>구글시트 대신 첫 수업 기록을 남겨보세요.</Text>
          </Pressable>
        ) : (
          trainingLogs.map((log) => {
            const sessionNumber = log.scheduleId
              ? signedSessionNumberByScheduleId.get(log.scheduleId)
              : null;
            return (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View>
                    <Text style={styles.logDate}>
                      {sessionNumber ? `${sessionNumber}회째 · ` : ''}
                      {log.date.replaceAll('-', '.')}
                    </Text>
                    <Text style={styles.logPart}>{log.bodyPart || '운동부위 미입력'}</Text>
                  </View>
                  <View style={styles.conditionBadge}>
                    <Text style={styles.conditionText}>
                      컨디션 {log.conditionLevel ?? '-'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.logDiagnosis}>
                  숙면 {log.sleepQuality ?? '-'} · 활동 {log.activityLevel ?? '-'} · 식단 {log.dietControl ? '✓' : '-'} · 수분 {log.hydration ? '✓' : '-'}
                </Text>

                {log.exercises.length > 0 ? (
                  <View style={styles.exerciseList}>
                    {log.exercises.map((exercise) => (
                      <View key={exercise.id} style={styles.exerciseRow}>
                        <View style={styles.exerciseNameRow}>
                          <Text style={styles.exerciseName}>{exercise.name}</Text>
                          <Text style={styles.exerciseVolume}>
                            {formatVolume(exerciseVolume(exercise))}kg
                          </Text>
                        </View>
                        <Text style={styles.exerciseSets}>
                          {exercise.sets.length > 0
                            ? exercise.sets
                                .map((set) =>
                                  `${set.weight ?? '-'}×${set.reps ?? '-'}`,
                                )
                                .join('  ')
                            : '세트 기록 없음'}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {log.exercises.length > 0 ? (
                  <View style={styles.totalVolumeCard}>
                    <Text style={styles.totalVolumeLabel}>총 볼륨</Text>
                    <Text style={styles.totalVolumeValue}>
                      {formatVolume(trainingLogVolume(log))}kg
                    </Text>
                  </View>
                ) : null}

                {log.cardioTreadmill || log.cardioBike || log.cardioStepmill ? (
                  <Text style={styles.logCardio}>
                    유산소
                    {log.cardioTreadmill ? ` · 트레드밀 ${log.cardioTreadmill}` : ''}
                    {log.cardioBike ? ` · 싸이클 ${log.cardioBike}` : ''}
                    {log.cardioStepmill ? ` · 스텝밀 ${log.cardioStepmill}` : ''}
                  </Text>
                ) : null}

                {log.summary ? <Text style={styles.logSummary}>“{log.summary}”</Text> : null}
                {log.feedback ? <Text style={styles.logFeedback}>{log.feedback}</Text> : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <TrainingLogModal
        visible={logModalOpen}
        memberId={member.id}
        memberName={member.name}
        date={routeDate}
        scheduleId={scheduleId}
        saving={savingLog}
        onClose={() => setLogModalOpen(false)}
        onSubmit={(input) => void saveTrainingLog(input)}
      />

      <BodyRecordModal
        visible={bodyModalOpen}
        memberId={member.id}
        memberName={member.name}
        date={toLocalDateString(new Date())}
        saving={savingBody}
        onClose={() => setBodyModalOpen(false)}
        onSubmit={(input) => void saveBodyRecord(input)}
      />

      <MemberSignatureHistoryModal
        visible={signatureModalOpen}
        memberName={member.name}
        sessions={signedSessions}
        onClose={() => setSignatureModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F6F8' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    height: 58,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E1E4E9',
    backgroundColor: '#FFFFFF',
  },
  backText: { minWidth: 60, fontSize: 15, fontWeight: '800', color: '#4B68FF' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#20242C' },
  headerSpacer: { width: 60 },
  content: { padding: 14, paddingBottom: 36 },
  contentTablet: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 48,
  },
  profileCard: { padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF' },
  profileCardTablet: {
    padding: 22,
    borderRadius: 24,
  },
  profileTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9EDFF',
  },
  avatarText: { fontSize: 20, fontWeight: '900', color: '#4B68FF' },
  profileText: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 20, fontWeight: '900', color: '#20242C' },
  memberMeta: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#646C78' },
  memberPhone: { marginTop: 3, fontSize: 11, color: '#8A919C' },
  quickActions: { marginTop: 15, flexDirection: 'row', gap: 8 },
  primaryAction: {
    flex: 1.25,
    minHeight: 62,
    paddingHorizontal: 12,
    borderRadius: 14,
    justifyContent: 'center',
    backgroundColor: '#4B68FF',
  },
  primaryActionTablet: {
    minHeight: 76,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  primaryActionTitle: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  primaryActionSub: { marginTop: 3, fontSize: 10, color: '#DDE3FF' },
  quickAction: {
    flex: 1,
    minHeight: 62,
    paddingHorizontal: 10,
    borderRadius: 14,
    justifyContent: 'center',
    backgroundColor: '#F1F3F7',
  },
  quickActionTablet: {
    minHeight: 76,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  quickActionTitle: { fontSize: 13, fontWeight: '900', color: '#383F49' },
  quickActionSub: { marginTop: 3, fontSize: 10, color: '#858C98' },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#252A32' },
  sectionCount: { fontSize: 11, fontWeight: '700', color: '#8A919C' },
  bodyCard: { padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF' },
  bodyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bodyDate: { fontSize: 13, fontWeight: '900', color: '#333943' },
  bodyCompare: { fontSize: 10, color: '#959BA5' },
  metricRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  metric: {
    flex: 1,
    minHeight: 76,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F6F7F9',
  },
  metricLabel: { fontSize: 10, fontWeight: '800', color: '#858C98' },
  metricValue: { marginTop: 6, fontSize: 16, fontWeight: '900', color: '#252A32' },
  metricDelta: { marginTop: 3, fontSize: 10, fontWeight: '800', color: '#5968B5' },
  bodyHistoryRow: {
    minHeight: 30,
    marginTop: 6,
    paddingHorizontal: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bodyHistoryDate: { width: 42, fontSize: 10, fontWeight: '900', color: '#59616D' },
  bodyHistoryText: { flex: 1, fontSize: 10, color: '#7B828D' },
  emptyCard: {
    padding: 22,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: { fontSize: 13, fontWeight: '900', color: '#515864' },
  emptyText: { marginTop: 4, fontSize: 11, color: '#9299A4' },
  logCard: {
    marginBottom: 9,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  logHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  logDate: { fontSize: 14, fontWeight: '900', color: '#252A32' },
  logPart: { marginTop: 3, fontSize: 11, fontWeight: '800', color: '#5968B5' },
  conditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: '#EEF1FF',
  },
  conditionText: { fontSize: 10, fontWeight: '900', color: '#5261A8' },
  logDiagnosis: { marginTop: 9, fontSize: 10, color: '#7A818D' },
  exerciseList: { marginTop: 10, gap: 5 },
  exerciseRow: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#F6F7F9',
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  exerciseName: { flex: 1, fontSize: 11, fontWeight: '900', color: '#3F4650' },
  exerciseVolume: {
    fontSize: 10,
    fontWeight: '900',
    color: '#2D7A57',
  },
  exerciseSets: { marginTop: 2, fontSize: 10, color: '#727A86' },
  totalVolumeCard: {
    minHeight: 36,
    marginTop: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EAF6F0',
  },
  totalVolumeLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#517060',
  },
  totalVolumeValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#2D7A57',
  },
  logCardio: { marginTop: 8, fontSize: 10, color: '#757D88' },
  logSummary: { marginTop: 10, fontSize: 12, fontWeight: '800', color: '#343A44' },
  logFeedback: { marginTop: 5, fontSize: 11, lineHeight: 16, color: '#777E89' },
});
