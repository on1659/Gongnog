export function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function calcRecord(checkIn, checkOut, dateStr, s) {
  const inM = toMin(checkIn);
  const outM = toMin(checkOut);
  if (inM == null || outM == null) return { workMin: null, otMin: null, meals: 0 };
  if (outM <= inM) return { workMin: 0, otMin: 0, meals: 0 };

  const workMin = outM - inM;
  const dow = new Date(dateStr).getDay();
  const weekend = dow === 0 || dow === 6;

  const otMin = weekend
    ? Math.max(0, Math.min(s.maxOtMin, workMin))
    : Math.max(0, Math.min(s.maxOtMin, workMin - 540 - s.bufferMin));

  function overlap(start, end) {
    return Math.max(0, Math.min(outM, end) - Math.max(inM, start));
  }

  let meals = 0;
  if (weekend) {
    if (workMin >= s.mealWeekendMinMin) meals = 1;
  } else {
    if (overlap(s.mealMorningStart, s.mealMorningEnd) >= s.mealMinOverlap) meals++;
    if (overlap(s.mealEveningStart, s.mealEveningEnd) >= s.mealMinOverlap) meals++;
  }

  return { workMin, otMin, meals };
}

export function getMealPrice(dateStr, s) {
  const dow = new Date(dateStr).getDay();
  return (dow === 0 || dow === 6) ? s.mealPriceWeekend : s.mealPriceWeekday;
}
