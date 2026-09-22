import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import {
  DEFAULT_TIMETABLE_SETTINGS,
  getTimetableSettings,
  saveWidgetFontSize,
  saveWidgetFontStyle,
  saveWidgetTextColor,
  type WidgetFontSize,
  type WidgetFontStyle,
  type WidgetTextColor,
} from '../data/appSettingsRepository';
import { refreshWeeklyTimetableWidget } from '../widgets/widgetController';

type Props = {
  visible: boolean;
  hourHeight: number;
  showPtRemaining: boolean;
  widgetPrivacyMode: boolean;
  onClose: () => void;
  onHourHeightChange: (value: number) => void;
  onShowPtRemainingChange: (value: boolean) => void;
  onWidgetPrivacyModeChange: (value: boolean) => void;
};

const DENSITIES = [
  { label: '촘촘하게', value: 26 },
  { label: '기본', value: 30 },
  { label: '여유 있게', value: 36 },
];

const FONT_SIZES: Array<{ label: string; value: WidgetFontSize }> = [
  { label: '보통', value: 'normal' },
  { label: '크게', value: 'large' },
  { label: '아주 크게', value: 'xlarge' },
];

const FONT_STYLES: Array<{ label: string; value: WidgetFontStyle }> = [
  { label: '기본', value: 'default' },
  { label: '굵게', value: 'strong' },
  { label: '좁게', value: 'condensed' },
];

const TEXT_COLORS: Array<{ label: string; value: WidgetTextColor; color: string }> = [
  { label: '흰색', value: 'white', color: '#FFFFFF' },
  { label: '크림', value: 'cream', color: '#FFF1B8' },
  { label: '하늘', value: 'sky', color: '#DDF4FF' },
];

export function TimetableSettingsModal({
  visible,
  hourHeight,
  showPtRemaining,
  widgetPrivacyMode,
  onClose,
  onHourHeightChange,
  onShowPtRemainingChange,
  onWidgetPrivacyModeChange,
}: Props) {
  const db = useSQLiteContext();
  const [widgetFontSize, setWidgetFontSize] = useState<WidgetFontSize>(
    DEFAULT_TIMETABLE_SETTINGS.widgetFontSize,
  );
  const [widgetFontStyle, setWidgetFontStyle] = useState<WidgetFontStyle>(
    DEFAULT_TIMETABLE_SETTINGS.widgetFontStyle,
  );
  const [widgetTextColor, setWidgetTextColor] = useState<WidgetTextColor>(
    DEFAULT_TIMETABLE_SETTINGS.widgetTextColor,
  );

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void getTimetableSettings(db)
      .then((settings) => {
        if (!active) return;
        setWidgetFontSize(settings.widgetFontSize);
        setWidgetFontStyle(settings.widgetFontStyle);
        setWidgetTextColor(settings.widgetTextColor);
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, [db, visible]);

  const updateFontSize = async (value: WidgetFontSize) => {
    setWidgetFontSize(value);
    try {
      await saveWidgetFontSize(db, value);
      await refreshWeeklyTimetableWidget();
    } catch (error) {
      console.error(error);
    }
  };

  const updateFontStyle = async (value: WidgetFontStyle) => {
    setWidgetFontStyle(value);
    try {
      await saveWidgetFontStyle(db, value);
      await refreshWeeklyTimetableWidget();
    } catch (error) {
      console.error(error);
    }
  };

  const updateTextColor = async (value: WidgetTextColor) => {
    setWidgetTextColor(value);
    try {
      await saveWidgetTextColor(db, value);
      await refreshWeeklyTimetableWidget();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <Text style={styles.title}>시간표 디자인/설정</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleTitle}>위젯 이름 가리기</Text>
                <Text style={styles.toggleDescription}>홈 화면 위젯에서 회원 이름을 홍○동처럼 표시해요.</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: widgetPrivacyMode }}
                style={[styles.switchTrack, widgetPrivacyMode && styles.switchTrackOn]}
                onPress={() => onWidgetPrivacyModeChange(!widgetPrivacyMode)}
              >
                <View style={[styles.switchThumb, widgetPrivacyMode && styles.switchThumbOn]} />
              </Pressable>
            </View>

            <View style={styles.widgetSection}>
              <Text style={styles.widgetTitle}>위젯 글자 설정</Text>
              <Text style={styles.widgetDescription}>
                홈 화면 위젯의 글자 크기와 스타일을 원하는 대로 바꿀 수 있어요.
              </Text>

              <Text style={styles.optionLabel}>글자 크기</Text>
              <View style={styles.segmentRow}>
                {FONT_SIZES.map((item) => {
                  const selected = widgetFontSize === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      style={[styles.segment, selected && styles.segmentSelected]}
                      onPress={() => void updateFontSize(item.value)}
                    >
                      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.optionLabel}>글씨체</Text>
              <View style={styles.segmentRow}>
                {FONT_STYLES.map((item) => {
                  const selected = widgetFontStyle === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      style={[styles.segment, selected && styles.segmentSelected]}
                      onPress={() => void updateFontStyle(item.value)}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          item.value === 'strong' && styles.previewStrong,
                          item.value === 'condensed' && styles.previewCondensed,
                          selected && styles.segmentTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.optionLabel}>일정 글자 색상</Text>
              <View style={styles.colorRow}>
                {TEXT_COLORS.map((item) => {
                  const selected = widgetTextColor === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      style={[styles.colorOption, selected && styles.colorOptionSelected]}
                      onPress={() => void updateTextColor(item.value)}
                    >
                      <View
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: item.color },
                          item.value === 'white' && styles.whiteSwatch,
                        ]}
                      />
                      <Text style={[styles.colorLabel, selected && styles.segmentTextSelected]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.widgetHint}>
                변경하면 현재 홈 화면 위젯에도 바로 적용돼요.
              </Text>
            </View>
          </ScrollView>

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
    maxHeight: '92%',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 24,
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
    marginBottom: 16,
    fontSize: 18,
    fontWeight: '900',
    color: '#1F2228',
  },
  scrollContent: { paddingBottom: 4 },
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
  previewStrong: { fontWeight: '900' },
  previewCondensed: { fontFamily: 'sans-serif-condensed' },
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
  widgetSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E7EC',
  },
  widgetTitle: { fontSize: 16, fontWeight: '900', color: '#252932' },
  widgetDescription: { marginTop: 5, fontSize: 11, lineHeight: 17, color: '#8A919D' },
  optionLabel: {
    marginTop: 18,
    marginBottom: 9,
    fontSize: 12,
    fontWeight: '900',
    color: '#5C6470',
  },
  colorRow: { flexDirection: 'row', gap: 8 },
  colorOption: {
    flex: 1,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#E1E4E9',
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
  },
  colorOptionSelected: {
    borderColor: '#4B68FF',
    backgroundColor: '#EEF1FF',
  },
  colorSwatch: { width: 18, height: 18, borderRadius: 9 },
  whiteSwatch: { borderWidth: 1, borderColor: '#C7CBD2' },
  colorLabel: { fontSize: 12, fontWeight: '800', color: '#666D78' },
  widgetHint: { marginTop: 10, fontSize: 10, color: '#8A919D' },
  doneButton: {
    height: 48,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#24282F',
  },
  doneButtonText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
});
