import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const ASKED_KEY = 'hearth.reviewAsked.v1';

async function askOnce(): Promise<void> {
  try {
    const asked = await AsyncStorage.getItem(ASKED_KEY);
    if (asked) return;
    if (!(await StoreReview.hasAction())) return;
    await AsyncStorage.setItem(ASKED_KEY, '1');
    setTimeout(() => {
      StoreReview.requestReview().catch(() => {});
    }, 1200);
  } catch {
    // never let review plumbing affect the log
  }
}

/**
 * Ask for an App Store rating exactly once, at a happy moment.
 * Trigger 1: right after the first saved entry, so early users see it.
 */
export async function maybeRequestReview(entryCount: number): Promise<void> {
  if (entryCount < 1) return;
  await askOnce();
}

/**
 * Trigger 2: right after a successful PDF export — the moment the app just
 * produced the thing they came for. Same once-only guard as trigger 1.
 */
export async function maybeRequestReviewAfterExport(): Promise<void> {
  await askOnce();
}
