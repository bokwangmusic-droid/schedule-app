import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDateString(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

type Props = {
  visible: boolean;
  title: string;
  selectedDate?: string | null;
  onClose: () => void;
  onSelect: (date: string) => void;
};

export function SimpleDatePickerModal({
  visible,
  title,
  selectedDate,
  onClose,
  onSelect,
}: Props) {
  const selected = useMemo(() => parseDate(selectedDate), [selectedDate]);
  const [monthCursor, setMonthCursor] = useState(() => {
    const base = selected ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (!visible) return;
    const base = selected ?? new Date();
    setMonthCursor(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [selected, visible]);

  const cells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const first = new Date(year, month, 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - mondayOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return {
        date,
        dateString: toDateString(date),
        inCurrentMonth: date.getMonth() === month,
      };
    });
  }, [monthCursor]);

  const todayString = toDateString(new Date());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.topRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>

          <View style={styles.monthRow}>
            <Pressable
              style={styles.yearButton}
              onPress={() =>
                setMonthCursor(
                  (current) => new Date(current.getFullYear() - 1, current.getMonth(), 1),
                )
              }
            >
              <Text style={styles.yearButtonText}>‹ 1년</Text>
            </Pressable>

            <Pressable
              style={styles.arrowButton}
              onPress={() =>
                setMonthCursor(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
            >
              <Text style={styles.arrow}>‹</Text>
            </Pressable>

            <Text style={styles.monthTitle}>
              {monthCursor.getFullYear()}년 {monthCursor.getMonth() + 1}월
            </Text>

            <Pressable
              style={styles.arrowButton}
              onPress={() =>
                setMonthCursor(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
            >
              <Text style={styles.arrow}>›</Text>
            </Pressable>

            <Pressable
              style={styles.yearButton}
              onPress={() =>
                setMonthCursor(
                  (current) => new Date(current.getFullYear() + 1, current.getMonth(), 1),
                )
              }
            >
              <Text style={styles.yearButtonText}>1년 ›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((day) => (
              <Text key={day} style={styles.weekday}>{day}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map(({ date, dateString, inCurrentMonth }) => {
              const isSelected = dateString === selectedDate;
              const isToday = dateString === todayString;
              return (
                <Pressable
                  key={dateString}
                  style={styles.dayCell}
                  onPress={() => {
                    onSelect(dateString);
                    onClose();
                  }}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isToday && styles.todayCircle,
                      isSelected && styles.selectedCircle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !inCurrentMonth && styles.outsideText,
                        isToday && styles.todayText,
                        isSelected && styles.selectedText,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={styles.todayButton}
            onPress={() => {
              onSelect(todayString);
              onClose();
            }}
          >
            <Text style={styles.todayButtonText}>오늘 선택</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  card: {
    width: '100%',
    maxWidth: 390,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontWeight: '900', color: '#20242C' },
  close: { fontSize: 14, fontWeight: '800', color: '#747B88' },
  monthRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yearButton: {
    minWidth: 48,
    height: 36,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearButtonText: { fontSize: 12, fontWeight: '800', color: '#69707D' },
  arrowButton: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { marginTop: -4, fontSize: 30, fontWeight: '300', color: '#30343B' },
  monthTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '900', color: '#20242C' },
  weekRow: { marginTop: 8, flexDirection: 'row' },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#8B919C',
  },
  grid: { marginTop: 5, flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: { borderWidth: 1.5, borderColor: '#4B68FF' },
  selectedCircle: { borderWidth: 0, backgroundColor: '#4B68FF' },
  dayText: { fontSize: 13, fontWeight: '800', color: '#343943' },
  outsideText: { color: '#C4C8CF' },
  todayText: { color: '#4B68FF' },
  selectedText: { color: '#FFFFFF' },
  todayButton: {
    height: 44,
    marginTop: 12,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF1FF',
  },
  todayButtonText: { fontSize: 14, fontWeight: '900', color: '#4B68FF' },
});
