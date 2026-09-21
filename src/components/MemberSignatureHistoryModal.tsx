import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SignedMemberSession } from '../data/scheduleRepository';
import { SignaturePreview } from './SignaturePreview';

type Props = {
  visible: boolean;
  memberName: string;
  sessions: SignedMemberSession[];
  loading?: boolean;
  onClose: () => void;
};

function shortDate(value: string) {
  const [, month, day] = value.split('-').map(Number);
  return `${month}/${day}`;
}

export function MemberSignatureHistoryModal({
  visible,
  memberName,
  sessions,
  loading = false,
  onClose,
}: Props) {
  const [selected, setSelected] = useState<SignedMemberSession | null>(null);

  const close = () => {
    setSelected(null);
    onClose();
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{memberName} · PT 서명 기록</Text>
                <Text style={styles.subtitle}>
                  회차 · 날짜 · 실제 서명을 한 화면에서 확인합니다.
                </Text>
              </View>
              <Pressable onPress={close} hitSlop={10}>
                <Text style={styles.closeText}>닫기</Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color="#4B68FF" />
              </View>
            ) : sessions.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>아직 저장된 PT 서명이 없어요.</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {sessions.slice(0, 50).map((session) => (
                  <Pressable
                    key={session.id}
                    style={styles.item}
                    onPress={() => setSelected(session)}
                  >
                    <Text style={styles.meta}>
                      {session.sessionNumber}회째 {shortDate(session.date)}
                    </Text>
                    <View style={styles.signature}>
                      <SignaturePreview
                        signatureJson={session.signatureJson}
                        height={18}
                        compact
                      />
                    </View>
                  </Pressable>
                ))}
                {sessions.length > 50 ? (
                  <Text style={styles.more}>
                    최근 50개만 표시 중 · 총 {sessions.length}개
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.detailBackdrop}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailTitle}>
                  {selected
                    ? `${selected.sessionNumber}회째 · ${shortDate(selected.date)} PT 서명`
                    : 'PT 서명'}
                </Text>
                {selected?.startTime ? (
                  <Text style={styles.detailTime}>
                    {selected.startTime.slice(0, 5)}
                    {selected.endTime ? `–${selected.endTime.slice(0, 5)}` : ''}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => setSelected(null)} hitSlop={10}>
                <Text style={styles.closeText}>닫기</Text>
              </Pressable>
            </View>

            {selected ? (
              <>
                <SignaturePreview signatureJson={selected.signatureJson} height={180} />
                {selected.sessionNote ? (
                  <View style={styles.note}>
                    <Text style={styles.noteLabel}>수업 메모</Text>
                    <Text style={styles.noteText}>{selected.sessionNote}</Text>
                  </View>
                ) : null}
                <Text style={styles.signedAt}>
                  서명 저장 {new Date(selected.signedAt).toLocaleString('ko-KR')}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16,20,28,0.42)',
  },
  sheet: {
    height: '92%',
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 16,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#F7F8FA',
  },
  handle: {
    width: 40,
    height: 4,
    marginBottom: 14,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: '#D7DAE1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 19, fontWeight: '900', color: '#20242C' },
  subtitle: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 16,
    color: '#858C98',
  },
  closeText: { fontSize: 13, fontWeight: '900', color: '#5968B5' },
  loading: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    height: 160,
    marginTop: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyText: { fontSize: 13, fontWeight: '700', color: '#9298A3' },
  grid: {
    flex: 1,
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    columnGap: 6,
    rowGap: 2,
  },
  item: {
    width: '49%',
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E1E4EA',
  },
  meta: {
    width: 68,
    fontSize: 9,
    fontWeight: '900',
    color: '#303640',
  },
  signature: {
    flex: 1,
    height: 18,
    marginLeft: 4,
  },
  more: {
    width: '100%',
    marginTop: 4,
    fontSize: 10,
    color: '#8D949F',
    textAlign: 'center',
  },
  detailBackdrop: {
    flex: 1,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,20,28,0.52)',
  },
  detailCard: {
    width: '100%',
    maxWidth: 420,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  detailHeader: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  detailTitle: { fontSize: 18, fontWeight: '900', color: '#22262E' },
  detailTime: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    color: '#7A818D',
  },
  note: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F5F7FA',
  },
  noteLabel: { fontSize: 10, fontWeight: '900', color: '#878E99' },
  noteText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: '#424852',
  },
  signedAt: {
    marginTop: 8,
    fontSize: 10,
    color: '#9AA0AA',
    textAlign: 'right',
  },
});
