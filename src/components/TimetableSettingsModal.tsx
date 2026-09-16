import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  hourHeight: number;
  showPtRemaining: boolean;
  onClose: () => void;
  onHourHeightChange: (value: number) => void;
  onShowPtRemainingChange: (value: boolean) => void;
};

const DENSITIES = [
  { label: '촘촘하게', value: 26 },
  { label: '기본', value: 30 },
  { label: '여유 있게', value: 36 },
];

export function TimetableSettingsModal({
  visible,
  hourHeight,
  showPtRemaining,
  onClose,
  onHourHeightChange,
  onShowPtRemainingChange,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <Text style={styles.title}>시간표 디자인/설정</Text>

          <Text style={styles.sectionTitle}>시간 간격</Text>
          <View style={styles.segmentRow}>
            {DENSITIES.map((item) => {
              const selected = item.value === hourHeight;
              return (
                <Pressable
                  key={item.value}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  onPress={() => onHourHeightChange(item.value)}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>PT 잔여횟수 표시</Text>
              <Text style={styles.toggleDescription}>회원 이름 아래에 잔여횟수를 보여줘요.</Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: showPtRemaining }}
              style={[styles.switchTrack, showPtRemaining && styles.switchTrackOn]}
              onPress={() => onShowPtRemainingChange(!showPtRemaining)}
            >
              <View style={[styles.switchThumb, showPtRemaining && styles.switchThumbOn]} />
            </Pressable>
          </View>

          <Pressable style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>완료</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sheet: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    marginBottom: 14,
    borderRadius: 3,
    backgroundColor: '#D8DBE1',
  },
  title: {
    marginBottom: 22,
    fontSize: 18,
    fontWeight: '900',
    color: '#1F2228',
  },
  sectionTitle: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '800',
    color: '#6E7580',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E1E4E9',
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
  },
  segmentSelected: {
    borderColor: '#4B68FF',
    backgroundColor: '#EEF1FF',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666D78',
  },
  segmentTextSelected: {
    color: '#4B68FF',
  },
  toggleRow: {
    minHeight: 76,
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EAEE',
  },
  toggleTextWrap: { flex: 1, paddingRight: 16 },
  toggleTitle: { fontSize: 15, fontWeight: '900', color: '#252932' },
  toggleDescription: { marginTop: 4, fontSize: 11, color: '#8A919D' },
  switchTrack: {
    width: 46,
    height: 27,
    padding: 3,
    borderRadius: 14,
    backgroundColor: '#D7DAE0',
  },
  switchTrackOn: { backgroundColor: '#4B68FF' },
  switchThumb: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  switchThumbOn: { marginLeft: 19 },
  doneButton: {
    height: 48,
    marginTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#24282F',
  },
  doneButtonText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
});
