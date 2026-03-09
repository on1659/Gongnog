import { writable } from 'svelte/store';

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
