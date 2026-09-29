import { useEffect, useState } from 'react';
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
import type {
  CreateTrainingLogInput,
  TrainingExerciseInput,
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
  if (change <= -10 && latest.conditionLevel !== '하') {
    return `최근 볼륨이 이전 평균보다 약 ${Math.abs(change).toFixed(0)}% 낮아요. 컨디션이 괜찮다면 5~10% 정도 점진적으로 올려볼 수 있어요.`;
  }
  return '최근 볼륨 변화가 크지 않아요. 수행이 안정적이고 컨디션이 좋다면 총 볼륨을 약 5% 정도만 올리는 식으로 진행해보세요.';
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
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;
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
  const historyLogs = recentLogs.filter((log) => log.id !== initialLog?.id);
  const latestHistoryLog = historyLogs[0] ?? null;
  const planText = volumePlanText(historyLogs);
  const totalVolume = exercises.reduce(
    (total, exercise) => total + editableExerciseVolume(exercise),
    0,
  );

  useEffect(() => {
    if (!visible) return;

    if (initialLog) {
      setLogDate(initialLog.date);
      setBodyPart(initialLog.bodyPart ?? '');
      setSleepQuality(initialLog.sleepQuality ?? '중');
      setConditionLevel(initialLog.conditionLevel ?? '중');
      setActivityLevel(initialLog.activityLevel ?? '중');
      setDietControl(initialLog.dietControl);
      setHydration(initialLog.hydration);
      setCardioTreadmill(initialLog.cardioTreadmill ?? '');
      setCardioBike(initialLog.cardioBike ?? '');
      setCardioStepmill(initialLog.cardioStepmill ?? '');
      setBreakfastCarbs(initialLog.breakfastCarbs ?? '');
      setBreakfastProtein(initialLog.breakfastProtein ?? '');
      setBreakfastFat(initialLog.breakfastFat ?? '');
      setLunchCarbs(initialLog.lunchCarbs ?? '');
      setLunchProtein(initialLog.lunchProtein ?? '');
      setLunchFat(initialLog.lunchFat ?? '');
      setDinnerCarbs(initialLog.dinnerCarbs ?? '');
      setDinnerProtein(initialLog.dinnerProtein ?? '');
      setDinnerFat(initialLog.dinnerFat ?? '');
      setSnack(initialLog.snack ?? '');
      setSummary(initialLog.summary ?? '');
      setFeedback(initialLog.feedback ?? '');
      setExercises(
        initialLog.exercises.length > 0
          ? initialLog.exercises.map((exercise) => ({
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
      return;
    }

    reset();
  }, [date, initialLog, visible]);

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

  const close = () => {
    if (saving) return;
    reset();
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

  const applyLatestRoutine = () => {
    if (!latestHistoryLog) return;
    setBodyPart(latestHistoryLog.bodyPart ?? '');
    setExercises(
      latestHistoryLog.exercises.length > 0
        ? latestHistoryLog.exercises.map((exercise) => ({
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

  const submit = () => {
    const exerciseInputs: TrainingExerciseInput[] = exercises
      .filter((exercise) => exercise.name.trim())
      .map((exercise) => ({
        name: exercise.name.trim(),
        sets: exercise.sets.map((set) => ({
          weight: parseOptionalNumber(set.weight),
          reps: parseOptionalNumber(set.reps),
        })),
      }));

    onSubmit({
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
      exercises: exerciseInputs,
    });
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

  const MealRow = ({
    title,
    carbs,
    onCarbs,
    protein,
    onProtein,
    fat,
    onFat,
  }: {
    title: string;
    carbs: string;
    onCarbs: (value: string) => void;
    protein: string;
    onProtein: (value: string) => void;
    fat: string;
    onFat: (value: string) => void;
  }) => (
    <View style={styles.mealCard}>
      <Text style={styles.mealTitle}>{title}</Text>
      <TextInput
        value={carbs}
        onChangeText={onCarbs}
        placeholder="탄수화물"
        placeholderTextColor="#A2A8B2"
        style={[styles.smallInput, isTablet && styles.smallInputTablet]}
      />
      <TextInput
        value={protein}
        onChangeText={onProtein}
        placeholder="단백질"
        placeholderTextColor="#A2A8B2"
        style={[styles.smallInput, isTablet && styles.smallInputTablet]}
      />
      <TextInput
        value={fat}
        onChangeText={onFat}
        placeholder="지방"
        placeholderTextColor="#A2A8B2"
        style={[styles.smallInput, isTablet && styles.smallInputTablet]}
      />
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
              <Text style={styles.headerSub}>{memberName}</Text>
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
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <Text style={styles.sectionTitle}>기본 정보</Text>
              <View style={styles.twoColumn}>
                <TextInput
                  value={logDate}
                  onChangeText={setLogDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#A2A8B2"
                  style={[
                    styles.input,
                    styles.flexInput,
                    isTablet && styles.inputTablet,
                  ]}
                />
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

            <View style={[styles.card, isTablet && styles.cardTablet]}>
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

            <View style={[styles.card, isTablet && styles.cardTablet]}>
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

            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <View style={styles.planHeaderRow}>
                <View style={styles.planHeaderText}>
                  <Text style={styles.sectionTitle}>수업 계획 도우미</Text>
                  <Text style={styles.planSubText}>최근 운동기록과 컨디션을 바탕으로 참고용 제안을 보여줘요.</Text>
                </View>
                {latestHistoryLog ? (
                  <Pressable style={styles.loadRoutineButton} onPress={applyLatestRoutine}>
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

            <View style={[styles.card, isTablet && styles.cardTablet]}>
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

              {exercises.map((exercise, exerciseIndex) => (
                <View key={exerciseIndex} style={styles.exerciseCard}>
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
                    <Pressable onPress={() => removeExercise(exerciseIndex)} hitSlop={8}>
                      <Text style={styles.removeText}>삭제</Text>
                    </Pressable>
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
              ))}
            </View>

            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <Text style={styles.sectionTitle}>오늘의 식단</Text>
              <MealRow
                title="아침"
                carbs={breakfastCarbs}
                onCarbs={setBreakfastCarbs}
                protein={breakfastProtein}
                onProtein={setBreakfastProtein}
                fat={breakfastFat}
                onFat={setBreakfastFat}
              />
              <MealRow
                title="점심"
                carbs={lunchCarbs}
                onCarbs={setLunchCarbs}
                protein={lunchProtein}
                onProtein={setLunchProtein}
                fat={lunchFat}
                onFat={setLunchFat}
              />
              <MealRow
                title="저녁"
                carbs={dinnerCarbs}
                onCarbs={setDinnerCarbs}
                protein={dinnerProtein}
                onProtein={setDinnerProtein}
                fat={dinnerFat}
                onFat={setDinnerFat}
              />
              <TextInput
                value={snack}
                onChangeText={setSnack}
                placeholder="간식"
                placeholderTextColor="#A2A8B2"
                style={[styles.input, isTablet && styles.inputTablet]}
              />
            </View>

            <View style={[styles.card, isTablet && styles.cardTablet]}>
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
  card: { padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF' },
  cardTablet: {
    padding: 20,
    borderRadius: 22,
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
});
