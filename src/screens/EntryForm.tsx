import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme, fonts, Theme } from '../theme';
import { Card, PillButton } from '../components';
import { useApp, todayIso } from '../state';
import {
  countEntries,
  deleteEntry,
  getEntry,
  getRecentSubjects,
  getStudents,
  insertEntry,
  updateEntry,
  Student,
  SUBJECT_OPTIONS,
  fmtHours,
} from '../db';
import { deletePhotoFile, photoUri, storePhoto } from '../photos';
import { maybeRequestReview } from '../reviews';

interface Props {
  visible: boolean;
  entryId: number | null; // null = new entry
  onClose: () => void;
}

const TIMER_KEY = 'hearth.lessonTimer.startedAt.v1';

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Parse "2.5" / "2" / "2,5" as decimal hours → minutes. */
function parseHoursToMin(text: string): number {
  const n = Number(text.replace(',', '.'));
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round(n * 60);
}

export default function EntryFormModal({ visible, entryId, onClose }: Props) {
  const theme = useTheme();
  const { settings, bumpData } = useApp();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [hoursText, setHoursText] = useState('');
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [recentSubjects, setRecentSubjects] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(''); // stored filename
  const [originalPhoto, setOriginalPhoto] = useState('');
  const [saving, setSaving] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const editing = entryId !== null;

  const reset = useCallback(() => {
    setDate(todayIso());
    setHoursText('');
    setSubject('');
    setCustomSubject('');
    setNotes('');
    setPhoto('');
    setOriginalPhoto('');
  }, []);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const list = await getStudents();
      setStudents(list);
      setRecentSubjects(await getRecentSubjects());
      if (entryId !== null) {
        const e = await getEntry(entryId);
        if (e) {
          setStudentId(e.studentId);
          setDate(e.date);
          setHoursText(e.durationMin > 0 ? String(Math.round((e.durationMin / 60) * 100) / 100) : '');
          if ((SUBJECT_OPTIONS as readonly string[]).includes(e.subject)) {
            setSubject(e.subject);
            setCustomSubject('');
          } else {
            setSubject('');
            setCustomSubject(e.subject);
          }
          setNotes(e.notes);
          setPhoto(e.photo);
          setOriginalPhoto(e.photo);
        }
      } else {
        reset();
        const preferred = settings.activeStudentId && list.some((s) => s.id === settings.activeStudentId)
          ? settings.activeStudentId
          : list[0]?.id ?? null;
        setStudentId(preferred);
        try {
          const raw = await AsyncStorage.getItem(TIMER_KEY);
          if (raw) setTimerStart(Number(raw));
        } catch {
          // timer state is a convenience only
        }
      }
    })();
  }, [visible, entryId, reset, settings.activeStudentId]);

  // Tick twice a minute while the timer runs so the elapsed label stays live.
  useEffect(() => {
    if (timerStart != null && visible) {
      tick.current = setInterval(() => setNow(Date.now()), 30_000);
      return () => {
        if (tick.current) clearInterval(tick.current);
      };
    }
    return undefined;
  }, [timerStart, visible]);

  const startTimer = async () => {
    const t = Date.now();
    setTimerStart(t);
    setNow(t);
    try {
      await AsyncStorage.setItem(TIMER_KEY, String(t));
    } catch {
      // non-fatal
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const stopTimer = async () => {
    if (timerStart == null) return;
    const elapsedMin = Math.max(1, Math.round((Date.now() - timerStart) / 60000));
    setHoursText(String(Math.round((elapsedMin / 60) * 100) / 100));
    setTimerStart(null);
    try {
      await AsyncStorage.removeItem(TIMER_KEY);
    } catch {
      // non-fatal
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const discardTimer = async () => {
    setTimerStart(null);
    try {
      await AsyncStorage.removeItem(TIMER_KEY);
    } catch {
      // non-fatal
    }
  };

  const pickPhoto = async (fromCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera unavailable', 'Allow camera access in iOS Settings to photograph work samples.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      }
      if (result.canceled || !result.assets?.length) return;
      const stored = await storePhoto(result.assets[0].uri);
      // Replace an unsaved previous pick so we don't leak files.
      if (photo && photo !== originalPhoto) deletePhotoFile(photo);
      setPhoto(stored);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (e: any) {
      Alert.alert('Photo failed', e?.message ?? 'Please try again.');
    }
  };

  const removePhoto = () => {
    if (photo && photo !== originalPhoto) deletePhotoFile(photo);
    setPhoto('');
  };

  const save = async () => {
    const durationMin = parseHoursToMin(hoursText);
    if (!studentId) {
      Alert.alert('Which student?', 'Add a student in Settings first.');
      return;
    }
    if (durationMin <= 0) {
      Alert.alert('How long was the lesson?', 'Enter hours like 1 or 1.5, or use the lesson timer.');
      return;
    }
    const finalSubject = (customSubject.trim() || subject).trim();
    setSaving(true);
    try {
      // A timer left running would otherwise resurface on the next lesson.
      if (timerStart != null) await discardTimer();
      const input = { studentId, date, durationMin, subject: finalSubject, notes, photo };
      if (editing && entryId !== null) {
        await updateEntry(entryId, input);
        if (originalPhoto && originalPhoto !== photo) deletePhotoFile(originalPhoto);
      } else {
        await insertEntry(input);
        maybeRequestReview(await countEntries());
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bumpData();
      reset();
      onClose();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!editing || entryId === null) return;
    Alert.alert('Delete this entry?', 'Its hours come off your totals. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const p = await deleteEntry(entryId);
          if (p) deletePhotoFile(p);
          bumpData();
          onClose();
        },
      },
    ]);
  };

  const cancel = () => {
    if (photo && photo !== originalPhoto) deletePhotoFile(photo);
    reset();
    onClose();
  };

  const durationMin = parseHoursToMin(hoursText);
  const elapsed = timerStart != null ? Math.max(0, Math.round((now - timerStart) / 60000)) : 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cancel}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={cancel} hitSlop={10}>
            <Text style={[styles.headerBtn, { color: theme.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {editing ? 'Edit lesson' : 'Log a lesson'}
          </Text>
          <Pressable onPress={save} hitSlop={10} disabled={saving}>
            <Text style={[styles.headerBtn, { color: theme.accent, fontWeight: fonts.weight.bold }]}>
              {saving ? '…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {students.length > 1 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Student</Text>
              <View style={styles.chipsRow}>
                {students.map((s) => (
                  <SelectChip
                    key={s.id}
                    theme={theme}
                    label={s.name}
                    active={studentId === s.id}
                    onPress={() => setStudentId(s.id)}
                  />
                ))}
              </View>
            </>
          )}

          {!editing && (
            <Card theme={theme} style={{ ...styles.fieldCard, backgroundColor: theme.cardAlt }}>
              {timerStart == null ? (
                <View style={styles.timerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timerTitle, { color: theme.text }]}>Lesson timer</Text>
                    <Text style={[styles.timerSub, { color: theme.textFaint }]}>
                      Start when you begin, stop when you wrap up.
                    </Text>
                  </View>
                  <PillButton theme={theme} label="Start" onPress={startTimer} />
                </View>
              ) : (
                <View style={styles.timerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timerTitle, { color: theme.accent }]}>
                      In session… {fmtHours(Math.max(1, elapsed))}
                    </Text>
                    <Pressable onPress={discardTimer} hitSlop={6}>
                      <Text style={[styles.timerSub, { color: theme.textFaint }]}>discard timer</Text>
                    </Pressable>
                  </View>
                  <PillButton theme={theme} label="Stop" onPress={stopTimer} />
                </View>
              )}
            </Card>
          )}

          <Card theme={theme} style={styles.fieldCard}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Date</Text>
            <View style={styles.dateRow}>
              <Pressable onPress={() => setDate(shiftDate(date, -1))} hitSlop={8}>
                <Text style={[styles.dateArrow, { color: theme.accent }]}>‹</Text>
              </Pressable>
              <Text style={[styles.dateText, { color: theme.text }]}>{prettyDate(date)}</Text>
              <Pressable onPress={() => date < todayIso() && setDate(shiftDate(date, 1))} hitSlop={8}>
                <Text style={[styles.dateArrow, { color: date < todayIso() ? theme.accent : theme.border }]}>›</Text>
              </Pressable>
            </View>
          </Card>

          <Card theme={theme} style={styles.fieldCard}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Hours{durationMin > 0 ? `  ·  ${fmtHours(durationMin)}` : ''}
            </Text>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={hoursText}
              onChangeText={setHoursText}
              placeholder="1.5"
              placeholderTextColor={theme.textFaint}
              keyboardType="decimal-pad"
              maxLength={5}
            />
            <View style={styles.quickRow}>
              {[
                { label: '30m', v: '0.5' },
                { label: '45m', v: '0.75' },
                { label: '1h', v: '1' },
                { label: '2h', v: '2' },
                { label: '4h', v: '4' },
                { label: '6h', v: '6' },
              ].map((c) => (
                <QuickChip key={c.label} theme={theme} label={c.label} onPress={() => setHoursText(c.v)} />
              ))}
            </View>
          </Card>

          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Subject</Text>
          <View style={styles.chipsRow}>
            {SUBJECT_OPTIONS.map((c) => {
              const active = subject === c && !customSubject.trim();
              return (
                <SelectChip
                  key={c}
                  theme={theme}
                  label={c}
                  active={active}
                  onPress={() => {
                    setCustomSubject('');
                    setSubject(active ? '' : c);
                  }}
                />
              );
            })}
          </View>
          <Card theme={theme} style={styles.fieldCard}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Or type your own subject</Text>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={customSubject}
              onChangeText={setCustomSubject}
              placeholder="Latin, Co-op, Nature study…"
              placeholderTextColor={theme.textFaint}
            />
            {recentSubjects.filter((s) => !(SUBJECT_OPTIONS as readonly string[]).includes(s)).length > 0 && (
              <View style={styles.quickRow}>
                {recentSubjects
                  .filter((s) => !(SUBJECT_OPTIONS as readonly string[]).includes(s))
                  .map((s) => (
                    <QuickChip key={s} theme={theme} label={s} onPress={() => setCustomSubject(s)} />
                  ))}
              </View>
            )}
          </Card>

          <Card theme={theme} style={styles.fieldCard}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>What you covered</Text>
            <TextInput
              style={[styles.input, styles.notes, { color: theme.text }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Long division, chapters 4–5 of Charlotte's Web, nature walk"
              placeholderTextColor={theme.textFaint}
              multiline
            />
          </Card>

          <Card theme={theme} style={styles.fieldCard}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Work sample (optional)</Text>
            <View style={styles.photoRow}>
              {photo ? (
                <View style={styles.photoWrap}>
                  <Image source={{ uri: photoUri(photo) }} style={styles.photo} />
                  <Pressable onPress={removePhoto} style={[styles.photoX, { backgroundColor: theme.danger }]} hitSlop={8}>
                    <Text style={styles.photoXText}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => pickPhoto(true)}
                  onLongPress={() => pickPhoto(false)}
                  style={[styles.photoAdd, { borderColor: theme.border, backgroundColor: theme.card }]}
                >
                  <Text style={styles.photoAddIcon}>📷</Text>
                  <Text style={[styles.photoAddText, { color: theme.textSecondary }]}>Add photo</Text>
                </Pressable>
              )}
              <Text style={[styles.hint, { color: theme.textFaint }]}>
                Snap the worksheet, project, or page. Tap for camera · hold to pick from library. Shows up in the portfolio PDF.
              </Text>
            </View>
          </Card>

          {editing && (
            <View style={{ marginTop: 18 }}>
              <PillButton theme={theme} label="Delete entry" kind="ghost" onPress={onDelete} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function QuickChip({ theme, label, onPress }: { theme: Theme; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.quickChip, { backgroundColor: theme.cardAlt }]}>
      <Text style={[styles.quickChipText, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SelectChip({ theme, label, active, onPress }: { theme: Theme; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.selectChip,
        { backgroundColor: active ? theme.accent : theme.card, borderColor: active ? theme.accent : theme.border },
      ]}
    >
      <Text style={[styles.selectChipText, { color: active ? (theme.isDark ? '#1C1512' : '#FFFFFF') : theme.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { fontSize: 16 },
  headerTitle: { fontSize: 17, fontWeight: fonts.weight.bold },
  scroll: { padding: 20, paddingBottom: 60 },
  fieldCard: { marginBottom: 12, paddingVertical: 12 },
  label: { fontSize: 12, fontWeight: fonts.weight.semibold, marginBottom: 4 },
  input: { fontSize: 17, paddingVertical: 2 },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timerTitle: { fontSize: 16, fontWeight: fonts.weight.bold },
  timerSub: { fontSize: 12, marginTop: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  dateArrow: { fontSize: 30, fontWeight: fonts.weight.bold, paddingHorizontal: 10 },
  dateText: { fontSize: 17, fontWeight: fonts.weight.semibold },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  quickChip: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, maxWidth: 200 },
  quickChipText: { fontSize: 13, fontWeight: fonts.weight.medium },
  sectionLabel: { fontSize: 12, fontWeight: fonts.weight.semibold, marginBottom: 8, marginTop: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  selectChip: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  selectChipText: { fontSize: 13, fontWeight: fonts.weight.medium },
  photoRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4 },
  photoWrap: { position: 'relative' },
  photo: { width: 84, height: 84, borderRadius: 12 },
  photoX: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoXText: { color: '#FFF', fontSize: 11, fontWeight: fonts.weight.bold },
  photoAdd: {
    width: 84,
    height: 84,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoAddIcon: { fontSize: 20 },
  photoAddText: { fontSize: 11 },
  hint: { flex: 1, fontSize: 12, lineHeight: 17 },
});
