import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View>
          <Text style={styles.eyebrow}>MY SCHEDULE</Text>
          <Text style={styles.title}>오늘 일정</Text>
          <Text style={styles.subtitle}>아직 등록된 일정이 없어요.</Text>
        </View>

        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyTitle}>오늘은 비어 있어요</Text>
          <Text style={styles.emptyDescription}>
            첫 일정을 추가해서 하루 계획을 시작해보세요.
          </Text>
        </View>

        <Pressable style={styles.addButton}>
          <Text style={styles.addButtonText}>+ 일정 추가</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#7C8493',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    color: '#171A21',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 24,
    color: '#7C8493',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 42,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 28,
    fontWeight: '700',
    color: '#4B68FF',
    backgroundColor: '#EEF1FF',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#171A21',
  },
  emptyDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#7C8493',
    textAlign: 'center',
  },
  addButton: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4B68FF',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
