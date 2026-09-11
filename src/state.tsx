import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initPurchases, getIsPro } from './purchases';
import { getState } from './states';

export interface Settings {
  lockEnabled: boolean;
  /** Two-letter state code, '' until chosen. */
  stateCode: string;
  /** Custom targets; null = use the state table's number (or a sensible default). */
  targetDays: number | null;
  targetHours: number | null;
  /** Month the school year starts (1–12). Most states use July; families can change it. */
  yearStartMonth: number;
  /** Parent / teacher name printed on reports. */
  parentName: string;
  /** Last student the family was viewing (0 = all). */
  activeStudentId: number;
}

export const DEFAULT_SETTINGS: Settings = {
  lockEnabled: false,
  stateCode: '',
  targetDays: null,
  targetHours: null,
  yearStartMonth: 7,
  parentName: '',
  activeStudentId: 0,
};

export const SETTINGS_KEY = 'hearth.settings.v1';

/** Entries allowed on the free tier (roughly two weeks of daily logging). */
export const FREE_ENTRY_LIMIT = 14;

export interface Target {
  /** Annual school-day target, or null when neither the state nor the family set one. */
  days: number | null;
  /** Annual instructional-hour target, or null when neither the state nor the family set one. */
  hours: number | null;
  /** Human label for UI copy ("Missouri requirement" / "Custom target"). */
  label: string;
  source: 'state' | 'custom' | 'default';
  /** True when we're showing a generic default rather than a state or family number. */
  isDefault: boolean;
}

/**
 * Resolve the active attendance target. Only numbers that actually exist are
 * shown: a state with an hours rule but no days rule yields days = null, and
 * the UI hides that dimension rather than inventing a figure for a document
 * a family may hand to a district.
 */
export function resolveTarget(settings: Settings): Target {
  const st = getState(settings.stateCode);
  const stateDays = st?.requiredDays ?? null;
  const stateHours = st?.requiredHours ?? null;
  const custom = settings.targetDays != null || settings.targetHours != null;
  if (custom) {
    return {
      days: settings.targetDays ?? stateDays,
      hours: settings.targetHours ?? stateHours,
      label: 'Custom target',
      source: 'custom',
      isDefault: false,
    };
  }
  if (st && (stateDays != null || stateHours != null)) {
    return { days: stateDays, hours: stateHours, label: `${st.name} requirement`, source: 'state', isDefault: false };
  }
  if (st) {
    return { days: null, hours: null, label: `${st.name} · no statewide number`, source: 'default', isDefault: true };
  }
  return { days: 180, hours: null, label: 'Default target', source: 'default', isDefault: true };
}

/** Local YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface SchoolYear {
  from: string;
  to: string;
  label: string;
}

/** The school year containing `date` given the configured start month. */
export function schoolYearFor(date: string, startMonth: number): SchoolYear {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const startYear = m >= startMonth ? y : y - 1;
  const p = (n: number) => String(n).padStart(2, '0');
  const from = `${startYear}-${p(startMonth)}-01`;
  // Last day of the month before the next start.
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endYear = startMonth === 1 ? startYear : startYear + 1;
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  const to = `${endYear}-${p(endMonth)}-${p(lastDay)}`;
  const label = startMonth === 1 ? String(startYear) : `${startYear}–${String(endYear).slice(2)}`;
  return { from, to, label };
}

interface AppState {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  target: Target;
  schoolYear: SchoolYear;
  isPro: boolean;
  setIsPro: (v: boolean) => void;
  refreshPro: () => Promise<void>;
  paywallVisible: boolean;
  showPaywall: () => void;
  hidePaywall: () => void;
  ready: boolean;
  /** Bumped whenever entry/student data changes, so screens refetch. */
  dataVersion: number;
  bumpData: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isPro, setIsPro] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      } catch {
        // corrupted settings -> defaults
      }
      try {
        await initPurchases();
        setIsPro(await getIsPro());
      } catch {
        setIsPro(false);
      }
      setReady(true);
    })();
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const refreshPro = useCallback(async () => {
    setIsPro(await getIsPro());
  }, []);

  const target = useMemo(() => resolveTarget(settings), [settings]);
  const schoolYear = useMemo(
    () => schoolYearFor(todayIso(), settings.yearStartMonth),
    [settings.yearStartMonth]
  );

  const value = useMemo<AppState>(
    () => ({
      settings,
      updateSettings,
      target,
      schoolYear,
      isPro,
      setIsPro,
      refreshPro,
      paywallVisible,
      showPaywall: () => setPaywallVisible(true),
      hidePaywall: () => setPaywallVisible(false),
      ready,
      dataVersion,
      bumpData: () => setDataVersion((v) => v + 1),
    }),
    [settings, updateSettings, target, schoolYear, isPro, refreshPro, paywallVisible, ready, dataVersion]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
