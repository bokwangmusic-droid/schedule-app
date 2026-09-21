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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  CreateTrainingLogInput,
  TrainingExerciseInput,
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

export function TrainingLogModal({
  visible,
  memberId,
  memberName,
  date,
  scheduleId = null,
  saving = false,
  onClose,
  onSubmit,
}: Props) {
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

  useEffect(() => {
    if (!visible) return;
    setLogDate(date);
  }, [date, visible]);

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

  const removeExercise = (exerciseIndex: number) => {
    setExercises((current) =>
      current.length === 1
        ? [emptyExercise()]
        : current.filter((_, index) => index !== exerciseIndex),
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
          style={[styles.levelButton, value === level && styles.levelButtonActive]}
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
        style={styles.smallInput}
      />
      <TextInput
        value={protein}
        onChangeText={onProtein}
        placeholder="단백질"
        placeholderTextColor="#A2A8B2"
        style={styles.smallInput}
      />
      <TextInput
        value={fat}
        onChangeText={onFat}
        placeholder="지방"
        placeholderTextColor="#A2A8B2"
        style={styles.smallInput}
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
          <View style={styles.header}>
            <Pressable onPress={close} hitSlop={10}>
              <Text style={styles.headerAction}>취소</Text>
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>운동일지</Text>
              <Text style={styles.headerSub}>{memberName}</Text>
            </View>
            <Pressable onPress={submit} disabled={saving} hitSlop={10}>
              <Text style={[styles.headerSave, saving && styles.disabled]}>
                {saving ? '저장중' : '저장'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>기본 정보</Text>
              <View style={styles.twoColumn}>
                <TextInput
                  value={logDate}
                  onChangeText={setLogDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#A2A8B2"
                  style={[styles.input, styles.flexInput]}
                />
                <TextInput
                  value={bodyPart}
                  onChangeText={setBodyPart}
                  placeholder="운동부위"
                  placeholderTextColor="#A2A8B2"
                  style={[styles.input, styles.flexInput]}
                />
              </View>
            </View>

            <View style={styles.card}>
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

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>유산소</Text>
              <View style={styles.threeColumn}>
                <TextInput
                  value={cardioTreadmill}
                  onChangeText={setCardioTreadmill}
                  placeholder="트레드밀"
                  placeholderTextColor="#A2A8B2"
                  style={[styles.input, styles.flexInput]}
                />
                <TextInput
                  value={cardioBike}
                  onChangeText={setCardioBike}
                  placeholder="싸이클"
                  placeholderTextColor="#A2A8B2"
                  style={[styles.input, styles.flexInput]}
                />
                <TextInput
                  value={cardioStepmill}
                  onChangeText={setCardioStepmill}
                  placeholder="스텝밀"
                  placeholderTextColor="#A2A8B2"
                  style={[styles.input, styles.flexInput]}
                />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>웨이트 트레이닝</Text>
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
                      style={styles.exerciseName}
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
                        style={styles.setInput}
                      />
                      <TextInput
                        value={set.reps}
                        onChangeText={(value) =>
                          updateSet(exerciseIndex, setIndex, 'reps', value)
                        }
                        placeholder="횟수"
                        placeholderTextColor="#A2A8B2"
                        keyboardType="number-pad"
                        style={styles.setInput}
                      />
                    </View>
                  ))}
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

            <View style={styles.card}>
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
                style={styles.input}
              />
            </View>

            <View style={styles.card}>
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
                style={styles.feedbackInput}
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
  card: { padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF' },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#252A32' },
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
  feedbackInput: {
    minHeight: 88,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F3F5F8',
    fontSize: 13,
    color: '#252A32',
  },
});
