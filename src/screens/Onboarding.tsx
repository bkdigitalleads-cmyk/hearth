import React, { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, fonts } from '../theme';
import { PillButton } from '../components';
import { useApp } from '../state';
import { addStudent } from '../db';
import { STATES } from '../states';

const { width } = Dimensions.get('window');

/**
 * Stored locally only (never leaves the device). Doubles as backup
 * attribution and as a future paywall-routing signal by traffic source.
 */
export const SOURCE_KEY = 'hearth.source.v1';

const SOURCES = [
  'App Store search',
  'Google search',
  'Homeschool group or co-op',
  'TikTok / Instagram / YouTube',
  'Somewhere else',
];

const SLIDES: { icon: string; title: string; body: string }[] = [
  {
    icon: '📚',
    title: 'Every school day,\nlogged in seconds',
    body: 'Tap ＋ after a lesson — date, hours, subject, and a photo of the work. Each day with an entry counts toward attendance.',
  },
  {
    icon: '🎯',
    title: 'Know exactly where\nyou stand',
    body: 'Pick your state and Hearth sets the days and hours target from its published rules — or set your own. Watch it fill up.',
  },
  {
    icon: '📄',
    title: 'Records ready\nwhen someone asks',
    body: 'One tap creates an attendance & hours log with a signature line, or a portfolio with your work samples. No spreadsheet night.',
  },
];

// Slides are skipped: the paywall now opens first (Young, Gate 3), then these steps.
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const { updateSettings, bumpData } = useApp();
  const [page, setPage] = useState(0);
  const [step, setStep] = useState<'slides' | 'student' | 'state' | 'source'>('student');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const last = page === SLIDES.length - 1;

  const next = () => {
    if (last) {
      setStep('student');
      return;
    }
    const target = page + 1;
    scrollRef.current?.scrollTo({ x: target * width, animated: true });
    setPage(target);
  };

  const saveStudent = async () => {
    if (!name.trim()) {
      Alert.alert('Who are you teaching?', 'A first name is plenty — you can add more students later.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const s = await addStudent(name);
      if (s) updateSettings({ activeStudentId: s.id }).catch(() => {});
      bumpData();
      setStep('state');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const pickState = (code: string) => {
    updateSettings({ stateCode: code }).catch(() => {});
    setStep('source');
  };

  const pickSource = (source: string) => {
    AsyncStorage.setItem(SOURCE_KEY, source).catch(() => {});
    onDone();
  };

  if (step === 'student') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sourceWrap}>
          <Text style={[styles.title, { color: theme.text }]}>Who are you teaching?</Text>
          <Text style={[styles.body, { color: theme.textSecondary, marginTop: 8 }]}>
            Add one student now. More can be added any time in Settings.
          </Text>
          <TextInput
            style={[styles.nameInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            value={name}
            onChangeText={setName}
            placeholder="Student's first name"
            placeholderTextColor={theme.textFaint}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saveStudent}
          />
          <View style={{ marginTop: 20 }}>
            <PillButton theme={theme} label="Continue" onPress={saveStudent} />
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'state') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.goalWrap}>
          <Text style={[styles.title, { color: theme.text }]}>Which state?</Text>
          <Text style={[styles.body, { color: theme.textSecondary, marginTop: 8 }]}>
            We'll set your days and hours target from your state's published rules. Change it any time.
          </Text>
        </View>
        <FlatList
          data={STATES}
          keyExtractor={(s) => s.code}
          contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => pickState(item.code)}
              style={({ pressed }) => [
                styles.goalBtn,
                { backgroundColor: pressed ? theme.accentSoft : theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.goalName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.goalReq, { color: theme.textFaint }]}>
                {item.requiredDays != null ? `${item.requiredDays}d` : ''}
                {item.requiredDays != null && item.requiredHours != null ? ' · ' : ''}
                {item.requiredHours != null ? `${item.requiredHours}h` : ''}
              </Text>
            </Pressable>
          )}
          ListFooterComponent={
            <Pressable onPress={() => setStep('source')} style={{ paddingVertical: 16 }}>
              <Text style={[styles.skip, { color: theme.textFaint }]}>Skip for now</Text>
            </Pressable>
          }
        />
      </View>
    );
  }

  if (step === 'source') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.sourceWrap}>
          <Text style={[styles.title, { color: theme.text }]}>Where did you hear about Hearth?</Text>
          <Text style={[styles.body, { color: theme.textSecondary, marginTop: 10 }]}>
            One tap — it helps us make the app better.
          </Text>
          <View style={styles.sourceList}>
            {SOURCES.map((s) => (
              <Pressable
                key={s}
                onPress={() => pickSource(s)}
                style={({ pressed }) => [
                  styles.sourceBtn,
                  { backgroundColor: pressed ? theme.accentSoft : theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.sourceText, { color: theme.text }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.slide, { width }]}>
            <Text style={styles.icon}>{s.icon}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{s.title}</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === page ? theme.accent : theme.border }]} />
          ))}
        </View>
        <PillButton theme={theme} label={last ? 'Set up my records' : 'Continue'} onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  icon: { fontSize: 56, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: fonts.weight.bold, letterSpacing: -0.5, textAlign: 'center', marginBottom: 14 },
  body: { fontSize: 17, lineHeight: 25, textAlign: 'center' },
  footer: { padding: 24, paddingBottom: 40, gap: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  goalWrap: { paddingTop: 40, paddingHorizontal: 32, paddingBottom: 16 },
  goalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  goalName: { fontSize: 16, fontWeight: fonts.weight.medium },
  goalReq: { fontSize: 13 },
  skip: { fontSize: 15, textAlign: 'center', fontWeight: fonts.weight.medium },
  nameInput: { marginTop: 24, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18 },
  sourceWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  sourceList: { marginTop: 28, gap: 12 },
  sourceBtn: { borderRadius: 14, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 18 },
  sourceText: { fontSize: 17, fontWeight: fonts.weight.medium },
});
