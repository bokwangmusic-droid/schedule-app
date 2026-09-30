import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SimpleDatePickerModal } from './SimpleDatePickerModal';
import {
  loadTrainingLogDraft,
  saveTrainingLogDraft,
  trainingLogDraftKey,
} from '../data/trainingLogDraftRepository';
import type {
  CreateTrainingLogInput,
  TrainingLogItem,
  WellnessLevel,
} from '../types/memberFitness';

type EditableSet = {
  weight: string;
  reps: string;
};

type EditableExercise = {
  name: string;
  sets: EditableSet[];
};

type Props = {
  visible: boolean;
  memberId: string;
  memberName: string;
  date: string;
  scheduleId?: string | null;
  initialLog?: TrainingLogItem | null;
  recentLogs?: TrainingLogItem[];
  saving?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTrainingLogInput) => void;
};

const LEVELS: WellnessLevel[] = ['상', '중', '하'];

function emptyExercise(): EditableExercise {
  return {
    name: '',
    sets: [{ weight: '', reps: '' }],
  };
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function editableExerciseVolume(exercise: EditableExercise) {
  return exercise.sets.reduce((total, set) => {
    const weight = parseOptionalNumber(set.weight);
    const reps = parseOptionalNumber(set.reps);
    if (weight === null || reps === null) return total;
    return total + weight * reps;
  }, 0);
}

function formatVolume(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString('ko-KR')
    : value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
}

function trainingLogVolume(log: TrainingLogItem) {
  return log.exercises.reduce(
    (total, exercise) =>
      total +
      exercise.sets.reduce((exerciseTotal, set) => {
        if (set.weight === null || set.reps === null) return exerciseTotal;
        return exerciseTotal + set.weight * set.reps;
      }, 0),
    0,
  );
}

function volumePlanText(logs: TrainingLogItem[]) {
  const usable = logs.filter((log) => trainingLogVolume(log) > 0).slice(0, 4);
  if (usable.length === 0) {
    return '아직 비교할 운동 기록이 부족해요. 오늘 수행량을 저장하면 다음 수업부터 볼륨 방향을 제안할게요.';
  }

  const latest = usable[0];
  const latestVolume = trainingLogVolume(latest);
  const prior = usable.slice(1);
  const priorAverage =
    prior.length > 0
      ? prior.reduce((total, log) => total + trainingLogVolume(log), 0) / prior.length
      : 0;

  if (latest.conditionLevel === '하' || latest.sleepQuality === '하') {
    return `최근 컨디션을 고려하면 오늘은 볼륨을 무리하게 올리기보다 최근 ${formatVolume(latestVolume)}kg 안팎 또는 10~15% 낮게 시작하는 편이 좋아요.`;
  }

  if (priorAverage <= 0) {
    return `최근 총 볼륨은 ${formatVolume(latestVolume)}kg이에요. 컨디션이 좋다면 동일 볼륨을 안정적으로 재현한 뒤 소폭 증가를 검토해보세요.`;
  }

  const change = ((latestVolume - priorAverage) / priorAverage) * 100;
  if (change >= 10) {
    return `최근 볼륨이 이전 평균보다 약 ${change.toFixed(0)}% 높아요. 오늘은 추가 증량보다 현재 수준을 유지하거나 세트 품질을 확인하는 편이 좋아요.`;
  }
  if (change <= -10) {
    return `최근 볼륨이 이전 평균보다 약 ${Math.abs(change).toFixed(0)}% 낮아요. 컨디션이 괜찮다면 5~10% 정도 점진적으로 올려볼 수 있어요.`;
  }
  return '최근 볼륨 변화가 크지 않아요. 수행이 안정적이고 컨디션이 좋다면 총 볼륨을 약 5% 정도만 올리는 식으로 진행해보세요.';
}

function MealRow({
  title, carbs, onCarbs, protein, onProtein, fat, onFat, isTablet,
}: {
  title: string;
  carbs: string;
  onCarbs: (value: string) => void;
  protein: string;
  onProtein: (value: string) => void;
  fat: string;
  onFat: (value: string) => void;
  isTablet: boolean;
}) {
  return (
    <View style={styles.mealCard}>
      <Text style={styles.mealTitle}>{title}</Text>
      <TextInput value={carbs} onChangeText={onCarbs} placeholder="탄수화물" placeholderTextColor="#A2A8B2" style={[styles.smallInput, isTablet && styles.smallInputTablet]} />
      <TextInput value={protein} onChangeText={onProtein} placeholder="단백질" placeholderTextColor="#A2A8B2" style={[styles.smallInput, isTablet && styles.smallInputTablet]} />
      <TextInput value={fat} onChangeText={onFat} placeholder="지방" placeholderTextColor="#A2A8B2" style={[styles.smallInput, isTablet && styles.smallInputTablet]} />
    </View>
  );
}

export function TrainingLogModal({
  visible,
  memberId,
  memberName,
  date,
  scheduleId = null,
  initialLog = null,
  recentLogs = [],
  saving = false,
  onClose,
  onSubmit,
}: Props) {
  const db = useSQLiteContext();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 700;
  const isTabletLandscape = isTablet && width > height;
  const draftKey = trainingLogDraftKey(memberId, scheduleId, initialLog?.id ?? null);
  const [logDate, setLogDate] = useState(date);
  const [bodyPart, setBodyPart] = useState('');
  const [sleepQuality, setSleepQuality] = useState<WellnessLevel>('중');
  const [conditionLevel, setConditionLevel] = useState<WellnessLevel>('중');
  const [activityLevel, setActivityLevel] = useState<WellnessLevel>('중');
  const [dietControl, setDietControl] = useState(false);
  const [hydration, setHydration] = useState(false);
  const [cardioTreadmill, setCardioTreadmill] = useState('');
  const [cardioBike, setCardioBike] = useState('');
  const [cardioStepmill, setCardioStepmill] = useState('');
  const [breakfastCarbs, setBreakfastCarbs] = useState('');
  const [breakfastProtein, setBreakfastProtein] = useState('');
  const [breakfastFat, setBreakfastFat] = useState('');
  const [lunchCarbs, setLunchCarbs] = useState('');
  const [lunchProtein, setLunchProtein] = useState('');
  const [lunchFat, setLunchFat] = useState('');
  const [dinnerCarbs, setDinnerCarbs] = useState('');
  const [dinnerProtein, setDinnerProtein] = useState('');
  const [dinnerFat, setDinnerFat] = useState('');
  const [snack, setSnack] = useState('');
  const [summary, setSummary] = useState('');
  const [feedback, setFeedback] = useState('');
  const [exercises, setExercises] = useState<EditableExercise[]>([emptyExercise()]);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState('자동 저장 준비');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [routinePickerOpen, setRoutinePickerOpen] = useState(false);
  const [routineFilter, setRoutineFilter] = useState('전체');
  const [selectedRoutine, setSelectedRoutine] = useState<TrainingLogItem | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const historyLogs = recentLogs.filter((log) => log.id !== initialLog?.id);
  const latestHistoryLog = historyLogs[0] ?? null;
  const routineParts = ['전체', '가슴', '등', '하체', '어깨', '팔'];
  const filteredRoutineLogs = historyLogs.filter((log) =>
    routineFilter === '전체' || (log.bodyPart ?? '').includes(routineFilter)
  );
  const planText = volumePlanText(historyLogs);
  const totalVolume = exercises.reduce(
    (total, exercise) => total + editableExerciseVolume(exercise),
    0,
  );

  const reset = () => {
    setLogDate(date);
    setBodyPart('');
    setSleepQuality('중');
    setConditionLevel('중');
    setActivityLevel('중');
    setDietControl(false);
    setHydration(false);
    setCardioTreadmill('');
    setCardioBike('');
    setCardioStepmill('');
    setBreakfastCarbs('');
    setBreakfastProtein('');
    setBreakfastFat('');
    setLunchCarbs('');
    setLunchProtein('');
    setLunchFat('');
    setDinnerCarbs('');
    setDinnerProtein('');
    setDinnerFat('');
    setSnack('');
    setSummary('');
    setFeedback('');
    setExercises([emptyExercise()]);
  };

  const applyInput = (input: CreateTrainingLogInput) => {
    setLogDate(input.date || date);
    setBodyPart(input.bodyPart ?? '');
    setSleepQuality(input.sleepQuality ?? '중');
    setConditionLevel(input.conditionLevel ?? '중');
    setActivityLevel(input.activityLevel ?? '중');
    setDietControl(Boolean(input.dietControl));
    setHydration(Boolean(input.hydration));
    setCardioTreadmill(input.cardioTreadmill ?? '');
    setCardioBike(input.cardioBike ?? '');
    setCardioStepmill(input.cardioStepmill ?? '');
    setBreakfastCarbs(input.breakfastCarbs ?? '');
    setBreakfastProtein(input.breakfastProtein ?? '');
    setBreakfastFat(input.breakfastFat ?? '');
    setLunchCarbs(input.lunchCarbs ?? '');
    setLunchProtein(input.lunchProtein ?? '');
    setLunchFat(input.lunchFat ?? '');
    setDinnerCarbs(input.dinnerCarbs ?? '');
    setDinnerProtein(input.dinnerProtein ?? '');
    setDinnerFat(input.dinnerFat ?? '');
    setSnack(input.snack ?? '');
    setSummary(input.summary ?? '');
    setFeedback(input.feedback ?? '');
    setExercises(
      input.exercises && input.exercises.length > 0
        ? input.exercises.map((exercise) => ({
            name: exercise.name,
            sets:
              exercise.sets.length > 0
                ? exercise.sets.map((set) => ({
                    weight: set.weight === null ? '' : String(set.weight),
                    reps: set.reps === null ? '' : String(set.reps),
                  }))
                : [{ weight: '', reps: '' }],
          }))
        : [emptyExercise()],
    );
  };

  const buildInput = (): CreateTrainingLogInput => ({
    memberId,
    scheduleId,
    date: logDate,
    bodyPart,
    sleepQuality,
    conditionLevel,
    activityLevel,
    dietControl,
    hydration,
    cardioTreadmill,
    cardioBike,
    cardioStepmill,
    breakfastCarbs,
    breakfastProtein,
    breakfastFat,
    lunchCarbs,
    lunchProtein,
    lunchFat,
    dinnerCarbs,
    dinnerProtein,
    dinnerFat,
    snack,
    summary,
    feedback,
    exercises: exercises
      .filter((exercise) => exercise.name.trim())
      .map((exercise) => ({
        name: exercise.name.trim(),
        sets: exercise.sets.map((set) => ({
          weight: parseOptionalNumber(set.weight),
          reps: parseOptionalNumber(set.reps),
        })),
      })),
  });

  useEffect(() => {
    if (!visible) {
      setDraftReady(false);
      return;
    }

    let cancelled = false;
    setDraftReady(false);
    setDraftStatus('임시저장 확인 중');

    void (async () => {
      try {
        const draft = await loadTrainingLogDraft(db, draftKey);
        if (cancelled) return;

        if (draft) {
          applyInput(draft.input);
          setDraftStatus('임시저장 복원됨');
        } else if (initialLog) {
          applyInput({
            memberId,
            scheduleId: initialLog.scheduleId,
            date: initialLog.date,
            bodyPart: initialLog.bodyPart,
            sleepQuality: initialLog.sleepQuality,
            conditionLevel: initialLog.conditionLevel,
            activityLevel: initialLog.activityLevel,
            dietControl: initialLog.dietControl,
            hydration: initialLog.hydration,
            cardioTreadmill: initialLog.cardioTreadmill,
            cardioBike: initialLog.cardioBike,
            cardioStepmill: initialLog.cardioStepmill,
            breakfastCarbs: initialLog.breakfastCarbs,
            breakfastProtein: initialLog.breakfastProtein,
            breakfastFat: initialLog.breakfastFat,
            lunchCarbs: initialLog.lunchCarbs,
            lunchProtein: initialLog.lunchProtein,
            lunchFat: initialLog.lunchFat,
            dinnerCarbs: initialLog.dinnerCarbs,
            dinnerProtein: initialLog.dinnerProtein,
            dinnerFat: initialLog.dinnerFat,
            snack: initialLog.snack,
            summary: initialLog.summary,
            feedback: initialLog.feedback,
            exercises: initialLog.exercises.map((exercise) => ({
              name: exercise.name,
              sets: exercise.sets.map((set) => ({
                weight: set.weight,
                reps: set.reps,
              })),
            })),
          });
          setDraftStatus('자동 저장 켜짐');
        } else {
          reset();
          setDraftStatus('자동 저장 켜짐');
        }
        setDraftReady(true);
      } catch (error) {
        console.error('운동일지 임시저장 불러오기 실패', error);
        if (!cancelled) {
          if (initialLog) {
            applyInput({
              memberId,
              scheduleId: initialLog.scheduleId,
              date: initialLog.date,
              bodyPart: initialLog.bodyPart,
              sleepQuality: initialLog.sleepQuality,
              conditionLevel: initialLog.conditionLevel,
              activityLevel: initialLog.activityLevel,
              dietControl: initialLog.dietControl,
              hydration: initialLog.hydration,
              cardioTreadmill: initialLog.cardioTreadmill,
              cardioBike: initialLog.cardioBike,
              cardioStepmill: initialLog.cardioStepmill,
              breakfastCarbs: initialLog.breakfastCarbs,
              breakfastProtein: initialLog.breakfastProtein,
              breakfastFat: initialLog.breakfastFat,
              lunchCarbs: initialLog.lunchCarbs,
              lunchProtein: initialLog.lunchProtein,
              lunchFat: initialLog.lunchFat,
              dinnerCarbs: initialLog.dinnerCarbs,
              dinnerProtein: initialLog.dinnerProtein,
              dinnerFat: initialLog.dinnerFat,
              snack: initialLog.snack,
              summary: initialLog.summary,
              feedback: initialLog.feedback,
              exercises: initialLog.exercises.map((exercise) => ({
                name: exercise.name,
                sets: exercise.sets.map((set) => ({
                  weight: set.weight,
                  reps: set.reps,
                })),
              })),
            });
          } else {
            reset();
          }
          setDraftStatus('자동 저장 다시 시도');
          setDraftReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, draftKey, visible]);

  useEffect(() => {
    if (!visible || !draftReady || saving) return;

    setDraftStatus('입력 중');
    const timer = setTimeout(() => {
      const input = buildInput();
      void saveTrainingLogDraft(db, draftKey, memberId, input)
        .then(() => setDraftStatus('자동 저장됨'))
        .catch((error) => {
          console.error('운동일지 자동저장 실패', error);
          setDraftStatus('자동 저장 실패');
        });
    }, 500);

    return () => clearTimeout(timer);
  }, [
    activityLevel,
    bodyPart,
    breakfastCarbs,
    breakfastFat,
    breakfastProtein,
    cardioBike,
    cardioStepmill,
    cardioTreadmill,
    conditionLevel,
    db,
    dietControl,
    dinnerCarbs,
    dinnerFat,
    dinnerProtein,
    draftKey,
    draftReady,
    exercises,
    feedback,
    hydration,
    logDate,
    lunchCarbs,
    lunchFat,
    lunchProtein,
    memberId,
    saving,
    sleepQuality,
    snack,
    summary,
    visible,
  ]);

  const close = () => {
    if (saving) return;
    if (draftReady) {
      void saveTrainingLogDraft(db, draftKey, memberId, buildInput()).catch((error) => {
        console.error('운동일지 닫기 전 임시저장 실패', error);
      });
    }
    onClose();
  };

  const updateExerciseName = (index: number, value: string) => {
    setExercises((current) =>
      current.map((exercise, exerciseIndex) =>
        exerciseIndex === index ? { ...exercise, name: value } : exercise,
      ),
    );
  };

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: 'weight' | 'reps',
    value: string,
  ) => {
    setExercises((current) =>
      current.map((exercise, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((set, currentSetIndex) =>
            currentSetIndex === setIndex ? { ...set, [field]: value } : set,
          ),
        };
      }),
    );
  };

  const addSet = (exerciseIndex: number) => {
    setExercises((current) =>
      current.map((exercise, index) =>
        index === exerciseIndex && exercise.sets.length < 7
          ? { ...exercise, sets: [...exercise.sets, { weight: '', reps: '' }] }
          : exercise,
      ),
    );
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setExercises((current) =>
      current.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        if (exercise.sets.length <= 1) {
          return { ...exercise, sets: [{ weight: '', reps: '' }] };
        }
        return {
          ...exercise,
          sets: exercise.sets.filter((_, currentSetIndex) => currentSetIndex !== setIndex),
        };
      }),
    );
  };

  const removeExercise = (exerciseIndex: number) => {
    setExercises((current) =>
      current.length === 1
        ? [emptyExercise()]
        : current.filter((_, index) => index !== exerciseIndex),
    );
  };

  const applyRoutine = (log: TrainingLogItem) => {
    setBodyPart(log.bodyPart ?? '');
    setExercises(
      log.exercises.length > 0
        ? log.exercises.map((exercise) => ({
            name: exercise.name,
            sets: exercise.sets.length > 0
              ? exercise.sets.map((set) => ({
                  weight: set.weight === null ? '' : String(set.weight),
                  reps: set.reps === null ? '' : String(set.reps),
                }))
              : [{ weight: '', reps: '' }],
          }))
        : [emptyExercise()],
    );
    setSelectedRoutine(null);
    setRoutinePickerOpen(false);
  };

  const moveExercise = (from: number, to: number) => {
    if (to < 0 || to >= exercises.length || from === to) return;
    setExercises((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggingIndex(to);
  };

  const submit = () => {
    onSubmit(buildInput());
  };

  const LevelPicker = ({
    value,
    onChange,
  }: {
    value: WellnessLevel;
    onChange: (value: WellnessLevel) => void;
  }) => (
    <View style={styles.levelRow}>
      {LEVELS.map((level) => (
        <Pressable
          key={level}
          style={[
            styles.levelButton,
            isTablet && styles.levelButtonTablet,
            value === level && styles.levelButtonActive,
          ]}
          onPress={() => onChange(level)}
        >
          <Text style={[styles.levelText, value === level && styles.levelTextActive]}>
            {level}
          </Text>
        </Pressable>
      ))}
    </View>
  );


  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <Pressable onPress={close} hitSlop={10}>
              <Text style={styles.headerAction}>취소</Text>
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{initialLog ? '운동일지 수정' : '운동일지'}</Text>
              <Text style={styles.headerSub}>{memberName} · {draftStatus}</Text>
            </View>
            <Pressable onPress={submit} disabled={saving} hitSlop={10}>
              <Text style={[styles.headerSave, saving && styles.disabled]}>
                {saving ? '저장중' : initialLog ? '수정완료' : '저장'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.content,
              isTablet && styles.contentTablet,
              isTabletLandscape && styles.contentTabletLandscape,
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.card, isTablet && styles.cardTablet,
              isTabletLandscape && styles.cardTabletLandscape,
            ]}>
              <Text style={styles.sectionTitle}>기본 정보</Text>
              <View style={styles.twoColumn}>
                <Pressable
                  style={[styles.input, styles.flexInput, styles.dateButton, isTablet && styles.inputTablet]}
                  onPress={() => setDatePickerOpen(true)}
                >
                  <Text style={styles.dateButtonText}>{logDate}</Text>
                  <Text style={styles.dateButtonHint}>달력 ›</Text>
                </Pressable>
                <TextInput
                  value={bodyPart}
                  onChangeText={setBodyPart}
                  placeholder="운동부위"
                  placeholderTextColor="#A2A8B2"
                  style={[
                    styles.input,
                    styles.flexInput,
                    isTablet && styles.inputTablet,
                  ]}
                />
              </View>
            </View>

            <View style={[styles.card, isTablet && styles.cardTablet, isTabletLandscape && styles.cardTabletLandscape]}>
              <Text style={styles.sectionTitle}>오늘의 진단</Text>
              <Text style={styles.label}>숙면</Text>
              <LevelPicker value={sleepQuality} onChange={setSleepQuality} />
              <Text style={styles.label}>컨디션</Text>
              <LevelPicker value={conditionLevel} onChange={setConditionLevel} />
              <Text style={styles.label}>활동강도</Text>
              <LevelPicker value={activityLevel} onChange={setActivityLevel} />
              <View style={styles.switchLine}>
                <Text style={styles.switchLabel}>식이조절</Text>
                <Switch value={dietControl} onValueChange={setDietControl} />
              </View>
              <View style={styles.switchLine}>
                <Text style={styles.switchLabel}>수분 섭취</Text>
                <Switch value={hydration} onValueChange={setHydration} />
              </View>
            </View>

            <View style={[styles.card, isTablet && styles.cardTablet, isTabletLandscape && styles.cardTabletLandscape]}>
              <Text style={styles.sectionTitle}>유산소</Text>
              <View style={styles.threeColumn}>
                <TextInput
                  value={cardioTreadmill}
                  onChangeText={setCardioTreadmill}
                  placeholder="트레드밀"
                  placeholderTextColor="#A2A8B2"
                  style={[
                    styles.input,
                    styles.flexInput,
                    isTablet && styles.inputTablet,
                  ]}
                />
                <TextInput
                  value={cardioBike}
                  onChangeText={setCardioBike}
                  placeholder="싸이클"
                  placeholderTextColor="#A2A8B2"
                  style={[
                    styles.input,
                    styles.flexInput,
                    isTablet && styles.inputTablet,
                  ]}
                />
                <TextInput
                  value={cardioStepmill}
                  onChangeText={setCardioStepmill}
                  placeholder="스텝밀"
                  placeholderTextColor="#A2A8B2"
                  style={[
                    styles.input,
                    styles.flexInput,
                    isTablet && styles.inputTablet,
                  ]}
                />
              </View>
            </View>

            <View style={[styles.card, isTablet && styles.cardTablet, isTabletLandscape && styles.cardTabletLandscape]}>
              <View style={styles.planHeaderRow}>
                <View style={styles.planHeaderText}>
                  <Text style={styles.sectionTitle}>수업 계획 도우미</Text>
                  <Text style={styles.planSubText}>최근 운동기록과 컨디션을 바탕으로 참고용 제안을 보여줘요.</Text>
                </View>
                {latestHistoryLog ? (
                  <Pressable style={styles.loadRoutineButton} onPress={() => setRoutinePickerOpen(true)}>
                    <Text style={styles.loadRoutineButtonText}>최근 루틴 불러오기</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.planCard}>
                <Text style={styles.planLabel}>오늘 볼륨 제안</Text>
                <Text style={styles.planText}>{planText}</Text>
                {latestHistoryLog ? (
                  <Text style={styles.planHistory}>
                    최근 {latestHistoryLog.date.replaceAll('-', '.')} · {latestHistoryLog.bodyPart || '부위 미입력'} · 총 {formatVolume(trainingLogVolume(latestHistoryLog))}kg
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={[styles.card, isTablet && styles.cardTablet, isTabletLandscape && styles.cardTabletLandscape]}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>웨이트 트레이닝</Text>
                  <Text style={styles.totalVolumeText}>
                    오늘 총 볼륨 {formatVolume(totalVolume)}kg
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    exercises.length < 8 &&
                    setExercises((current) => [...current, emptyExercise()])
                  }
                >
                  <Text style={styles.addText}>+ 운동 추가</Text>
                </Pressable>
              </View>

              {isTabletLandscape ? (
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View style={styles.sheet}>
                    <View style={styles.sheetHeaderRow}>
                      <Text style={styles.sheetExerciseHeader}>운동명</Text>
                      {Array.from({ length: Math.max(4, ...exercises.map((item) => item.sets.length)) }, (_, index) => (
                        <Text key={index} style={styles.sheetSetHeader}>{index + 1}세트</Text>
                      ))}
                      <Text style={styles.sheetActionHeader}>관리</Text>
                    </View>
                    {exercises.map((exercise, exerciseIndex) => (
                      <View
                        key={exerciseIndex}
                        style={[styles.sheetRow, draggingIndex === exerciseIndex && styles.exerciseCardDragging]}
                        onTouchMove={(event) => {
                          if (draggingIndex !== exerciseIndex) return;
                          const y = event.nativeEvent.locationY;
                          if (y < 12) moveExercise(exerciseIndex, exerciseIndex - 1);
                          else if (y > 64) moveExercise(exerciseIndex, exerciseIndex + 1);
                        }}
                        onTouchEnd={() => setDraggingIndex(null)}
                      >
                        <TextInput
                          value={exercise.name}
                          onChangeText={(value) => updateExerciseName(exerciseIndex, value)}
                          placeholder={`운동 ${exerciseIndex + 1}`}
                          placeholderTextColor="#A2A8B2"
                          style={styles.sheetExerciseInput}
                        />
                        {Array.from({ length: Math.max(4, ...exercises.map((item) => item.sets.length)) }, (_, setIndex) => {
                          const set = exercise.sets[setIndex];
                          return (
                            <View key={setIndex} style={styles.sheetSetCell}>
                              {set ? (
                                <>
                                  <TextInput value={set.weight} onChangeText={(value) => updateSet(exerciseIndex, setIndex, 'weight', value)} placeholder="kg" placeholderTextColor="#A2A8B2" keyboardType="decimal-pad" style={styles.sheetMiniInput} />
                                  <TextInput value={set.reps} onChangeText={(value) => updateSet(exerciseIndex, setIndex, 'reps', value)} placeholder="회" placeholderTextColor="#A2A8B2" keyboardType="number-pad" style={styles.sheetMiniInput} />
                                </>
                              ) : (
                                <Pressable style={styles.sheetAddSet} onPress={() => addSet(exerciseIndex)}>
                                  <Text style={styles.sheetAddSetText}>+</Text>
                                </Pressable>
                              )}
                            </View>
                          );
                        })}
                        <View style={styles.sheetActions}>
                          <Pressable style={styles.dragHandle} delayLongPress={250} onLongPress={() => setDraggingIndex(exerciseIndex)} onPress={() => setDraggingIndex(null)}>
                            <Text style={styles.dragHandleText}>≡</Text>
                          </Pressable>
                          <Pressable onPress={() => removeExercise(exerciseIndex)}><Text style={styles.removeText}>삭제</Text></Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                exercises.map((exercise, exerciseIndex) => (
                <View
                  key={exerciseIndex}
                  style={[styles.exerciseCard, draggingIndex === exerciseIndex && styles.exerciseCardDragging]}
                  onTouchMove={(event) => {
                    if (draggingIndex !== exerciseIndex) return;
                    const y = event.nativeEvent.locationY;
                    if (y < 18) moveExercise(exerciseIndex, exerciseIndex - 1);
                    else if (y > 150) moveExercise(exerciseIndex, exerciseIndex + 1);
                  }}
                  onTouchEnd={() => setDraggingIndex(null)}
                >
                  <View style={styles.exerciseTitleRow}>
                    <TextInput
                      value={exercise.name}
                      onChangeText={(value) => updateExerciseName(exerciseIndex, value)}
                      placeholder={`운동 ${exerciseIndex + 1} 이름`}
                      placeholderTextColor="#A2A8B2"
                      style={[
                        styles.exerciseName,
                        isTablet && styles.exerciseNameTablet,
                      ]}
                    />
                    <View style={styles.exerciseActions}>
                      <Pressable
                        style={styles.dragHandle}
                        delayLongPress={250}
                        onLongPress={() => setDraggingIndex(exerciseIndex)}
                        onPressOut={() => setDraggingIndex(null)}
                        hitSlop={10}
                      >
                        <Text style={styles.dragHandleText}>≡</Text>
                      </Pressable>
                      <Pressable onPress={() => removeExercise(exerciseIndex)} hitSlop={8}>
                        <Text style={styles.removeText}>삭제</Text>
                      </Pressable>
                    </View>
                  </View>
                  {exercise.sets.map((set, setIndex) => (
                    <View key={setIndex} style={styles.setRow}>
                      <Text style={styles.setNumber}>{setIndex + 1}set</Text>
                      <TextInput
                        value={set.weight}
                        onChangeText={(value) =>
                          updateSet(exerciseIndex, setIndex, 'weight', value)
                        }
                        placeholder="무게"
                        placeholderTextColor="#A2A8B2"
                        keyboardType="decimal-pad"
                        style={[styles.setInput, isTablet && styles.setInputTablet]}
                      />
                      <TextInput
                        value={set.reps}
                        onChangeText={(value) =>
                          updateSet(exerciseIndex, setIndex, 'reps', value)
                        }
                        placeholder="횟수"
                        placeholderTextColor="#A2A8B2"
                        keyboardType="number-pad"
                        style={[styles.setInput, isTablet && styles.setInputTablet]}
                      />
                      <Pressable
                        accessibilityLabel={`${setIndex + 1}세트 삭제`}
                        style={[
                          styles.removeSetButton,
                          exercise.sets.length <= 1 && styles.removeSetButtonDisabled,
                        ]}
                        onPress={() => removeSet(exerciseIndex, setIndex)}
                        disabled={exercise.sets.length <= 1}
                        hitSlop={6}
                      >
                        <Text
                          style={[
                            styles.removeSetText,
                            exercise.sets.length <= 1 && styles.removeSetTextDisabled,
                          ]}
                        >
                          삭제
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                  <View style={styles.exerciseVolumeRow}>
                    <Text style={styles.exerciseVolumeLabel}>종목 총 볼륨</Text>
                    <Text style={styles.exerciseVolumeValue}>
                      {formatVolume(editableExerciseVolume(exercise))}kg
                    </Text>
                  </View>
                  {exercise.sets.length < 7 ? (
                    <Pressable
                      style={styles.addSetButton}
                      onPress={() => addSet(exerciseIndex)}
                    >
                      <Text style={styles.addSetText}>+ 세트 추가</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
              )}
            </View>

            <View style={[styles.card, isTablet && styles.cardTablet, isTabletLandscape && styles.cardTabletLandscape]}>
              <Text style={styles.sectionTitle}>오늘의 식단</Text>
              <MealRow
                title="아침"
                carbs={breakfastCarbs}
                onCarbs={setBreakfastCarbs}
                protein={breakfastProtein}
                onProtein={setBreakfastProtein}
                fat={breakfastFat}
                onFat={setBreakfastFat}
                isTablet={isTablet}
              />
              <MealRow
                title="점심"
                carbs={lunchCarbs}
                onCarbs={setLunchCarbs}
                protein={lunchProtein}
                onProtein={setLunchProtein}
                fat={lunchFat}
                onFat={setLunchFat}
                isTablet={isTablet}
              />
              <MealRow
                title="저녁"
                carbs={dinnerCarbs}
                onCarbs={setDinnerCarbs}
                protein={dinnerProtein}
                onProtein={setDinnerProtein}
                fat={dinnerFat}
                onFat={setDinnerFat}
                isTablet={isTablet}
              />
              <TextInput
                value={snack}
                onChangeText={setSnack}
                placeholder="간식"
                placeholderTextColor="#A2A8B2"
                style={[styles.input, isTablet && styles.inputTablet]}
              />
            </View>

            <View style={[styles.card, isTablet && styles.cardTablet, isTabletLandscape && styles.cardTabletLandscape]}>
              <Text style={styles.sectionTitle}>트레이너 기록</Text>
              <TextInput
                value={summary}
                onChangeText={setSummary}
                placeholder="한줄평"
                placeholderTextColor="#A2A8B2"
                style={styles.input}
              />
              <TextInput
                value={feedback}
                onChangeText={setFeedback}
                placeholder="회원 피드백 / 다음 수업 참고사항"
                placeholderTextColor="#A2A8B2"
                style={[
                  styles.feedbackInput,
                  isTablet && styles.feedbackInputTablet,
                ]}
                multiline
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SimpleDatePickerModal
        visible={datePickerOpen}
        title="운동일지 날짜 선택"
        selectedDate={logDate}
        onClose={() => setDatePickerOpen(false)}
        onSelect={setLogDate}
      />

      <Modal visible={routinePickerOpen} transparent animationType="fade" onRequestClose={() => setRoutinePickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setRoutinePickerOpen(false)}>
          <Pressable style={styles.routineModal} onPress={() => undefined}>
            <Text style={styles.routineModalTitle}>최근 루틴 선택</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {routineParts.map((part) => (
                <Pressable key={part} style={[styles.filterChip, routineFilter === part && styles.filterChipActive]} onPress={() => setRoutineFilter(part)}>
                  <Text style={[styles.filterChipText, routineFilter === part && styles.filterChipTextActive]}>{part}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView style={styles.routineList}>
              {filteredRoutineLogs.map((log) => {
                const first = log.exercises[0]?.name ?? '운동 기록';
                const extra = Math.max(0, log.exercises.length - 1);
                return (
                  <Pressable key={log.id} style={[styles.routineRow, selectedRoutine?.id === log.id && styles.routineRowActive]} onPress={() => setSelectedRoutine(log)}>
                    <Text style={styles.routineRowTitle}>{log.date.slice(5).replace('-', '/')} · {log.bodyPart || '전체'} · {first}{extra > 0 ? ` 외 ${extra}종목` : ''}</Text>
                    {selectedRoutine?.id === log.id ? (
                      <View style={styles.routineDetail}>
                        {log.exercises.map((exercise) => <Text key={exercise.id} style={styles.routineExercise}>• {exercise.name} · {exercise.sets.length}세트</Text>)}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.routineModalActions}>
              <Pressable style={styles.todayButton} onPress={() => { setLogDate(new Date().toLocaleDateString('sv-SE')); setDatePickerOpen(false); }}>
                <Text style={styles.todayButtonText}>오늘</Text>
              </Pressable>
              <Pressable style={[styles.useRoutineButton, !selectedRoutine && styles.disabled]} disabled={!selectedRoutine} onPress={() => selectedRoutine && applyRoutine(selectedRoutine)}>
                <Text style={styles.useRoutineButtonText}>이 루틴 불러오기</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F7F9' },
  flex: { flex: 1 },
  header: {
    height: 60,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E5EA',
    backgroundColor: '#FFFFFF',
  },
  headerTablet: {
    height: 72,
    paddingHorizontal: 28,
  },
  headerAction: { width: 54, fontSize: 15, color: '#68707D' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#20242B' },
  headerSub: { marginTop: 1, fontSize: 10, color: '#8A919C' },
  headerSave: {
    width: 54,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '900',
    color: '#4B68FF',
  },
  disabled: { opacity: 0.45 },
  content: { padding: 14, paddingBottom: 32, gap: 10 },
  contentTablet: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 44,
    gap: 14,
  },
  contentTabletLandscape: {
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 8,
  },
  card: { padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF' },
  cardTablet: {
    padding: 20,
    borderRadius: 22,
  },
  cardTabletLandscape: {
    padding: 14,
    borderRadius: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#252A32' },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  planHeaderText: { flex: 1, minWidth: 0 },
  planSubText: { marginTop: 4, fontSize: 10, lineHeight: 14, color: '#8A919C' },
  loadRoutineButton: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF1FF',
  },
  loadRoutineButtonText: { fontSize: 10, fontWeight: '900', color: '#4B68FF' },
  planCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 13,
    backgroundColor: '#F6F8FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE2FF',
  },
  planLabel: { fontSize: 10, fontWeight: '900', color: '#5968B5' },
  planText: { marginTop: 5, fontSize: 12, lineHeight: 18, color: '#3E4652' },
  planHistory: { marginTop: 7, fontSize: 10, fontWeight: '700', color: '#858C98' },
  label: { marginTop: 12, marginBottom: 6, fontSize: 11, fontWeight: '800', color: '#737B87' },
  input: {
    minHeight: 44,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F3F5F8',
    fontSize: 13,
    color: '#252A32',
  },
  inputTablet: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 14,
    fontSize: 16,
  },
  flexInput: { flex: 1, minWidth: 0 },
  twoColumn: { flexDirection: 'row', gap: 8 },
  threeColumn: { flexDirection: 'row', gap: 7 },
  levelRow: { flexDirection: 'row', gap: 6 },
  levelButton: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF0F3',
  },
  levelButtonTablet: {
    height: 44,
    borderRadius: 12,
  },
  levelButtonActive: { backgroundColor: '#E9EDFF' },
  levelText: { fontSize: 12, fontWeight: '800', color: '#7D8490' },
  levelTextActive: { color: '#4B68FF' },
  switchLine: {
    minHeight: 44,
    marginTop: 8,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: { fontSize: 13, fontWeight: '800', color: '#4F5661' },
  addText: { fontSize: 12, fontWeight: '900', color: '#4B68FF' },
  totalVolumeText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '900',
    color: '#2D7A57',
  },
  exerciseCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 13,
    backgroundColor: '#F6F7F9',
  },
  exerciseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseName: {
    flex: 1,
    height: 40,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    color: '#252A32',
  },
  exerciseNameTablet: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 12,
    fontSize: 15,
  },
  removeText: { fontSize: 11, fontWeight: '800', color: '#D64B5B' },
  setRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setNumber: { width: 34, fontSize: 10, fontWeight: '800', color: '#858C96' },
  setInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    fontSize: 12,
    color: '#252A32',
  },
  setInputTablet: {
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 11,
    fontSize: 14,
  },
  removeSetButton: {
    minWidth: 42,
    height: 36,
    paddingHorizontal: 6,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F2',
  },
  removeSetButtonDisabled: {
    backgroundColor: '#ECEFF3',
  },
  removeSetText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D64B5B',
  },
  removeSetTextDisabled: {
    color: '#B2B8C2',
  },
  exerciseVolumeRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDE1E7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseVolumeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#747C88',
  },
  exerciseVolumeValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#2D7A57',
  },
  addSetButton: { marginTop: 8, alignSelf: 'flex-start' },
  addSetText: { fontSize: 11, fontWeight: '800', color: '#5968B5' },
  mealCard: {
    marginTop: 9,
    padding: 9,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
  },
  mealTitle: { fontSize: 12, fontWeight: '900', color: '#4B5260' },
  smallInput: {
    minHeight: 36,
    marginTop: 5,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    fontSize: 12,
    color: '#252A32',
  },
  smallInputTablet: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    fontSize: 14,
  },
  feedbackInput: {
    minHeight: 88,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F3F5F8',
    fontSize: 13,
    color: '#252A32',
  },
  feedbackInputTablet: {
    minHeight: 124,
    padding: 16,
    borderRadius: 14,
    fontSize: 15,
  },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateButtonText: { fontSize: 14, color: '#252A32', fontWeight: '800' },
  dateButtonHint: { fontSize: 11, color: '#6C78B8' },
  exerciseActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dragHandle: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EEF1F6' },
  dragHandleText: { fontSize: 24, lineHeight: 25, fontWeight: '900', color: '#6B7380' },
  exerciseCardDragging: { opacity: 0.72, transform: [{ scale: 1.01 }], borderWidth: 2, borderColor: '#7085FF' },
  modalBackdrop: { flex: 1, padding: 18, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  routineModal: { maxHeight: '82%', padding: 18, borderRadius: 22, backgroundColor: '#FFFFFF' },
  routineModalTitle: { fontSize: 18, fontWeight: '900', color: '#20242B' },
  filterRow: { gap: 7, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 13, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F2F6' },
  filterChipActive: { backgroundColor: '#4B68FF' },
  filterChipText: { fontSize: 11, fontWeight: '800', color: '#68707D' },
  filterChipTextActive: { color: '#FFFFFF' },
  routineList: { maxHeight: 430 },
  routineRow: { padding: 13, marginBottom: 8, borderRadius: 14, borderWidth: 1, borderColor: '#E3E6EB', backgroundColor: '#FAFBFC' },
  routineRowActive: { borderColor: '#7286FF', backgroundColor: '#F3F5FF' },
  routineRowTitle: { fontSize: 12, fontWeight: '900', color: '#303640' },
  routineDetail: { marginTop: 8, gap: 4 },
  routineExercise: { fontSize: 11, color: '#69717D' },
  routineModalActions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  todayButton: { minWidth: 70, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1F6' },
  todayButtonText: { fontSize: 12, fontWeight: '900', color: '#555E6B' },
  useRoutineButton: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4B68FF' },
  useRoutineButtonText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },

  sheet: { minWidth: '100%', marginTop: 14, borderWidth: 1, borderColor: '#E1E5EB', borderRadius: 14, overflow: 'hidden' },
  sheetHeaderRow: { flexDirection: 'row', minHeight: 38, alignItems: 'center', backgroundColor: '#F0F2F6' },
  sheetExerciseHeader: { width: 210, paddingHorizontal: 10, fontSize: 11, fontWeight: '900', color: '#505866' },
  sheetSetHeader: { width: 118, textAlign: 'center', fontSize: 11, fontWeight: '900', color: '#505866' },
  sheetActionHeader: { width: 92, textAlign: 'center', fontSize: 11, fontWeight: '900', color: '#505866' },
  sheetRow: { flexDirection: 'row', minHeight: 76, alignItems: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E1E5EB', backgroundColor: '#FFFFFF' },
  sheetExerciseInput: { width: 210, paddingHorizontal: 10, fontSize: 14, fontWeight: '800', color: '#252A32', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#E1E5EB' },
  sheetSetCell: { width: 118, padding: 6, gap: 4, justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#E1E5EB' },
  sheetMiniInput: { height: 29, paddingHorizontal: 7, borderRadius: 7, backgroundColor: '#F4F6F8', fontSize: 11, textAlign: 'center', color: '#252A32' },
  sheetAddSet: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sheetAddSetText: { fontSize: 22, fontWeight: '700', color: '#6D7BD0' },
  sheetActions: { width: 92, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },

});
