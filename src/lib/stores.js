import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export const settings = writable({
  bufferMin: 60, maxOtMin: 240,
  mealPriceWeekday: 9000, mealPriceWeekend: 9000,
  mealMorningStart: 420, mealMorningEnd: 540,
  mealEveningStart: 1080, mealEveningEnd: 1260,
  mealMinOverlap: 60, mealWeekendMinMin: 60,
  accTheme: 'blue', bgTheme: 'light',
});

export const records = writable({});
export const currentView = writable('cal');
export const selectedDate = writable(null);
export const themePreview = writable({});
export const settingsDirty = writable(false);

// 커스텀 alert/confirm
export const dialogState = writable(null);

export function customAlert(message) {
  return new Promise(resolve => {
    dialogState.set({ type: 'alert', message, resolve });
  });
}

export function customConfirm(message) {
  return new Promise(resolve => {
    dialogState.set({ type: 'confirm', message, resolve });
  });
}

// ── 튜토리얼 ──
export const tutorialFlags = writable(0);
export const flagsLoaded = writable(false);

export const FLAG_BITS = {
  login: 1,
  dashboard: 2,
};

export function createHasSeenStore(tutorialKey) {
  return derived([tutorialFlags, flagsLoaded], ([$flags, $loaded]) => {
    const bit = FLAG_BITS[tutorialKey];
    if (bit && $loaded && ($flags & bit)) return true;
    if (!browser) return false;
    return localStorage.getItem(`tutorialSeen_${tutorialKey}`) === 'v1';
  });
}

export async function setSeen(tutorialKey) {
  if (browser) {
    localStorage.setItem(`tutorialSeen_${tutorialKey}`, 'v1');
  }
  const bit = FLAG_BITS[tutorialKey];
  if (bit) {
    tutorialFlags.update(f => f | bit);
    try {
      await fetch('/api/tutorial-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag: bit }),
      });
    } catch (e) { /* 비로그인이면 실패해도 무시 */ }
  }
}

export async function loadFlags() {
  try {
    const res = await fetch('/api/tutorial-flags');
    if (res.ok) {
      const data = await res.json();
      tutorialFlags.set(data.flags || 0);
      flagsLoaded.set(true);
    }
  } catch (e) { /* 비로그인 */ }
}
