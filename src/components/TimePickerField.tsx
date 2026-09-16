import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function timeStringToDate(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
  return date;
}

function dateToTimeString(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function TimePickerField({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const pickerValue = useMemo(() => timeStringToDate(value), [value]);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
    }

    if (event.type === 'dismissed' || !selectedDate) return;
    onChange(dateToTimeString(selectedDate));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value}`}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.timeText}>{value}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      {open ? (
        <View style={Platform.OS === 'ios' ? styles.iosPickerWrap : undefined}>
          <DateTimePicker
            value={pickerValue}
            mode="time"
            display="spinner"
            is24Hour
            minuteInterval={5}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' ? (
            <Pressable style={styles.doneButton} onPress={() => setOpen(false)}>
              <Text style={styles.doneText}>완료</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#7C8493',
  },
  button: {
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  buttonPressed: { opacity: 0.8 },
  timeText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#171A21',
  },
  chevron: {
    fontSize: 13,
    color: '#7C8493',
  },
  iosPickerWrap: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  doneButton: {
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  doneText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4B68FF',
  },
});
