import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createProgram, deleteProgram, listPrograms, moveProgram, type ProgramDefinition, type ProgramTrackingMode } from '../src/data/programRepository';

export default function ProgramSettingsScreen() {
  const db = useSQLiteContext();
  const [programs, setPrograms] = useState<ProgramDefinition[]>([]);
  const [category, setCategory] = useState('헬스');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<ProgramTrackingMode>('duration');
  const [value, setValue] = useState('');

  const load = useCallback(async () => setPrograms(await listPrograms(db)), [db]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const add = async () => {
    const amount = Number(value);
    if (!category.trim() || !name.trim() || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert('프로그램 정보를 확인해 주세요.', mode === 'duration' ? '이름과 이용 개월 수를 입력해 주세요.' : '이름과 이용 횟수를 입력해 주세요.');
      return;
    }
    await createProgram(db, {
      category,
      name,
      trackingMode: mode,
      durationMonths: mode === 'duration' ? amount : null,
      sessionCount: mode === 'sessions' ? amount : null,
    });
    setName('');
    setValue('');
    await load();
  };

  const remove = (program: ProgramDefinition) => {
    Alert.alert('프로그램 삭제', `${program.name}을(를) 목록에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void (async () => { await deleteProgram(db, program.id); await load(); })() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ 뒤로</Text></Pressable>
        <Text style={styles.title}>프로그램 설정</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>센터 프로그램 추가</Text>
          <Text style={styles.help}>센터마다 다른 회원권 · PT · GX 상품을 직접 만들어 회원 등록에 사용할 수 있어요.</Text>
          <TextInput value={category} onChangeText={setCategory} placeholder="분류 예: 헬스, PT, GX" style={styles.input} />
          <TextInput value={name} onChangeText={setName} placeholder="프로그램명 예: PT 20회" style={styles.input} />
          <View style={styles.modeRow}>
            <Pressable style={[styles.mode, mode === 'duration' && styles.modeActive]} onPress={() => setMode('duration')}><Text style={[styles.modeText, mode === 'duration' && styles.modeTextActive]}>기간형</Text></Pressable>
            <Pressable style={[styles.mode, mode === 'sessions' && styles.modeActive]} onPress={() => setMode('sessions')}><Text style={[styles.modeText, mode === 'sessions' && styles.modeTextActive]}>횟수형</Text></Pressable>
          </View>
          <TextInput value={value} onChangeText={setValue} keyboardType="number-pad" placeholder={mode === 'duration' ? '이용 개월 수' : '이용 횟수'} style={styles.input} />
          <Pressable style={styles.addButton} onPress={() => void add()}><Text style={styles.addText}>+ 프로그램 추가</Text></Pressable>
        </View>

        <Text style={styles.sectionTitle}>사용 프로그램</Text>
        {programs.map((program, index) => (
          <View key={program.id} style={styles.program}>
            <View style={styles.programInfo}>
              <Text style={styles.category}>{program.category}</Text>
              <Text style={styles.programName}>{program.name}</Text>
              <Text style={styles.programMeta}>{program.trackingMode === 'duration' ? `${program.durationMonths}개월` : `${program.sessionCount}회`}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable disabled={index === 0} style={[styles.order, index === 0 && styles.disabled]} onPress={() => void (async () => { await moveProgram(db, programs, index, -1); await load(); })()}><Text style={styles.orderText}>▲</Text></Pressable>
              <Pressable disabled={index === programs.length - 1} style={[styles.order, index === programs.length - 1 && styles.disabled]} onPress={() => void (async () => { await moveProgram(db, programs, index, 1); await load(); })()}><Text style={styles.orderText}>▼</Text></Pressable>
              <Pressable onPress={() => remove(program)}><Text style={styles.delete}>삭제</Text></Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { height: 60, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E5EA' },
  back: { width: 70, fontSize: 15, fontWeight: '800', color: '#4B68FF' },
  title: { fontSize: 18, fontWeight: '900', color: '#20242B' },
  spacer: { width: 70 },
  content: { padding: 16, paddingBottom: 50 },
  card: { padding: 16, borderRadius: 18, backgroundColor: '#FFF' },
  cardTitle: { fontSize: 17, fontWeight: '900', color: '#252A32' },
  help: { marginTop: 6, marginBottom: 8, fontSize: 12, lineHeight: 18, color: '#7B8390' },
  input: { minHeight: 48, marginTop: 9, paddingHorizontal: 13, borderRadius: 12, backgroundColor: '#F3F5F8', fontSize: 14, color: '#252A32' },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  mode: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EEF0F3' },
  modeActive: { backgroundColor: '#E8EDFF' },
  modeText: { fontWeight: '800', color: '#737B87' },
  modeTextActive: { color: '#4B68FF' },
  addButton: { minHeight: 50, marginTop: 12, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4B68FF' },
  addText: { fontSize: 14, fontWeight: '900', color: '#FFF' },
  sectionTitle: { marginTop: 22, marginBottom: 9, fontSize: 16, fontWeight: '900', color: '#252A32' },
  program: { minHeight: 82, marginBottom: 8, padding: 13, borderRadius: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF' },
  programInfo: { flex: 1 },
  category: { fontSize: 10, fontWeight: '900', color: '#6676C8' },
  programName: { marginTop: 3, fontSize: 15, fontWeight: '900', color: '#252A32' },
  programMeta: { marginTop: 3, fontSize: 11, color: '#7D8490' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  order: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1FF' },
  orderText: { fontSize: 12, fontWeight: '900', color: '#4B68FF' },
  disabled: { opacity: 0.25 },
  delete: { paddingHorizontal: 4, fontSize: 11, fontWeight: '900', color: '#D64B5B' },
});
