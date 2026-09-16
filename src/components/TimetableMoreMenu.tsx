import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  overlapView: boolean;
  onClose: () => void;
  onMembers: () => void;
  onCalendar: () => void;
  onSettings: () => void;
  onCopyWeek: () => void;
  onToggleOverlap: () => void;
  onSaveImage: () => void;
};

export function TimetableMoreMenu({
  visible,
  overlapView,
  onClose,
  onMembers,
  onCalendar,
  onSettings,
  onCopyWeek,
  onToggleOverlap,
  onSaveImage,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <Text style={styles.title}>시간표 메뉴</Text>

          <MenuItem icon="👤" label="회원 관리" onPress={onMembers} />
          <MenuItem icon="▦" label="달력 보기" onPress={onCalendar} />
          <MenuItem icon="⚙" label="시간표 디자인/설정" onPress={onSettings} />
          <MenuItem icon="▣" label="이번 주 → 다음 주 복사" onPress={onCopyWeek} />
          <MenuItem
            icon="◇"
            label={overlapView ? '겹쳐보기 끄기' : '겹쳐보기 켜기'}
            value={overlapView ? 'ON' : 'OFF'}
            onPress={onToggleOverlap}
          />
          <MenuItem icon="⇩" label="이미지로 저장" onPress={onSaveImage} last />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type MenuItemProps = {
  icon: string;
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
};

function MenuItem({ icon, label, value, onPress, last = false }: MenuItemProps) {
  return (
    <Pressable style={[styles.item, last && styles.itemLast]} onPress={onPress}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.itemText}>{label}</Text>
      {value ? <Text style={styles.value}>{value}</Text> : null}
    </Pressable>
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
    marginBottom: 12,
    borderRadius: 3,
    backgroundColor: '#D8DBE1',
  },
  title: {
    marginBottom: 6,
    fontSize: 17,
    fontWeight: '900',
    color: '#1F2228',
  },
  item: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECEEF2',
  },
  itemLast: { borderBottomWidth: 0 },
  icon: { width: 38, fontSize: 18, textAlign: 'center' },
  itemText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#272B32',
  },
  value: {
    fontSize: 11,
    fontWeight: '900',
    color: '#4B68FF',
  },
});
