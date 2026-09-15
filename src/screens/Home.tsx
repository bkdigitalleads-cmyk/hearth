import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, fonts, Theme } from '../theme';
import { Card } from '../components';
import { useApp, FREE_ENTRY_LIMIT } from '../state';
import {
  addStudent,
  getEntries,
  getStats,
  getStudents,
  Entry,
  Stats,
  Student,
  fmtHours,
  countEntries,
} from '../db';
import { photoUri } from '../photos';

export default function HomeScreen({
  onAddEntry,
  onOpenEntry,
}: {
  onAddEntry: () => void;
  onOpenEntry: (id: number) => void;
}) {
  const theme = useTheme();
  const { isPro, showPaywall, dataVersion, target, schoolYear, settings, updateSettings, bumpData } = useApp();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const activeId = settings.activeStudentId;

  const load = useCallback(async () => {
    const list = await getStudents();
    setStudents(list);
    // If the remembered student was deleted, fall back to "all".
    const sid = activeId && list.some((s) => s.id === activeId) ? activeId : undefined;
    const filter = { from: schoolYear.from, to: schoolYear.to, studentId: sid };
    setEntries(await getEntries(filter));
    setStats(await getStats(filter));
    setTotalCount(await countEntries());
  }, [activeId, schoolYear.from, schoolYear.to]);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  const atFreeLimit = !isPro && totalCount >= FREE_ENTRY_LIMIT;
  const nearFreeLimit = !isPro && !atFreeLimit && totalCount >= FREE_ENTRY_LIMIT - 4;

  const handleAdd = () => {
    if (students.length === 0) {
      promptStudent();
      return;
    }
    if (atFreeLimit) {
      showPaywall();
      return;
    }
    onAddEntry();
  };

  const promptStudent = () => {
    Alert.prompt('Add a student', 'Whose lessons are you logging?', async (name) => {
      try {
        const st = await addStudent(name ?? '');
        if (st) {
          updateSettings({ activeStudentId: st.id });
          bumpData();
        }
      } catch (e: any) {
        Alert.alert('Could not add student', e?.message ?? 'Please try again.');
      }
    });
  };

  const dayCount = stats?.dayCount ?? 0;
  const totalMin = stats?.totalMin ?? 0;
  const dayPct = target.days ? Math.min(1, dayCount / target.days) : 0;
  const hourPct = target.hours ? Math.min(1, totalMin / (target.hours * 60)) : 0;
  const hasTarget = target.days != null || target.hours != null;
  const reached = hasTarget && (target.days == null || dayPct >= 1) && (target.hours == null || hourPct >= 1);

  const subtitle = (e: Entry): string => {
    const parts: string[] = [fmtHours(e.durationMin)];
    if (!activeId || students.length > 1) parts.push(e.studentName);
    if (e.notes) parts.push(e.notes);
    return parts.join(' · ');
  };

  const renderItem = ({ item }: { item: Entry }) => (
    <Pressable onPress={() => onOpenEntry(item.id)}>
      <Card theme={theme} style={styles.itemCard}>
        <View style={styles.itemRow}>
          <View style={[styles.dateBadge, { backgroundColor: theme.cardAlt }]}>
            <Text style={[styles.dateBadgeDay, { color: theme.text }]}>
              {item.date.slice(8, 10)}
            </Text>
            <Text style={[styles.dateBadgeMon, { color: theme.textFaint }]}>
              {new Date(Number(item.date.slice(0, 4)), Number(item.date.slice(5, 7)) - 1, 1)
                .toLocaleString('en-US', { month: 'short' })
                .toUpperCase()}
            </Text>
          </View>
          <View style={styles.itemBody}>
            <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
              {item.subject || 'Lesson'}
            </Text>
            <Text style={[styles.itemMeta, { color: theme.textFaint }]} numberOfLines={1}>
              {subtitle(item)}
            </Text>
          </View>
          {item.photo ? (
            <Image source={{ uri: photoUri(item.photo) }} style={styles.thumb} />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={entries}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={styles.brandRow}>
              <Text style={[styles.brand, { color: theme.accent }]}>Hearth</Text>
              <Text style={[styles.yearLabel, { color: theme.textFaint }]}>{schoolYear.label} school year</Text>
            </View>

            {students.length > 1 && (
              <View style={styles.chips}>
                <Chip theme={theme} label="All" active={!activeId} onPress={() => updateSettings({ activeStudentId: 0 })} />
                {students.map((s) => (
                  <Chip
                    key={s.id}
                    theme={theme}
                    label={s.name}
                    active={activeId === s.id}
                    onPress={() => updateSettings({ activeStudentId: activeId === s.id ? 0 : s.id })}
                  />
                ))}
              </View>
            )}

            <Card theme={theme} style={styles.heroCard}>
              <View style={styles.heroRow}>
                <View style={styles.heroStat}>
                  <Text style={[styles.heroValue, { color: theme.text }]}>{dayCount}</Text>
                  <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
                    {target.days != null ? `of ${target.days} days` : 'school days'}
                  </Text>
                  {target.days != null && <ProgressBar theme={theme} pct={dayPct} />}
                </View>
                <View style={[styles.heroDivider, { backgroundColor: theme.border }]} />
                <View style={styles.heroStat}>
                  <Text style={[styles.heroValue, { color: theme.text }]}>{fmtHours(totalMin)}</Text>
                  <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
                    {target.hours != null ? `of ${target.hours} hours` : 'hours logged'}
                  </Text>
                  {target.hours != null && <ProgressBar theme={theme} pct={hourPct} />}
                </View>
              </View>
              <Text style={[styles.heroFoot, { color: theme.textFaint }]}>
                {target.label}
                {target.isDefault ? ' · set yours in Settings' : ''}
                {reached ? '  ·  Target reached 🎉' : ''}
              </Text>
            </Card>

            {!isPro && (
              <Pressable onPress={showPaywall}>
                <Card theme={theme} style={{ ...styles.limitCard, backgroundColor: theme.accentSoft }}>
                  <Text style={[styles.limitText, { color: theme.accent }]}>
                    {atFreeLimit
                      ? `Free plan is full (${FREE_ENTRY_LIMIT} entries). Go Pro for unlimited →`
                      : `${FREE_ENTRY_LIMIT - totalCount} free entries left. Go Pro for unlimited →`}
                  </Text>
                </Card>
              </Pressable>
            )}
            <View style={{ height: 14 }} />
          </View>
        }
        ListEmptyComponent={
          <Card theme={theme} style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📚</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {students.length === 0 ? 'Add your first student' : 'Log your first school day'}
            </Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
              {students.length === 0
                ? 'Tap ＋ to add a student. Then every lesson you log counts toward your attendance and hours.'
                : 'Tap ＋ after a lesson — date, hours, and subject are all it takes. Each day with an entry counts as a school day.'}
            </Text>
          </Card>
        }
      />
      <Pressable
        onPress={handleAdd}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityLabel="Log a lesson"
      >
        <Text style={[styles.fabPlus, { color: theme.isDark ? '#1C1512' : '#FFFFFF' }]}>＋</Text>
      </Pressable>
    </View>
  );
}

function Chip({ theme, label, active, onPress }: { theme: Theme; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? theme.accent : theme.card, borderColor: active ? theme.accent : theme.border },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? (theme.isDark ? '#1C1512' : '#FFFFFF') : theme.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ProgressBar({ theme, pct }: { theme: Theme; pct: number }) {
  return (
    <View style={[styles.barTrack, { backgroundColor: theme.cardAlt }]} accessibilityRole="progressbar">
      <View
        style={[
          styles.barFill,
          { backgroundColor: pct >= 1 ? theme.success : theme.accent, width: `${Math.round(pct * 100)}%` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 120 },
  brandRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  brand: { fontSize: 15, fontWeight: fonts.weight.bold, letterSpacing: 0.3 },
  yearLabel: { fontSize: 12, fontWeight: fonts.weight.medium },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: fonts.weight.medium },
  heroCard: { paddingVertical: 18 },
  heroRow: { flexDirection: 'row', alignItems: 'stretch' },
  heroStat: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  heroDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
  heroValue: { fontSize: 34, fontWeight: fonts.weight.bold, letterSpacing: -1 },
  heroLabel: { fontSize: 13, fontWeight: fonts.weight.medium, marginTop: 2, textAlign: 'center' },
  heroFoot: { fontSize: 12, textAlign: 'center', marginTop: 12 },
  barTrack: { alignSelf: 'stretch', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 10 },
  barFill: { height: '100%', borderRadius: 4 },
  limitCard: { marginTop: 10, paddingVertical: 12, borderWidth: 0 },
  limitText: { fontSize: 14, fontWeight: fonts.weight.semibold, textAlign: 'center' },
  itemCard: { marginBottom: 10, padding: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateBadge: { width: 52, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dateBadgeDay: { fontSize: 18, fontWeight: fonts.weight.bold },
  dateBadgeMon: { fontSize: 10, fontWeight: fonts.weight.semibold, letterSpacing: 0.5 },
  itemBody: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: fonts.weight.semibold },
  itemMeta: { fontSize: 13, marginTop: 2 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  emptyCard: { alignItems: 'center', paddingVertical: 30 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: fonts.weight.bold },
  emptyBody: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabPlus: { fontSize: 30, lineHeight: 34, fontWeight: fonts.weight.semibold },
});
