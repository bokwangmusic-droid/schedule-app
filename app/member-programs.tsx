import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMemberById } from '../src/data/memberRepository';
import { enrollMemberProgram, listMemberPrograms, listPrograms, removeMemberProgram, type MemberProgram, type ProgramDefinition } from '../src/data/programRepository';
import { toLocalDateString } from '../src/lib/date';

export default function MemberProgramsScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ memberId?: string }>();
  const memberId = typeof params.memberId === 'string' ? params.memberId : '';
  const [memberName, setMemberName] = useState('');
  const [programs, setPrograms] = useState<ProgramDefinition[]>([]);
  const [enrolled, setEnrolled] = useState<MemberProgram[]>([]);
  const today = useMemo(() => toLocalDateString(new Date()), []);

  const load = useCallback(async () => {
    if (!memberId) return;
    const [member, available, active] = await Promise.all([
      getMemberById(db, memberId),
      listPrograms(db),
      listMemberPrograms(db, memberId),
    ]);
    setMemberName(member?.name ?? '');
    setPrograms(available);
    setEnrolled(active);
  }, [db, memberId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const add = async (program: ProgramDefinition) => {
    await enrollMemberProgram(db, memberId, program, today);
    await load();
  };

  const remove = (program: MemberProgram) => {
    Alert.alert('이용 프로그램 삭제', `${program.programName}을(를) 이 회원에게서 제거할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void (async () => { await removeMemberProgram(db, program.id); await load(); })() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ 뒤로</Text></Pressable>
        <Text style={styles.title}>{memberName ? `${memberName} · 프로그램` : '이용 프로그램'}</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>현재 이용 중</Text>
        {enrolled.length === 0 ? <Text style={styles.empty}>아직 등록된 프로그램이 없어요.</Text> : enrolled.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.info}>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.name}>{item.programName}</Text>
              <Text style={styles.meta}>{item.trackingMode === 'duration' ? `${item.startDate} ~ ${item.endDate}` : `잔여 ${item.remainingSessions}/${item.totalSessions}회`}</Text>
            </View>
            <Pressable onPress={() => remove(item)}><Text style={styles.remove}>삭제</Text></Pressable>
          </View>
        ))}

        <Text style={styles.section}>프로그램 추가</Text>
        <Text style={styles.help}>등록일은 오늘({today})로 시작합니다. 한 회원에게 헬스 + PT + GX를 동시에 추가할 수 있어요.</Text>
        {programs.map((program) => (
          <View key={program.id} style={styles.card}>
            <View style={styles.info}>
              <Text style={styles.category}>{program.category}</Text>
              <Text style={styles.name}>{program.name}</Text>
              <Text style={styles.meta}>{program.trackingMode === 'duration' ? `${program.durationMonths}개월` : `${program.sessionCount}회`}</Text>
            </View>
            <Pressable style={styles.add} onPress={() => void add(program)}><Text style={styles.addText}>+ 추가</Text></Pressable>
          </View>
        ))}
        <Pressable style={styles.settings} onPress={() => router.push('/program-settings' as never)}>
          <Text style={styles.settingsText}>센터 프로그램 설정으로 이동 ›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { height: 60, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E5EA' },
  back: { width: 70, fontSize: 15, fontWeight: '800', color: '#4B68FF' },
  title: { fontSize: 17, fontWeight: '900', color: '#20242B' },
  spacer: { width: 70 },
  content: { padding: 16, paddingBottom: 50 },
  section: { marginTop: 8, marginBottom: 9, fontSize: 17, fontWeight: '900', color: '#252A32' },
  help: { marginBottom: 9, fontSize: 11, lineHeight: 17, color: '#7C8490' },
  empty: { padding: 18, borderRadius: 14, backgroundColor: '#FFF', color: '#8A919D' },
  card: { minHeight: 78, marginBottom: 8, padding: 13, borderRadius: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF' },
  info: { flex: 1 },
  category: { fontSize: 10, fontWeight: '900', color: '#6676C8' },
  name: { marginTop: 3, fontSize: 15, fontWeight: '900', color: '#252A32' },
  meta: { marginTop: 4, fontSize: 11, color: '#7D8490' },
  add: { minWidth: 66, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1FF' },
  addText: { fontSize: 12, fontWeight: '900', color: '#4B68FF' },
  remove: { padding: 8, fontSize: 11, fontWeight: '900', color: '#D64B5B' },
  settings: { marginTop: 14, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8EDFF' },
  settingsText: { fontSize: 13, fontWeight: '900', color: '#4B68FF' },
});
