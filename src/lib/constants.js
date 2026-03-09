export const HOLIDAYS = {
  "2026-01-01": "신정",
  "2026-01-28": "설날 연휴",
  "2026-01-29": "설날",
  "2026-01-30": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절",
  "2026-10-09": "한글날",
  "2026-12-25": "크리스마스",
};

export const WKKO = ["일","월","화","수","목","금","토"];

export function isWeekend(dateStr) {
  const d = new Date(dateStr).getDay();
  return d === 0 || d === 6;
}

export function fmtMin(m) {
  if (!m || m <= 0) return '0분';
  const h = Math.floor(m / 60), n = m % 60;
  return h > 0 ? `${h}h${n > 0 ? ' ' + n + 'm' : ''}` : n + '분';
}

export function fmtW(n) {
  return n.toLocaleString('ko-KR') + '원';
}

export function pad(y, m, d) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
