import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, fonts, Theme } from '../theme';
import { Card, PillButton, ProBadge, SectionTitle } from '../components';
import { useApp } from '../state';
import { getStats, getStudents, Stats, Student, exportCsv, fmtHours } from '../db';
import { generateAndShareAttendancePdf, generateAndSharePortfolioPdf } from '../report';
import { maybeRequestReviewAfterExport } from '../reviews';
import { getState } from '../states';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

export default function ReportScreen() {
  const theme = useTheme();
  const { isPro, showPaywall, dataVersion, target, schoolYear, settings, updateSettings } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [busy, setBusy] = useState(false);

  const activeId = settings.activeStudentId;
  const st = getState(settings.stateCode);

  useEffect(() => {
    (async () => {
      const list = await getStudents();
      setStudents(list);
      const sid = activeId && list.some((s) => s.id === activeId) ? activeId : undefined;
      setStats(await getStats({ from: schoolYear.from, to: schoolYear.to, studentId: sid }));
    })();
  }, [dataVersion, activeId, schoolYear.from, schoolYear.to]);

  const requirePro = (fn: () => void) => () => {
    if (!isPro) {
      showPaywall();
      return;
    }
    fn();
  };

  const scopeId = activeId && students.some((s) => s.id === activeId) ? activeId : null;
  const scopeLabel = scopeId ? students.find((s) => s.id === scopeId)?.name ?? '' : students.length > 1 ? 'All students' : students[0]?.name ?? '';

  const run = (fn: () => Promise<void>) =>
    requirePro(async () => {
      if ((stats?.entryCount ?? 0) === 0) {
        Alert.alert('Nothing to export yet', 'Log a few lessons first, then create the report.');
        return;
      }
      try {
        setBusy(true);
        await fn();
        maybeRequestReviewAfterExport();
      } catch (e: any) {
        Alert.alert('Export failed', e?.message ?? 'Please try again.');
      } finally {
        setBusy(false);
      }
    });

  const onAttendance = run(() => generateAndShareAttendancePdf(scopeId));
  const onPortfolio = run(() => generateAndSharePortfolioPdf(scopeId));

  const onCsv = requirePro(async () => {
    try {
      setBusy(true);
      const csv = await exportCsv({ from: schoolYear.from, to: schoolYear.to, studentId: scopeId ?? undefined });
      const file = new File(Paths.cache, 'hearth-homeschool-log.csv');
      if (file.exists) file.delete();
      file.write(csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export your homeschool log' });
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  });

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[styles.title, { color: theme.text }]}>Records</Text>
      <Text style={[styles.sub, { color: theme.textSecondary }]}>
        Everything a district, evaluator, or umbrella school asks for, built from the lessons you already logged.
      </Text>

      {students.length > 1 && (
        <View style={styles.chips}>
          <Chip theme={theme} label="All" active={!scopeId} onPress={() => updateSettings({ activeStudentId: 0 })} />
          {students.map((s) => (
            <Chip key={s.id} theme={theme} label={s.name} active={scopeId === s.id} onPress={() => updateSettings({ activeStudentId: s.id })} />
          ))}
        </View>
      )}

      <Card theme={theme} style={styles.statsCard}>
        <View style={styles.statRow}>
          <Stat label="Days" value={String(stats?.dayCount ?? 0)} theme={theme} />
          <Stat label="Hours" value={fmtHours(stats?.totalMin ?? 0)} theme={theme} />
          <Stat label="Core" value={fmtHours(stats?.coreMin ?? 0)} theme={theme} />
          <Stat label="Samples" value={String(stats?.photoCount ?? 0)} theme={theme} />
        </View>
        <Text style={[styles.goalLine, { color: theme.textFaint }]}>
          {schoolYear.label} · {scopeLabel || 'no student yet'}
          {target.days != null || target.hours != null
            ? ` · target ${[target.days != null ? `${target.days} days` : '', target.hours != null ? `${target.hours} h` : ''].filter(Boolean).join(' / ')}`
            : ' · no target set'}
        </Text>
      </Card>

      <SectionTitle theme={theme}>Export</SectionTitle>
      <Card theme={theme} style={styles.exportCard}>
        <View style={styles.exportTitleRow}>
          <Text style={[styles.exportTitle, { color: theme.text }]}>Attendance & hours log (PDF)</Text>
          {!isPro && <ProBadge theme={theme} />}
        </View>
        <Text style={[styles.exportBody, { color: theme.textSecondary }]}>
          One row per school day with hours and subjects, totals against your target, hours by subject, and a parent certification block with a signature line.
        </Text>
        <PillButton theme={theme} label={busy ? 'Working…' : 'Create attendance PDF'} onPress={onAttendance} disabled={busy} />
      </Card>

      <Card theme={theme} style={styles.exportCard}>
        <View style={styles.exportTitleRow}>
          <Text style={[styles.exportTitle, { color: theme.text }]}>Portfolio (PDF)</Text>
          {!isPro && <ProBadge theme={theme} />}
        </View>
        <Text style={[styles.exportBody, { color: theme.textSecondary }]}>
          Every lesson with what you covered and the work-sample photos, in date order. For portfolio states and evaluator reviews.
        </Text>
        <PillButton theme={theme} label={busy ? 'Working…' : 'Create portfolio PDF'} onPress={onPortfolio} disabled={busy} />
      </Card>

      <Card theme={theme} style={styles.exportCard}>
        <View style={styles.exportTitleRow}>
          <Text style={[styles.exportTitle, { color: theme.text }]}>CSV spreadsheet</Text>
          {!isPro && <ProBadge theme={theme} />}
        </View>
        <Text style={[styles.exportBody, { color: theme.textSecondary }]}>
          Every entry this school year as a spreadsheet, yours to keep and back up.
        </Text>
        <PillButton theme={theme} label={busy ? 'Working…' : 'Export CSV'} onPress={onCsv} disabled={busy} kind="ghost" />
      </Card>

      <SectionTitle theme={theme}>Your state</SectionTitle>
      <Card theme={theme}>
        {st ? (
          <>
            <Text style={[styles.stateName, { color: theme.text }]}>{st.name}</Text>
            <Text style={[styles.stateBody, { color: theme.textSecondary }]}>{st.summary}</Text>
            {st.hoursNote ? (
              <Text style={[styles.stateBody, { color: theme.textSecondary, marginTop: 6 }]}>{st.hoursNote}</Text>
            ) : null}
            <Text style={[styles.stateFoot, { color: theme.textFaint }]}>
              {st.verified
                ? 'Checked against the official state source on Sep 9, 2026. Laws change — confirm before you file.'
                : 'We could not verify this state against an official source yet. Please confirm your requirements and set your own target.'}
            </Text>
            {st.source ? (
              <Pressable onPress={() => Linking.openURL(st.source)}>
                <Text style={[styles.link, { color: theme.accent }]}>Open the official source ›</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={[styles.stateBody, { color: theme.textSecondary }]}>
            Pick your state in Settings to see its record-keeping requirements and use them as your target.
          </Text>
        )}
      </Card>

      <Text style={[styles.tip, { color: theme.textFaint }]}>
        Tip: log every school day, even short ones. Days with any entry count toward attendance.
      </Text>
    </ScrollView>
  );
}

function Chip({ theme, label, active, onPress }: { theme: Theme; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? theme.accent : theme.card, borderColor: active ? theme.accent : theme.border }]}
    >
      <Text style={[styles.chipText, { color: active ? (theme.isDark ? '#1C1512' : '#FFFFFF') : theme.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: Theme }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textFaint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: fonts.weight.bold, letterSpacing: -0.5 },
  sub: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: fonts.weight.medium },
  statsCard: { marginTop: 16, paddingVertical: 16 },
  statRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: fonts.weight.bold },
  statLabel: { fontSize: 12, marginTop: 2 },
  goalLine: { textAlign: 'center', fontSize: 12, marginTop: 10 },
  exportCard: { marginBottom: 12, gap: 10 },
  exportTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportTitle: { fontSize: 16, fontWeight: fonts.weight.semibold },
  exportBody: { fontSize: 13, lineHeight: 18 },
  stateName: { fontSize: 16, fontWeight: fonts.weight.semibold, marginBottom: 4 },
  stateBody: { fontSize: 13, lineHeight: 19 },
  stateFoot: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  link: { fontSize: 13, fontWeight: fonts.weight.semibold, marginTop: 8 },
  tip: { fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 17 },
});
