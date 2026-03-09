# 공무원 근무기록 웹앱 — CLAUDE.md

> Claude Code가 이 파일을 기준으로 앱을 구현한다.
> 모든 규칙·계산식은 이 문서가 최우선이다.
> 디자인은 mockup_ios.html 참고, DB/계산은 이 문서 기준.

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 목적 | 공무원 출퇴근·초과근무·급량비 기록 디지털화 |
| 플랫폼 | 반응형 웹 (모바일 우선, PC 지원) |
| 배포 | Railway (adapter-node) |
| DB | PostgreSQL (Railway 플러그인) |
| 인증 | 아이디/비밀번호, 사용자별 데이터 완전 분리 |

---

## 기술 스택

```
프레임워크 : SvelteKit (Svelte 4 + Vite)
어댑터   : @sveltejs/adapter-node (Railway 배포용)
인증     : express-session 대신 커스텀 세션 (cookie + pg)
         또는 svelte-kit-cookie-session
DB       : PostgreSQL (pg 라이브러리)
암호화   : bcryptjs (네이티브 빌드 불필요)
차트     : Chart.js (CDN 또는 npm)
엑셀     : SheetJS xlsx (CDN 또는 npm)
스타일   : 바닐라 CSS (themes.css + app.css, 빌드 없는 CSS)
폰트     : Noto Sans KR (Google Fonts)
```

> ⚠️ `bcrypt` 아님. `bcryptjs` 사용 (Railway에서 네이티브 빌드 실패 방지)

---

## Railway 설정

### 환경변수

| 키 | 값 | 비고 |
|----|-----|------|
| `DATABASE_URL` | (자동 주입) | Railway PostgreSQL 플러그인 |
| `SESSION_SECRET` | 랜덤 32자 이상 | 직접 입력 |
| `NODE_ENV` | `production` | 직접 입력 |
| `ORIGIN` | `https://your-app.up.railway.app` | SvelteKit CSRF 보호용 |

### 빌드 & 시작
```
Build Command: npm run build
Start Command: node build/index.js
```

---

## 파일 구조

```
/
├── src/
│   ├── lib/
│   │   ├── server/
│   │   │   ├── db.js              # PostgreSQL 연결 & 초기화
│   │   │   ├── auth.js            # 세션/인증 유틸
│   │   │   └── calc.js            # 서버사이드 계산 함수
│   │   ├── calc.js                # 클라이언트 계산 (순수함수, 미리보기용)
│   │   ├── constants.js           # 공휴일, 유틸
│   │   └── stores.js              # Svelte stores (settings, records, theme)
│   ├── routes/
│   │   ├── +layout.svelte         # 공통 레이아웃 (#app 래퍼, 테마 클래스)
│   │   ├── +layout.server.js      # 세션 체크, settings 로드
│   │   ├── +page.svelte           # 메인 (캘린더/통계/설정 탭)
│   │   ├── +page.server.js        # 월별 records 로드
│   │   ├── login/
│   │   │   ├── +page.svelte       # 로그인/회원가입 화면
│   │   │   └── +page.server.js    # 세션 체크 → 로그인 상태면 / 로 redirect
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/+server.js
│   │       │   ├── register/+server.js
│   │       │   ├── logout/+server.js
│   │       │   └── me/+server.js
│   │       ├── records/
│   │       │   ├── +server.js          # GET (월별), PUT은 [date]
│   │       │   └── [date]/+server.js   # PUT (upsert), DELETE
│   │       └── settings/
│   │           └── +server.js          # GET, PUT
│   ├── app.html                   # HTML 쉘
│   └── app.css                    # 전역 스타일 (themes.css 내용 포함)
├── static/
│   └── (필요시 정적 파일)
├── package.json
├── svelte.config.js
├── vite.config.js
└── Procfile
```

---

## package.json

```json
{
  "name": "gongnog",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node build/index.js"
  },
  "devDependencies": {
    "@sveltejs/adapter-node": "^2.0.0",
    "@sveltejs/kit": "^2.0.0",
    "svelte": "^4.0.0",
    "vite": "^5.0.0"
  },
  "dependencies": {
    "pg": "^8.11.0",
    "bcryptjs": "^2.4.3",
    "cookie": "^0.6.0"
  }
}
```

### Procfile
```
web: node build/index.js
```

### svelte.config.js
```js
import adapter from '@sveltejs/adapter-node';

export default {
  kit: {
    adapter: adapter({
      envPrefix: ''
    })
  }
};
```

---

## DB 스키마 (src/lib/server/db.js)

서버 시작 시 테이블 자동 생성.

```sql
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  user_id              INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  buffer_min           INTEGER DEFAULT 60,
  max_ot_min           INTEGER DEFAULT 240,
  meal_price_weekday   INTEGER DEFAULT 9000,
  meal_price_weekend   INTEGER DEFAULT 9000,
  meal_morning_start   INTEGER DEFAULT 420,
  meal_morning_end     INTEGER DEFAULT 540,
  meal_evening_start   INTEGER DEFAULT 1080,
  meal_evening_end     INTEGER DEFAULT 1260,
  meal_min_overlap     INTEGER DEFAULT 60,
  meal_weekend_min_min INTEGER DEFAULT 60,
  acc_theme            TEXT DEFAULT 'blue',
  bg_theme             TEXT DEFAULT 'light'
);

CREATE TABLE IF NOT EXISTS records (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  check_in   TIME,
  check_out  TIME,
  work_min      INTEGER,
  ot_min        INTEGER,
  meals         INTEGER DEFAULT 0,
  meal_expense  INTEGER DEFAULT 0,
  memo          TEXT DEFAULT '',
  UNIQUE(user_id, date)
);
```

### DB 연결

```js
// src/lib/server/db.js
import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

export async function init() {
  // 위 CREATE TABLE 쿼리 실행
}
```

---

## 인증 (세션 기반)

SvelteKit에서는 express-session 대신 커스텀 쿠키 세션 사용.

```js
// src/lib/server/auth.js
import { pool } from './db.js';
import crypto from 'crypto';

export function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(userId) {
  const id = generateSessionId();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30일
  await pool.query(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [id, userId, expiresAt]
  );
  return { id, expiresAt };
}

export async function validateSession(sessionId) {
  if (!sessionId) return null;
  const r = await pool.query(
    'SELECT s.user_id, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = $1 AND s.expires_at > NOW()',
    [sessionId]
  );
  return r.rows[0] || null;
}

export async function deleteSession(sessionId) {
  await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}
```

### 로그인 API에서 쿠키 설정 (중요!)
```js
// src/routes/api/auth/login/+server.js 내부
const session = await createSession(user.id);

// ⚠️ 쿠키 속성 반드시 명시 (누락 시 보안 취약 또는 동작 안 함)
event.cookies.set('session', session.id, {
  path: '/',              // 전체 사이트
  httpOnly: true,         // JS 접근 차단
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',        // CSRF 보호
  maxAge: 30 * 24 * 60 * 60  // 30일 (초 단위)
});

// 로그아웃 시:
// event.cookies.delete('session', { path: '/' });
```

### hooks.server.js (전역 인증 미들웨어)
```js
// src/hooks.server.js
import { validateSession } from '$lib/server/auth.js';
import { init } from '$lib/server/db.js';

// 서버 시작 시 DB 초기화
await init();

export async function handle({ event, resolve }) {
  const sessionId = event.cookies.get('session');
  const user = await validateSession(sessionId);
  event.locals.user = user; // { user_id, username } or null

  return resolve(event);
}
```

---

## API 설계

### 인증

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET  | `/api/auth/me` | 현재 세션 확인 |

```
POST /api/auth/register  body: { username, password }
→ 성공: { ok: true, username }  + Set-Cookie: session=...
→ 실패: { ok: false, message: "이미 존재하는 아이디입니다." }

POST /api/auth/login  body: { username, password }
→ 성공: { ok: true, username }  + Set-Cookie: session=...
→ 실패: { ok: false, message: "아이디 또는 비밀번호가 틀렸습니다." }

회원가입 성공 시 settings 테이블에 기본값 행 INSERT
```

### 근무 기록

| Method | Path | 설명 |
|--------|------|------|
| GET    | `/api/records?year=YYYY&month=M` | 월별 전체 조회 |
| PUT    | `/api/records/:date` | 저장 (upsert) |
| DELETE | `/api/records/:date` | 삭제 |

```
PUT /api/records/2026-03-05
body: { checkIn, checkOut, mealExpense, memo }
→ 서버에서 사용자 설정 조회 → calcRecord() 재계산 → upsert
→ 클라이언트가 보낸 계산값(workMin, otMin, meals)은 무시

GET /api/records?year=2026&month=3  응답:
{
  "2026-03-02": {
    "checkIn": "08:00",
    "checkOut": "18:00",
    "workMin": 600,
    "otMin": 0,
    "meals": 1,
    "mealExpense": 7500,
    "memo": ""
  },
  ...
}

PUT /api/records/:date  성공 응답:
{
  "ok": true,
  "record": { "checkIn", "checkOut", "workMin", "otMin", "meals", "mealExpense", "memo" }
}
```

```sql
-- upsert 쿼리
INSERT INTO records (user_id, date, check_in, check_out, work_min, ot_min, meals, meal_expense, memo)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (user_id, date)
DO UPDATE SET
  check_in     = EXCLUDED.check_in,
  check_out    = EXCLUDED.check_out,
  work_min     = EXCLUDED.work_min,
  ot_min       = EXCLUDED.ot_min,
  meals        = EXCLUDED.meals,
  meal_expense = EXCLUDED.meal_expense,
  memo         = EXCLUDED.memo;
```

### 설정

| Method | Path | 설명 |
|--------|------|------|
| GET  | `/api/settings` | 설정 조회 |
| PUT  | `/api/settings` | 설정 저장 (부분 업데이트) |

```
GET /api/settings 응답 (camelCase):
{
  bufferMin: 60, maxOtMin: 240,
  mealPriceWeekday: 9000, mealPriceWeekend: 9000,
  mealMorningStart: 420, mealMorningEnd: 540,
  mealEveningStart: 1080, mealEveningEnd: 1260,
  mealMinOverlap: 60, mealWeekendMinMin: 60,
  accTheme: 'blue', bgTheme: 'light'
}

PUT /api/settings body (변경 필드만):
{ bufferMin: 90, accTheme: "purple" }
```

> `/api/records/*`, `/api/settings/*` 는 세션 없으면 `401` 반환.

---

## 핵심 계산 규칙 ⚠️

> 설정값은 DB에서 읽어온다. 하드코딩 금지.
> **540은 예외: 고정값. 설정으로 빼지 말 것.**

### 초과근무

```
기준 근무시간  = 540분 (9시간, 점심포함, 고정)
bufferMin     = 평일 자동공제 시간 (기본 60분)

평일: max(0, min(maxOtMin, 근무시간 - 540 - bufferMin))
주말: max(0, min(maxOtMin, 근무시간))
```

### 급량비

```
평일:
  overlap(근무, [mealMorningStart, mealMorningEnd]) >= mealMinOverlap → +1회
  overlap(근무, [mealEveningStart, mealEveningEnd]) >= mealMinOverlap → +1회
  overlap(a, b) = max(0, min(퇴근, b) - max(출근, a))

주말:
  근무시간 >= mealWeekendMinMin → +1회
```

### 서버사이드 calc 함수

```js
// src/lib/server/calc.js
export function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function calcRecord(checkIn, checkOut, dateStr, s) {
  const inM  = toMin(checkIn);
  const outM = toMin(checkOut);
  if (inM == null || outM == null) return { workMin: null, otMin: null, meals: 0 };
  if (outM <= inM) return { workMin: 0, otMin: 0, meals: 0 };

  const workMin = outM - inM;
  const dow = new Date(dateStr).getDay();
  const weekend = dow === 0 || dow === 6;

  // 540 = 9시간(점심포함) 고정. bufferMin만 설정값.
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
```

### 클라이언트 calc (미리보기용 — 동일 로직)

```js
// src/lib/calc.js — 서버 calc.js와 동일 로직
// Svelte 컴포넌트에서 $: reactive로 호출
export function calcRecord(checkIn, checkOut, dateStr, settings) { ... }
export function getMealPrice(dateStr, settings) { ... }
```

### 케이스 검증 (기본값: bufferMin=60, maxOtMin=240)

| 케이스 | 출근 | 퇴근 | 근무 | 초과 | 급량 |
|--------|------|------|------|------|------|
| 평일1 | 08:00 | 18:00 | 600분 | 0분 | 1회 |
| 평일2 | 08:00 | 19:00 | 660분 | 60분 | 2회 |
| 평일3 | 08:00 | 24:00 | 960분 | 240분 | 2회 |
| 주말4 | 08:00 | 18:00 | 600분 | 240분 | 1회 |
| 주말5 | 08:00 | 08:30 | 30분 | 30분 | 0회 |
| 엣지: 출근>퇴근 | 18:00 | 08:00 | 0분 | 0분 | 0회 |

---

## Svelte 컴포넌트 구조

```
+layout.svelte          → #app 래퍼, 테마 클래스 (acc-{theme} bg-{theme})
+page.svelte            → 3탭 뷰 전환 (캘린더/통계/설정)
  ├── Calendar.svelte   → 캘린더 그리드 + 요약 스트립 + 상세 영역
  ├── DaySheet.svelte   → 날짜 클릭 Bottom Sheet (간략 정보)
  ├── RecordModal.svelte→ 입력/편집 Bottom Sheet
  ├── Stats.svelte      → 통계 뷰 + Chart.js
  ├── Settings.svelte   → 설정 뷰 + 테마 전환
  └── BottomBar.svelte  → 하단 고정 바
login/+page.svelte      → 로그인/회원가입
```

### Svelte Stores (src/lib/stores.js)

```js
import { writable } from 'svelte/store';

export const settings = writable({
  bufferMin: 60, maxOtMin: 240,
  mealPriceWeekday: 9000, mealPriceWeekend: 9000,
  mealMorningStart: 420, mealMorningEnd: 540,
  mealEveningStart: 1080, mealEveningEnd: 1260,
  mealMinOverlap: 60, mealWeekendMinMin: 60,
  accTheme: 'blue', bgTheme: 'light',
});

export const records = writable({});     // { "2026-03-05": { ... } }
export const currentView = writable('cal'); // 'cal' | 'stats' | 'settings'
export const selectedDate = writable(null);
```

### Reactive 패턴 예시 (RecordModal.svelte)

```svelte
<script>
  import { settings } from '$lib/stores.js';
  import { calcRecord, getMealPrice } from '$lib/calc.js';

  export let date;
  export let record = null;
  export let open = false;

  let checkIn = record?.checkIn || '08:00';
  let checkOut = record?.checkOut || '18:00';
  let expense = record?.mealExpense || 0;

  // 실시간 계산 — 값 바뀌면 자동 재계산
  $: calc = calcRecord(checkIn, checkOut, date, $settings);
  $: mealPrice = getMealPrice(date, $settings);
  $: income = (calc.meals || 0) * mealPrice;
  $: net = income - expense;
</script>

<input type="time" bind:value={checkIn} />
<input type="time" bind:value={checkOut} />
<span>{calc.workMin}</span>  <!-- 자동 업데이트 -->
```

---

## 공휴일 데이터 (src/lib/constants.js)

```js
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

export const WKKO = ["일", "월", "화", "수", "목", "금", "토"];

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
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
```

---

## 디자인 가이드

### 확정 레퍼런스
- **mockup_ios.html** — 최종 확정 목업. 이 파일의 CSS/레이아웃 기준으로 구현.
- **themes.css** — 색상 변수 정의 파일. 이것을 app.css 상단에 포함.
- iOS 캘린더 스타일 (큰 월 숫자, 이벤트 바, 하단 상세 슬라이드)

### 테마 시스템

액센트 컬러(6종)와 배경 테마(4종)를 독립 선택.
`#app` 엘리먼트에 클래스 조합으로 적용: `class="acc-blue bg-light"`

테마 변수 정의는 `themes.css` 파일 참조.
`app.css`(=style.css)에는 색상 하드코딩 절대 금지. 반드시 CSS 변수만 사용.

### Svelte에서 테마 적용

```svelte
<!-- +layout.svelte -->
<script>
  import { settings } from '$lib/stores.js';
</script>

<div id="app" class="acc-{$settings.accTheme} bg-{$settings.bgTheme}">
  <slot />
</div>
```

### 레이아웃
```
max-width: 390px
font: 'Noto Sans KR'
height: 100vh, overflow:hidden (캘린더 뷰)
```

### 화면별 구조

#### 로그인 (login/+page.svelte)
- 하단 정렬, 타이포 중심
- 큰 볼드 "근무" + 라이트 "기록" 두 줄
- 아이디/비밀번호 언더라인 input
- 로그인/회원가입 토글 (같은 화면)

#### 앱 공통 헤더 (캘린더 뷰)
```
1줄 (우측 정렬):           [닉네임칩(아바타+이름)] [↩ 로그아웃]
2줄 좌측:  [2026년]
           [큰 월 숫자 — font-weight:300]
2줄 우측:                                [‹] [›] [📊] [⚙️]
[요약 스트립: 총근무 | 초과 | 급량 수지]
[월 화 수 목 금 토 일]
```

#### 캘린더 그리드
- 월요일 시작 (월~일)
- 셀 최소높이: 62px
- 오늘: `background: var(--today-bg)`, 숫자 흰색
- 선택: `background: var(--acc-soft)`, 테두리 `var(--acc)`
- 이벤트 바 3줄: 초과(var(--ot-c)) / 출근(var(--acc)) / 급량수지(양수 var(--meal-c) 음수 var(--neg-c))

#### 날짜 클릭 → Day Sheet (DaySheet.svelte)
- Bottom Sheet 형태
- 기록 있으면: 근무 카드 + 급량비 수지 카드 + ✏️ 편집
- 기록 없으면: ＋ 기록 입력 버튼
- 편집 → Day Sheet 닫힘 → RecordModal 열림

#### 입력 모달 (RecordModal.svelte)
```
출퇴근 시간 (2칸 grid)
  └ 실시간 계산 chips: 근무시간 | 초과근무 | 급량 횟수
실제 식비 지출 (1칸)
급량비 수지 미리보기 (수령액 / 식비 지출 / 순수 수지)
메모 (선택)
[삭제] [취소] [저장]
```
> "수입" 대신 **"수령액"** 사용

#### 하단 바 (BottomBar.svelte)
```
[＋ 기록 입력]        [캘린더 | 통계 | 설정]
```

#### 통계 뷰 (Stats.svelte)
- 2x2 sbox: 총 근무시간 / 초과근무 / 급량비 수령액 / 급량 수지
- Chart.js 스택 바 차트 (근무 var(--acc) + 초과 var(--ot-c))
- 수지 상세: 수령액 합계 / 식비 지출 합계 / 순수 수지
- 엑셀 / CSV 버튼

#### 설정 뷰 (Settings.svelte)
```
[액센트 컬러] — 6종 스와치
[배경 테마]   — 4종 스와치
[초과근무 규칙] — 자동공제 / 최대 초과
[급량비 단가]   — 평일 / 주말
[평일 급량비 시간] — 오전구간 / 오후구간 / 최소근무
[주말 급량비 조건] — 최소 근무시간
[안내 박스]
[저장 버튼]
```

### 색상 사용 규칙

| 용도 | 변수 |
|------|------|
| 메인 강조 | `var(--acc)` |
| 초과근무 | `var(--ot-c)` |
| 급량비/양수 | `var(--meal-c)` |
| 음수/삭제 | `var(--neg-c)` |
| 일요일/공휴일 | `var(--sun-c)` |
| 토요일 | `var(--sat-c)` |
| 칩-초과 배경 | `var(--chip-ot-bg)` |
| 칩-급량 배경 | `var(--chip-meal-bg)` |
| 공휴일 뱃지 배경 | `var(--holiday-bg)` |

> **app.css 내 색상 하드코딩 금지. #fff (흰색 텍스트) 외 전부 CSS 변수.**

---

## 구현 순서

```
1단계: 프로젝트 초기화
  - npx sv create (SvelteKit skeleton)
  - adapter-node, pg, bcryptjs 설치
  - svelte.config.js, vite.config.js 설정
  - Procfile 작성

2단계: DB + 인증
  - src/lib/server/db.js (Pool, 테이블 자동 생성)
  - src/lib/server/auth.js (세션 생성/검증/삭제)
  - src/hooks.server.js (전역 인증 미들웨어)
  - src/routes/api/auth/* (login, register, logout, me)
  - src/routes/login/+page.svelte

3단계: 설정 API + 스토어
  - src/routes/api/settings/+server.js
  - src/lib/stores.js
  - src/lib/constants.js

4단계: 근무기록 API
  - src/routes/api/records/* (서버사이드 calcRecord 포함)
  - src/lib/server/calc.js + src/lib/calc.js
  - 케이스 1~6 검증

5단계: 테마 + 스타일
  - themes.css 내용 → app.css 상단
  - app.css (목업 CSS 전체 이식, 변수만 사용)
  - +layout.svelte (테마 클래스 바인딩)

6단계: 캘린더 + 모달
  - Calendar.svelte
  - DaySheet.svelte
  - RecordModal.svelte
  - BottomBar.svelte

7단계: 통계 + 설정 + 내보내기
  - Stats.svelte (Chart.js)
  - Settings.svelte (테마 스와치 + 설정 폼)
  - 엑셀/CSV 내보내기 (SheetJS)

8단계: Railway 배포
  - npm run build → build/ 생성 확인
  - ORIGIN, DATABASE_URL, SESSION_SECRET, NODE_ENV 설정
  - railway up 또는 GitHub 연결
```

---

## 주의사항

- `pg` 라이브러리는 async/await 사용
- `pg`는 CommonJS — SvelteKit에서 `import pg from 'pg'; const { Pool } = pg;` 패턴 사용
- SQL 파라미터는 반드시 `$1, $2` 형식 (SQL injection 방지)
- `bcryptjs` saltRounds = 10 (bcrypt 아님)
- 시간 입력 24시간제 `"HH:MM"` 고정
- 자정 이후 퇴근 미지원 (outM <= inM → workMin=0 처리)
- **Chart.js / SheetJS는 브라우저 전용.** `onMount()` 안에서 dynamic import 하거나, `{#if browser}` 가드 필수. SSR 단계에서 import하면 `canvas is not defined` 에러 발생.
  ```js
  // Stats.svelte
  import { onMount, onDestroy } from 'svelte';
  let chart;
  onMount(async () => {
    const { Chart } = await import('chart.js/auto');
    chart = new Chart(canvas, { ... });
  });
  onDestroy(() => { chart?.destroy(); });
  ```
- 설정 변경은 이후 저장 기록부터 적용 (기존 기록 재계산 없음)
- **목업(mockup_ios.html)의 JS/DB는 디자인 참고용.** 실제 DB 스키마와 계산은 이 문서 기준. 식비는 `meal_expense` 단일 필드 (목업의 expB/L/D/E 4분할 무시)
- **app.css에 색상 하드코딩 금지.** 칩/공휴일 배경도 CSS 변수 사용
- **settings 로드 후 캘린더 렌더링.** 급량비 단가 등 설정값이 없으면 수지 표시 불가
- SvelteKit의 `$:` reactive statement로 liveCalc 구현 (수동 호출 불필요)
- `+server.js`에서 인증 체크: `if (!event.locals.user) return new Response(null, { status: 401 })`

---

## app.html 템플릿

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <title>근무기록</title>
  %sveltekit.head%
</head>
<body>
  <div style="display:contents">%sveltekit.body%</div>
</body>
</html>
```

---

## 구현 체크리스트

### 서버
- [ ] bcryptjs 사용 확인
- [ ] sessions 테이블로 커스텀 세션 (express-session 아님)
- [ ] hooks.server.js에서 전역 인증
- [ ] upsert에 meal_expense 포함
- [ ] calcRecord: outM <= inM 가드
- [ ] 540 하드코딩 확인 (설정값으로 빠지면 안 됨)
- [ ] settings camelCase ↔ snake_case 변환
- [ ] 쿠키 속성: httpOnly, secure, sameSite, path

### 프론트
- [ ] 테마 클래스 +layout.svelte에서 바인딩
- [ ] app.css에 색상 하드코딩 없음 (#fff 제외)
- [ ] $: reactive로 실시간 계산
- [ ] Chart.js / SheetJS onMount() 내 dynamic import (SSR 방지)
- [ ] Chart.js onDestroy에서 destroy()
- [ ] 주말 급량비 조건 설정 UI 포함

### 배포
- [ ] adapter-node 설정
- [ ] Procfile: web: node build/index.js
- [ ] ORIGIN 환경변수 (CSRF)
- [ ] DATABASE_URL, SESSION_SECRET, NODE_ENV

---

*작성일: 2026-03-10 | 버전: 4.0 (SvelteKit + PostgreSQL + Railway)*
