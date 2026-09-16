import React, { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme, fonts } from '../theme';
import { Card, SectionTitle, ProBadge } from '../components';
import { useApp } from '../state';
import { addStudent, deleteAllData, deleteStudent, getStudents, Student, updateStudent } from '../db';
import { deletePhotoFiles } from '../photos';
import { STATES, getState } from '../states';
import { restorePurchases, isBillingAvailable } from '../purchases';

const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://bkdigitalleads-cmyk.github.io/hearth/privacy.html';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SettingsScreen() {
  const theme = useTheme();
  const { settings, updateSettings, isPro, setIsPro, showPaywall, bumpData, target, dataVersion } = useApp();
  const [busy, setBusy] = useState(false);
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [daysText, setDaysText] = useState('');
  const [hoursText, setHoursText] = useState('');

  const st = getState(settings.stateCode);

  useEffect(() => {
    getStudents().then(setStudents);
  }, [dataVersion]);

  useEffect(() => {
    setDaysText(target.days != null ? String(target.days) : '');
    setHoursText(target.hours != null ? String(target.hours) : '');
  }, [target.days, target.hours]);

  // Only write a custom number when it actually differs from what's shown, so
  // tapping in and out of a field never flips a state requirement to "custom".
  const commitDays = () => {
    if (!daysText.trim()) {
      if (settings.targetDays != null) updateSettings({ targetDays: null });
      return;
    }
    const n = Math.round(Number(daysText));
    if (!isFinite(n) || n <= 0) {
      setDaysText(target.days != null ? String(target.days) : '');
      return;
    }
    if (n !== target.days) updateSettings({ targetDays: n });
  };
  const commitHours = () => {
    if (!hoursText.trim()) {
      if (settings.targetHours != null) updateSettings({ targetHours: null });
      return;
    }
    const n = Math.round(Number(hoursText));
    if (!isFinite(n) || n <= 0) {
      setHoursText(target.hours != null ? String(target.hours) : '');
      return;
    }
    if (n !== target.hours) updateSettings({ targetHours: n });
  };

  const pickState = async (code: string) => {
    await updateSettings({ stateCode: code, targetDays: null, targetHours: null });
    setStatePickerOpen(false);
  };

  const onAddStudent = () => {
    Alert.prompt('Add a student', 'First name is plenty.', async (name) => {
      try {
        const s = await addStudent(name ?? '');
        if (s) bumpData();
      } catch (e: any) {
        Alert.alert('Could not add student', e?.message ?? 'Please try again.');
      }
    });
  };

  const onEditStudent = (s: Student) => {
    Alert.prompt(
      'Edit student',
      'Name, then an optional grade after a comma (e.g. "Maya, 4").',
      async (text) => {
        const [name, grade = ''] = (text ?? '').split(',');
        if (!name?.trim()) return;
        await updateStudent(s.id, name, grade);
        bumpData();
      },
      'plain-text',
      s.grade ? `${s.name}, ${s.grade}` : s.name
    );
  };

  const onDeleteStudent = (s: Student) => {
    Alert.alert(`Remove ${s.name}?`, 'All of their lessons and work samples are erased. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const photos = await deleteStudent(s.id);
          deletePhotoFiles(photos);
          if (settings.activeStudentId === s.id) updateSettings({ activeStudentId: 0 });
          bumpData();
        },
      },
    ]);
  };

  const onToggleLock = async () => {
    if (!isPro) {
      showPaywall();
      return;
    }
    if (!settings.lockEnabled) {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hw || !enrolled) {
        Alert.alert('Face ID unavailable', 'Set up Face ID or a device passcode in iOS Settings first.');
        return;
      }
    }
    await updateSettings({ lockEnabled: !settings.lockEnabled });
  };

  const onRestore = async () => {
    if (!isBillingAvailable()) {
      Alert.alert('Unavailable', 'Purchases are not available right now.');
      return;
    }
    setBusy(true);
    const res = await restorePurchases();
    setBusy(false);
    if (res.ok) {
      setIsPro(res.isPro);
      Alert.alert(
        res.isPro ? 'Restored!' : 'No purchases found',
        res.isPro ? 'Your Pro access is back.' : 'We couldn’t find a previous purchase on this Apple ID.'
      );
    } else {
      Alert.alert('Restore failed', res.error ?? 'Please try again.');
    }
  };

  const onDeleteAll = () => {
    Alert.alert(
      'Delete all records?',
      'Every student, lesson, and work sample is permanently erased from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            const photos = await deleteAllData();
            deletePhotoFiles(photos);
            updateSettings({ activeStudentId: 0 });
            bumpData();
          },
        },
      ]
    );
  };

  const rowText = (label: string, pro?: boolean) => (
    <View style={styles.rowLabel}>
      <Text style={[styles.rowText, { color: theme.text }]}>{label}</Text>
      {pro && !isPro ? <ProBadge theme={theme} /> : null}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      {!isPro && (
        <Pressable onPress={showPaywall}>
          <Card theme={theme} style={{ ...styles.upsell, backgroundColor: theme.accentSoft }}>
            <Text style={[styles.upsellTitle, { color: theme.accent }]}>Hearth Pro</Text>
            <Text style={[styles.upsellSub, { color: theme.text }]}>
              Unlimited entries · Attendance & hours PDF · Portfolio PDF · CSV export · Face ID lock
            </Text>
          </Card>
        </Pressable>
      )}

      <SectionTitle theme={theme}>Students</SectionTitle>
      <Card theme={theme}>
        {students.map((s) => (
          <View key={s.id} style={[styles.row, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => onEditStudent(s)} style={{ flex: 1 }}>
              <Text style={[styles.rowText, { color: theme.text }]}>
                {s.name}
                {s.grade ? <Text style={{ color: theme.textFaint }}>  · Grade {s.grade}</Text> : null}
              </Text>
            </Pressable>
            <Pressable onPress={() => onDeleteStudent(s)} hitSlop={8}>
              <Text style={{ color: theme.textFaint, fontSize: 15 }}>Remove</Text>
            </Pressable>
          </View>
        ))}
        <Pressable onPress={onAddStudent} style={styles.row}>
          <Text style={[styles.rowText, { color: theme.accent, fontWeight: fonts.weight.semibold }]}>+ Add student</Text>
        </Pressable>
        <Text style={[styles.note, { color: theme.textFaint }]}>Tap a name to edit it or add a grade.</Text>
      </Card>

      <SectionTitle theme={theme}>State & target</SectionTitle>
      <Card theme={theme}>
        <Pressable onPress={() => setStatePickerOpen(true)} style={styles.row}>
          {rowText('Your state')}
          <Text style={[styles.rowValue, { color: theme.accent }]}>{st ? st.name : 'Choose'} ›</Text>
        </Pressable>
        <View style={styles.customRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.customLabel, { color: theme.textSecondary }]}>Days / year</Text>
            <TextInput
              style={[styles.customInput, { color: theme.text, borderColor: theme.border }]}
              keyboardType="number-pad"
              maxLength={3}
              value={daysText}
              placeholder="—"
              placeholderTextColor={theme.textFaint}
              onChangeText={setDaysText}
              onBlur={commitDays}
              onSubmitEditing={commitDays}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.customLabel, { color: theme.textSecondary }]}>Hours / year</Text>
            <TextInput
              style={[styles.customInput, { color: theme.text, borderColor: theme.border }]}
              keyboardType="number-pad"
              maxLength={4}
              value={hoursText}
              placeholder="—"
              placeholderTextColor={theme.textFaint}
              onChangeText={setHoursText}
              onBlur={commitHours}
              onSubmitEditing={commitHours}
            />
          </View>
        </View>
        <Text style={[styles.note, { color: theme.textFaint }]}>
          {target.source === 'state'
            ? `Using ${st?.name}'s published numbers. ${st?.hoursNote ?? ''}`.trim()
            : target.source === 'custom'
              ? 'Custom target. Leave a field blank to drop that target, or pick your state again to go back to its published numbers.'
              : st
                ? `${st.name} has no statewide days-or-hours number. Set the target your evaluator, umbrella school, or district expects.`
                : 'Pick your state, or set the target your evaluator or district expects.'}
        </Text>
        {target.source === 'custom' && st && (st.requiredDays != null || st.requiredHours != null) ? (
          <Pressable onPress={() => updateSettings({ targetDays: null, targetHours: null })}>
            <Text style={[styles.link, { color: theme.accent }]}>Reset to {st.name}'s numbers</Text>
          </Pressable>
        ) : null}
      </Card>

      <SectionTitle theme={theme}>School year</SectionTitle>
      <Card theme={theme}>
        <Text style={[styles.customLabel, { color: theme.textSecondary }]}>Starts in</Text>
        <View style={styles.monthRow}>
          {MONTHS.map((m, i) => {
            const active = settings.yearStartMonth === i + 1;
            return (
              <Pressable
                key={m}
                onPress={() => updateSettings({ yearStartMonth: i + 1 })}
                style={[
                  styles.monthChip,
                  { backgroundColor: active ? theme.accent : theme.card, borderColor: active ? theme.accent : theme.border },
                ]}
              >
                <Text style={[styles.monthText, { color: active ? (theme.isDark ? '#1C1512' : '#FFFFFF') : theme.textSecondary }]}>{m}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.note, { color: theme.textFaint }]}>
          Totals and reports cover the current school year. Most states count July through June.
        </Text>
      </Card>

      <SectionTitle theme={theme}>Name on reports</SectionTitle>
      <Card theme={theme}>
        <Text style={[styles.customLabel, { color: theme.textSecondary }]}>Parent / teacher</Text>
        <TextInput
          style={[styles.nameInput, { color: theme.text }]}
          value={settings.parentName}
          onChangeText={(v) => updateSettings({ parentName: v })}
          placeholder="Jordan Rivera"
          placeholderTextColor={theme.textFaint}
        />
      </Card>

      <SectionTitle theme={theme}>Security</SectionTitle>
      <Card theme={theme}>
        <View style={styles.row}>
          {rowText('Lock with Face ID', true)}
          <Switch value={settings.lockEnabled} onValueChange={onToggleLock} trackColor={{ true: theme.accent }} />
        </View>
      </Card>

      <SectionTitle theme={theme}>Privacy & data</SectionTitle>
      <Card theme={theme}>
        <Text style={[styles.privacyNote, { color: theme.textSecondary }]}>
          Your family's records never leave this iPhone. No account, no cloud, no tracking. Use the Records tab to export a copy whenever you like.
        </Text>
      </Card>

      <SectionTitle theme={theme}>Purchases</SectionTitle>
      <Card theme={theme}>
        <Pressable onPress={onRestore} disabled={busy} style={styles.row}>
          {rowText('Restore purchases')}
          <Text style={{ color: theme.textFaint }}>›</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(TERMS_URL)} style={styles.row}>
          {rowText('Terms of Use (EULA)')}
          <Text style={{ color: theme.textFaint }}>›</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} style={styles.row}>
          {rowText('Privacy Policy')}
          <Text style={{ color: theme.textFaint }}>›</Text>
        </Pressable>
      </Card>

      <SectionTitle theme={theme}>Danger zone</SectionTitle>
      <Card theme={theme}>
        <Pressable onPress={onDeleteAll} style={styles.row}>
          <Text style={[styles.rowText, { color: theme.danger }]}>Delete all records</Text>
        </Pressable>
      </Card>

      <Text style={[styles.version, { color: theme.textFaint }]}>Hearth v{Constants.expoConfig?.version ?? ''} · Made with care in NYC</Text>

      <Modal visible={statePickerOpen} animationType="slide" onRequestClose={() => setStatePickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={[styles.pickerHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Your state</Text>
            <Pressable onPress={() => setStatePickerOpen(false)} hitSlop={10}>
              <Text style={[styles.rowText, { color: theme.accent }]}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={STATES}
            keyExtractor={(s) => s.code}
            contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
            renderItem={({ item }) => {
              const active = item.code === settings.stateCode;
              const req =
                item.requiredDays != null && item.requiredHours != null
                  ? `${item.requiredDays} days · ${item.requiredHours} h`
                  : item.requiredDays != null
                    ? `${item.requiredDays} days`
                    : item.requiredHours != null
                      ? `${item.requiredHours} h`
                      : item.verified
                        ? 'no statewide number'
                        : 'not verified';
              return (
                <Pressable onPress={() => pickState(item.code)} style={[styles.stateRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.rowText, { color: active ? theme.accent : theme.text }, active && { fontWeight: fonts.weight.bold }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.stateReq, { color: theme.textFaint }]}>{req}</Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: fonts.weight.bold, letterSpacing: -0.5, marginBottom: 8 },
  upsell: { marginTop: 8, borderWidth: 0 },
  upsellTitle: { fontSize: 17, fontWeight: fonts.weight.bold, marginBottom: 4 },
  upsellSub: { fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    minHeight: 40,
  },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { fontSize: 16 },
  rowValue: { fontSize: 16, fontWeight: fonts.weight.semibold },
  note: { fontSize: 11, lineHeight: 16, marginTop: 6 },
  link: { fontSize: 13, fontWeight: fonts.weight.semibold, marginTop: 8 },
  customRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  customLabel: { fontSize: 12, fontWeight: fonts.weight.semibold, marginBottom: 4 },
  customInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16 },
  monthRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthChip: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  monthText: { fontSize: 12, fontWeight: fonts.weight.medium },
  nameInput: { fontSize: 17, paddingVertical: 2 },
  privacyNote: { fontSize: 13, lineHeight: 19, paddingVertical: 4 },
  version: { textAlign: 'center', marginTop: 28, fontSize: 12 },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerTitle: { fontSize: 17, fontWeight: fonts.weight.bold },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stateReq: { fontSize: 12 },
});
