import { useMemo, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type SignaturePoint = {
  x: number;
  y: number;
  stroke: number;
};

type Props = {
  visible: boolean;
  memberName: string;
  remainingSessions: number | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (signatureJson: string, sessionNote: string) => void;
};

export function SessionSignatureModal({
  visible,
  memberName,
  remainingSessions,
  submitting = false,
  onClose,
  onSubmit,
}: Props) {
  const [points, setPoints] = useState<SignaturePoint[]>([]);
  const [sessionNote, setSessionNote] = useState('');
  const strokeRef = useRef(0);
  const lastPointRef = useRef<SignaturePoint | null>(null);

  const signatureSegments = useMemo(
    () =>
      points.flatMap((point, index) => {
        if (index === 0) return [];
        const previous = points[index - 1];
        if (previous.stroke !== point.stroke) return [];

        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 0.5) return [];

        return [
          {
            key: `${point.stroke}-${index}`,
            left: (previous.x + point.x) / 2 - length / 2,
            top: (previous.y + point.y) / 2 - 2.25,
            width: length,
            angle: Math.atan2(dy, dx),
          },
        ];
      }),
    [points],
  );

  const addPoint = (x: number, y: number, stroke: number) => {
    const last = lastPointRef.current;
    if (last && last.stroke === stroke) {
      const dx = x - last.x;
      const dy = y - last.y;
      if (dx * dx + dy * dy < 7) return;
    }

    const point = { x, y, stroke };
    lastPointRef.current = point;
    setPoints((current) => [...current, point]);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          strokeRef.current += 1;
          lastPointRef.current = null;
          addPoint(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
            strokeRef.current,
          );
        },
        onPanResponderMove: (event) => {
          addPoint(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
            strokeRef.current,
          );
        },
        onPanResponderRelease: () => {
          lastPointRef.current = null;
        },
        onPanResponderTerminate: () => {
          lastPointRef.current = null;
        },
      }),
    [],
  );

  const clearSignature = () => {
    setPoints([]);
    lastPointRef.current = null;
  };

  const reset = () => {
    clearSignature();
    setSessionNote('');
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const submit = () => {
    if (points.length < 8) return;
    onSubmit(
      JSON.stringify({
        version: 1,
        signedBy: memberName,
        points,
      }),
      sessionNote,
    );
  };

  const nextRemaining =
    remainingSessions === null ? null : Math.max(remainingSessions - 1, 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>PT 수업 확인 서명</Text>
          <Text style={styles.description}>
            {memberName} 회원님께 패드를 건네고 서명을 받아주세요.
          </Text>

          {remainingSessions !== null ? (
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>서명 완료 시 PT 잔여</Text>
              <Text style={styles.balanceValue}>
                {remainingSessions}회 → {nextRemaining}회
              </Text>
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>오늘 수업 메모</Text>
          <TextInput
            value={sessionNote}
            onChangeText={setSessionNote}
            placeholder="예: 오른쪽 어깨 불편, 다음 수업 하체"
            placeholderTextColor="#A2A8B2"
            style={styles.noteInput}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.signatureHeader}>
            <Text style={styles.fieldLabel}>회원 서명</Text>
            <Pressable onPress={clearSignature} hitSlop={10}>
              <Text style={styles.clearText}>다시 쓰기</Text>
            </Pressable>
          </View>

          <View style={styles.signatureBox} {...panResponder.panHandlers}>
            {points.length === 0 ? (
              <Text style={styles.signatureHint}>이곳에 손가락으로 서명해주세요</Text>
            ) : null}
            {signatureSegments.map((segment) => (
              <View
                key={segment.key}
                pointerEvents="none"
                style={[
                  styles.signatureSegment,
                  {
                    left: segment.left,
                    top: segment.top,
                    width: segment.width,
                    transform: [{ rotate: `${segment.angle}rad` }],
                  },
                ]}
              />
            ))}
            {points.map((point, index) => (
              <View
                key={`dot-${point.stroke}-${index}`}
                pointerEvents="none"
                style={[
                  styles.signatureDot,
                  {
                    left: point.x - 2.25,
                    top: point.y - 2.25,
                  },
                ]}
              />
            ))}
          </View>

          <Text style={styles.legalHint}>
            서명이 저장되어야 PT 1회가 소진 처리됩니다.
          </Text>

          <View style={styles.actions}>
            <Pressable
              style={styles.cancelButton}
              onPress={close}
              disabled={submitting}
            >
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Pressable
              style={[
                styles.confirmButton,
                (points.length < 8 || submitting) && styles.disabled,
              ]}
              onPress={submit}
              disabled={points.length < 8 || submitting}
            >
              <Text style={styles.confirmText}>
                {submitting ? '소진 처리 중...' : '서명 완료 · PT 1회 소진'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16, 20, 28, 0.45)',
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#FFFFFF',
  },
  handle: {
    width: 40,
    height: 4,
    marginBottom: 14,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: '#D8DCE3',
  },
  title: { fontSize: 20, fontWeight: '900', color: '#20242C' },
  description: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#727986',
  },
  balanceCard: {
    marginTop: 14,
    paddingHorizontal: 14,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF1FF',
  },
  balanceLabel: { fontSize: 13, fontWeight: '800', color: '#59627A' },
  balanceValue: { fontSize: 16, fontWeight: '900', color: '#4B68FF' },
  fieldLabel: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '900',
    color: '#4A515D',
  },
  noteInput: {
    minHeight: 74,
    marginTop: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#F4F6F8',
    fontSize: 14,
    color: '#20242C',
  },
  signatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearText: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: '800',
    color: '#6C74A8',
  },
  signatureBox: {
    height: 190,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#D9DDE4',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCFCFD',
  },
  signatureHint: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B0B5BE',
  },
  signatureSegment: {
    position: 'absolute',
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: '#222831',
  },
  signatureDot: {
    position: 'absolute',
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: '#222831',
  },
  legalHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: '#8C929D',
  },
  actions: { marginTop: 18, flexDirection: 'row', gap: 10 },
  cancelButton: {
    width: 84,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF0F3',
  },
  cancelText: { fontSize: 14, fontWeight: '800', color: '#606773' },
  confirmButton: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4B68FF',
  },
  confirmText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
});
