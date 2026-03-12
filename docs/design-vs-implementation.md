# 공노기 — 설계와 구현 사이: 무엇이 달라졌나

> **공노기(Gongnog)** 는 공무원 출퇴근·초과근무·급량비 기록을 위한 반응형 웹앱이다.
> SvelteKit + PostgreSQL + Railway로 구성되며, 모바일 우선 설계를 따른다.
>
> 이 문서는 최초 설계 명세(CLAUDE.md)와 실제 구현 사이에서 **무엇이 추가되고, 무엇이 바뀌었으며, 왜 그런 결정을 내렸는지** 를 기록한다.
> 단순한 changelog가 아니라, **실전 개발에서 설계가 현실과 부딪히는 지점**을 솔직하게 담았다.

---

## 0. 한눈에 보는 차이점 요약

| 영역 | 설계 (CLAUDE.md) | 실제 구현 | 변화 성격 |
|------|-----------------|-----------|-----------|
| DB 스키마 | 4개 테이블 | 4개 + `tutorial_flags` 컬럼 추가 | 기능 확장 |
| 캘린더 요일 순서 | 월~일 | **일~토** (일요일 시작) | 스펙 변경 |
| Svelte Stores | 4개 기본 store | +5개 store, +4개 헬퍼 함수 | 대폭 확장 |
| 컴포넌트 수 | 7개 | +2개 (CustomDialog, Tutorial) | 신규 추가 |
| DaySheet 방식 | "Bottom Sheet 형태" (애매) | **오버레이 슬라이드업** (A안 확정) | 구체화 |
| 날짜 클릭 → 상세 | DaySheet → 편집 버튼 → RecordModal | + **퀵 액션 버튼** (출근/퇴근/식사) | 기능 추가 |
| 퀵 클록 | 없음 | 시간 확인 팝업 + ±분 조절 버튼 | 신규 |
| 튜토리얼 | 없음 | **스포트라이트 튜토리얼 시스템** | 신규 |
| `fmtMin` 형식 | `"1h 30m"` (영문) | **`"1시간 30분"`** (한글) | 포맷 변경 |
| `fmtTime` | 없음 | `"8시 00분"` 형식 추가 | 신규 유틸 |
| 스플래시 화면 | 없음 | 앱 아이콘 + 이름 | 신규 |
| 토스트 알림 | 없음 | 퀵 액션 결과 피드백 | 신규 |
| 뒤로가기 지원 | 없음 | popstate 핸들링 + 설정 미저장 확인 | 신규 |
| 브라우저 alert | 기본 `window.alert/confirm` | **CustomDialog** (테마 적용 가능) | 대체 |
| 미래 날짜 기록 | 차단 안 함 | **차단** (오늘 이전 날짜만 허용) | 신규 제약 |
| 확대 방지 | viewport meta만 | CSS + JS 이벤트까지 완전 차단 | 강화 |
| 테마 미리보기 | 없음 | `themePreview` store (실시간 반영) | 신규 |

---

## 1. DB 스키마: `tutorial_flags` 컬럼 추가

### 원래 설계

CLAUDE.md는 `users`, `sessions`, `settings`, `records` 4개 테이블을 정의했다. 튜토리얼이라는 개념 자체가 없었다.

### 실제 구현

```sql
-- users 테이블에 컬럼 추가 (서버 시작 시 자동 적용)
ALTER TABLE users ADD COLUMN IF NOT EXISTS tutorial_flags INTEGER DEFAULT 0;
```

`tutorial_flags`는 비트 플래그다. 튜토리얼 완료 여부를 정수 하나로 압축해서 저장한다.

```
bit 0 (1): login 튜토리얼
bit 1 (2): dashboard 튜토리얼
bit 2 (4): stats 튜토리얼
bit 3 (8): settings 튜토리얼
```

설계 문서(gongnog-tutorial-spec.md)에서는 `login`과 `dashboard` 2개만 정의했는데, 실제 구현에서는 `stats`와 `settings`까지 4개로 확장됐다. 통계·설정 탭 첫 진입 시 자동 튜토리얼을 추가했기 때문이다.

**왜 컬럼 추가를 별도 쿼리로 분리했나?**

초기에 `init()` 함수 내 하나의 멀티스테이트먼트 쿼리에 `ALTER TABLE`을 포함시켰더니 PostgreSQL에서 에러가 났다. `pg` 라이브러리는 멀티스테이트먼트를 단일 트랜잭션으로 묶는데, DDL 변경을 기존 CREATE TABLE과 같은 블록에 섞으면 충돌이 생긴다. 결국 별도 `pool.query()` 호출로 분리했다.

```js
// src/lib/server/db.js
export async function init() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (...); ...`);

  // ⚠️ 컬럼 추가는 별도 쿼리로 (multi-statement 호환성)
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tutorial_flags INTEGER DEFAULT 0;
  `);
}
```

---

## 2. 캘린더 요일 순서: 월~일 → 일~토

### 원래 설계

CLAUDE.md 명세:
> 캘린더 그리드 — **월요일 시작** (월~일)

### 실제 구현

```
일  월  화  수  목  금  토
```

커밋 메시지: `fix: 캘린더 요일 순서 일월화수목금토로 변경`

**왜 바꿨나?**

실제 사용해보니 **공무원 업무 특성상 주말 기록(공휴일 근무 등)이 중요한데**, 월요일 시작에서 주말(토·일)이 오른쪽 끝에 몰리면서 가독성이 떨어졌다. 또 한국의 달력 대부분이 일요일 시작이라 사용자의 기대 모델과 맞지 않았다.

`WKKO = ["일","월","화","수","목","금","토"]` — 배열 인덱스가 `getDay()` 반환값(0=일, 6=토)과 그대로 대응해서 buildCal 로직도 단순해졌다.

---

## 3. Svelte Stores: 4개에서 9개로

### 원래 설계

```js
// CLAUDE.md 명세
export const settings = writable({ ... });
export const records = writable({});
export const currentView = writable('cal');
export const selectedDate = writable(null);
```

4개 store.

### 실제 구현

```js
// 기본 store (원래 명세)
export const settings = writable({ ... });
export const records = writable({});
export const currentView = writable('cal');
export const selectedDate = writable(null);

// 추가된 store
export const themePreview = writable({});       // 설정 탭 실시간 미리보기
export const settingsDirty = writable(false);   // 미저장 변경사항 추적

// 커스텀 다이얼로그 (window.alert/confirm 대체)
export const dialogState = writable(null);
export function customAlert(message) { ... }
export function customConfirm(message) { ... }

// 튜토리얼
export const tutorialFlags = writable(0);
export const flagsLoaded = writable(false);
export const FLAG_BITS = { login: 1, dashboard: 2, stats: 4, settings: 8 };
export function createHasSeenStore(tutorialKey) { ... }
export async function setSeen(tutorialKey) { ... }
export async function loadFlags() { ... }
```

**`themePreview` — 설정 변경의 실시간 반영**

설정 탭에서 테마 색상을 바꿀 때 저장 버튼을 누르기 전에도 미리 보이게 하기 위해 추가됐다. `settingsDirty`는 뒤로가기 시 "저장되지 않은 변경사항이 있습니다" 확인 팝업을 띄우기 위한 플래그다.

**`customAlert/customConfirm` — 브라우저 다이얼로그 대체**

`window.alert()`와 `window.confirm()`은 테마가 적용되지 않고, 모바일에서 브라우저 스타일로 뜨기 때문에 앱 분위기를 깬다. Promise 기반 커스텀 다이얼로그로 완전히 대체했다.

```js
// 사용 예시 (Calendar.svelte)
if (!await customConfirm('정말로 로그아웃 하시겠습니까?')) return;
```

`dialogState`를 store에 담고 `CustomDialog.svelte`가 전역으로 렌더링하는 구조다.

---

## 4. 새 컴포넌트: CustomDialog.svelte

### 원래 설계

명세에 없음. `window.alert/confirm`을 그냥 쓸 것으로 암묵적으로 가정됐다.

### 실제 구현

`src/routes/CustomDialog.svelte` — 테마를 따르는 커스텀 confirm/alert 모달.

```
구조:
  cdlg-overlay (z-index: 500)
    └ cdlg
        ├ cdlg-msg
        └ cdlg-btns
            ├ cdlg-cancel (confirm 타입만)
            └ cdlg-ok
```

`dialogState` store를 구독해 자동으로 열리고, ESC 키와 오버레이 클릭으로 닫힌다. Promise resolve 패턴을 써서 기존 `await customConfirm(...)` 코드가 `await window.confirm(...)`과 완전히 동일하게 동작한다.

`+layout.svelte`에 전역 마운트했기 때문에 어디서든 `customConfirm()`을 호출할 수 있다.

---

## 5. 새 컴포넌트: Tutorial.svelte

### 원래 설계

튜토리얼은 아예 없었다. 초기 명세에서는 사용자 온보딩에 대한 고민이 없었다.

### 실제 구현

`src/routes/Tutorial.svelte` — 스포트라이트 오버레이 방식의 단계별 가이드.

**핵심 구조 (DOM 3개만 사용)**

```
click-blocker (z-index: 1009) — 배경 클릭 차단
highlight     (z-index: 1010) — box-shadow 거대 그림자로 딤드 효과 겸용
tooltip       (z-index: 1012) — 설명 박스
```

`box-shadow: 0 0 0 9999px rgba(0,0,0,0.65)` 한 줄로 별도 오버레이 div 없이 딤드 처리를 해결한 것이 핵심이다. 별도 dim 레이어를 만들면 z-index 관리가 복잡해지고, 요소 위치가 바뀔 때마다 딤드도 재배치해야 한다.

**실제 대시보드 튜토리얼 4단계**

```js
const tutorialSteps = [
  {
    target: '.quick-btn, .add-btn',
    title: '출퇴근 기록',
    content: '이 버튼으로 오늘 출근·퇴근 시간을 바로 기록해요. 현재 시간이 자동으로 입력됩니다.',
    position: 'top',
  },
  {
    target: '.summary-row',
    title: '이달 요약',
    content: '총 근무시간, 초과근무, 급량 수지를 한눈에 확인해요.',
    position: 'bottom',
  },
  {
    target: '.cal-wrap',
    title: '월간 캘린더',
    content: '각 날짜를 탭하면 기록을 확인하고 수정할 수 있어요.',
    position: 'top',
    beforeShow() {
      // 빈 캘린더에서도 기능을 보여주기 위해 가짜 데이터 주입
      const fakeData = { ... };
      records.update(r => ({ ...r, ...toAdd }));
    },
    cleanup() {
      records.update(r => { /* 가짜 데이터 제거 */ });
    },
  },
  {
    target: '.nav-pills',
    title: '통계 · 설정',
    content: '통계 탭에서 차트로 분석하고, 설정 탭에서 초과근무 기준을 조정해요.',
    position: 'top',
  },
];
```

**3단계 `beforeShow/cleanup`이 흥미로운 부분이다.** 신규 사용자는 기록이 하나도 없어서 캘린더가 텅 비어 있다. 이 상태에서 "캘린더를 보세요"라고 말해봤자 이해하기 어렵다. 그래서 튜토리얼 3단계에 진입할 때 가짜 기록 6개를 Svelte store에 주입하고, 튜토리얼이 끝나거나 취소될 때 `cleanup()`으로 정리한다. 실제 DB에는 저장되지 않는다.

**? 버튼은 헤더 고정**

스펙 문서(gongnog-tutorial-spec.md)에서 "container 하단은 스크롤 시 안 보임. 항상 보이는 고정 위치에 배치"라는 교훈을 반영했다. Calendar.svelte 헤더 내부에 ? 버튼을 배치했고, 튜토리얼 미완료 시 pulse 애니메이션을 준다.

**localStorage + DB 이중 저장**

```js
export async function setSeen(tutorialKey) {
  if (browser) localStorage.setItem(`tutorialSeen_${tutorialKey}`, 'v1');
  // DB에도 비트 저장 (로그인 유저)
  await fetch('/api/tutorial-flags', { method: 'POST', body: JSON.stringify({ flag: bit }) });
}
```

비로그인 환경은 localStorage만, 로그인 환경은 DB와 동기화한다. 크로스 디바이스에서도 "이미 봤음" 상태가 유지된다.

---

## 6. DaySheet: "Bottom Sheet 형태" → A안 오버레이 확정

### 원래 설계

CLAUDE.md:
> 날짜 클릭 → Day Sheet (DaySheet.svelte) — Bottom Sheet 형태

구체적인 구현 방식은 명시되지 않았다.

### 팀 회의 결과 (calendar-detail-ux-meeting.md)

3가지 후보안을 비교한 팀 회의가 열렸다.

| 방안 | 설명 | 결론 |
|------|------|------|
| **A안: 바텀시트 오버레이** | 날짜 클릭 시 캘린더 위에 슬라이드업 | **채택** |
| B안: 주간 접기 | 선택된 주(1행)만 남기고 나머지 접기 | 구현 복잡도로 기각 |
| C안: 셀 높이 축소 | min-height를 62px→48px으로 | 근본 해결 안 됨, 전원 기각 |

문제는 모바일(390px)에서 헤더+스트립+그리드 합산이 ~622px로 뷰포트를 초과해서, DaySheet를 인라인에 넣으면 스크롤 없이는 내용을 볼 수 없다는 것이었다.

**A안은 캘린더 구조를 전혀 건드리지 않아도 된다.** `position: fixed` 오버레이로 화면 위에 올라오기 때문에 캘린더 레이아웃과 독립적이다. 공수 0.5~1일 추정대로 빠르게 구현됐다.

### 실제 구현

DaySheet가 `position: fixed` + slide-up 방식의 오버레이로 구현됐다. `ds-overlay`(z-index: 150)와 DaySheet 패널이 함께 뜨고, 오버레이 클릭이나 아래로 드래그로 닫힌다.

---

## 7. DaySheet 퀵 액션: 스펙에 없던 UX

### 원래 설계

DaySheet의 역할:
> 기록 있으면: 근무 카드 + 급량비 수지 카드 + ✏️ 편집
> 기록 없으면: ＋ 기록 입력 버튼

### 실제 구현

DaySheet에 퀵 액션 버튼 3개가 추가됐다.

```
[출근] [퇴근] [식사]
```

**출근/퇴근 버튼**: 탭하면 현재 시간이 채워진 확인 팝업이 뜬다. 팝업 안에는 `-1/-5/-10/-60분` 조절 버튼이 있다. 실제로 출퇴근 후 몇 분 뒤에 기록하는 경우가 많기 때문에 빠른 시간 조정이 필요했다.

```svelte
function adjustTime(min) {
  const [h, m] = clockPopupTime.split(':').map(Number);
  let total = h * 60 + m + min;
  if (total < 0) total = 0;
  if (total > 1439) total = 1439;
  clockPopupTime = `${String(nh).padStart(2,'0')}:${nm}분`;
}
```

**식사 버튼**: 식비 금액을 직접 입력하는 팝업. 기본값으로 설정된 단가(평일 9000원 등)를 채워준다.

이 패턴은 `+page.svelte`에서 `handleQuickClock`과 `handleQuickMeal` 이벤트 핸들러로 연결된다.

---

## 8. 미래 날짜 기록 차단

### 원래 설계

명세에 없음. 미래 날짜에 기록하는 것을 막는다는 언급이 없었다.

### 실제 구현

DaySheet에서 미래 날짜를 감지하면 기록 입력을 막는다.

```js
$: isFuture = date ? date > todayStr() : false;
```

퀵 액션 버튼들이 비활성화되고, 입력을 시도하면 경고가 뜬다.

**왜 추가했나?** 공무원 근무기록은 실제 발생한 사실을 기록하는 용도다. 미래 날짜를 미리 채우는 건 데이터 신뢰성을 해친다. 특히 초과근무나 급량비 계산에서 오류가 생길 수 있다.

---

## 9. 스플래시 화면 + 토스트 알림

### 원래 설계

없음.

### 실제 구현

**스플래시 화면**

앱 첫 로딩 시 `app-icon.svg`와 "공노기" 텍스트가 페이드인 후 페이드아웃된다. 로딩 중 데이터 fetch가 완료되기 전 빈 화면이 노출되는 것을 방지하는 역할도 한다.

```js
splashFading = true;
setTimeout(() => { splashVisible = false; }, 500);
```

**토스트 알림**

퀵 액션(출근/퇴근/식사) 완료 후 저장 결과를 3초간 하단에 표시한다.

```js
function showToast(msg, date) {
  clearTimeout(toastTimer);
  toast = { msg, date };
  toastTimer = setTimeout(() => { toast = null; }, 3000);
}
// 사용 예
showToast(`${fmtTime(checkIn)} 출근`, date);
showToast(`식사 ${fmtW(mealExpense)} 기록됨`, date);
```

토스트를 탭하면 해당 날짜의 RecordModal이 바로 열린다(빠른 수정 진입).

---

## 10. 뒤로가기(popstate) 지원

### 원래 설계

없음. 탭 전환은 클릭으로만 했다.

### 실제 구현

모바일 브라우저의 뒤로가기 버튼이 앱 탭 전환과 연동된다.

```js
currentView.subscribe(v => {
  if (v !== 'cal') history.pushState({ view: v }, '');
});

window.addEventListener('popstate', handlePopState);

async function handlePopState() {
  // 설정 탭에서 미저장 변경사항이 있으면 확인 팝업
  if ($currentView === 'settings' && $settingsDirty) {
    const save = await customConfirm('저장되지 않은 변경사항이 있습니다.\n저장하시겠습니까?');
    if (save) settingsRef?.saveSettings();
    else settingsRef?.resetSettings();
  }
  if ($currentView !== 'cal') currentView.set('cal');
}
```

설정 탭에서 변경하다 뒤로가기를 누르면 "저장하시겠습니까?" 팝업이 뜬다. 이 팝업에 `customConfirm`을 쓰기 때문에 `CustomDialog` 추가가 선행될 수밖에 없었다.

---

## 11. 캘린더 셀 근무시간 색상 구분

### 원래 설계

캘린더 셀 이벤트 바 3줄에 대한 색상 규칙만 있었다.

> 이벤트 바 3줄: 초과(var(--ot-c)) / 출근(var(--acc)) / 급량수지(양수 var(--meal-c) 음수 var(--neg-c))

### 실제 구현

근무 시간 자체를 색상으로 표현하는 로직이 추가됐다.

```js
function workZoneColor(workMin, dateStr) {
  if (isWeekend(dateStr) || isHoliday(dateStr)) return 'var(--ot-c)';
  const bufferStart = 540 - $settings.bufferMin;
  if (workMin <= bufferStart) return 'var(--meal-c)';   // 기준 미달 (초록)
  if (workMin <= 540) return '#64748b';                  // 정상 범위 (회색)
  return 'var(--ot-c)';                                  // 초과근무 발생 (주황)
}
```

평일 기준:
- 초과근무 없는 일반 근무: 회색 (`#64748b`)
- `bufferMin` 미만으로 짧게 근무: 초록 (`var(--meal-c)`) — 이날은 급량비가 안 나올 수 있음을 시각적으로 경고
- 초과근무 발생: 주황 (`var(--ot-c)`)
- 주말·공휴일: 주황 (하루 종일 초과근무로 인식)

`#64748b`만 예외적으로 하드코딩인 것도 눈에 띈다. 이 색상은 "정상, 특별히 강조 안 함" 의미여서 테마 중립 색상을 썼다.

---

## 12. `fmtMin`, `fmtTime`: 포맷 변경과 신규 추가

### 원래 설계

```js
// CLAUDE.md 명세
export function fmtMin(m) {
  const h = Math.floor(m / 60), n = m % 60;
  return h > 0 ? `${h}h${n > 0 ? ' ' + n + 'm' : ''}` : n + '분';
}
```

`"1h 30m"` 형식. `fmtTime` 함수는 없었다.

### 실제 구현

```js
export function fmtMin(m) {
  if (!m || m <= 0) return '0분';
  const h = Math.floor(m / 60), n = m % 60;
  return h > 0 ? `${h}시간${n > 0 ? ' ' + n + '분' : ''}` : n + '분';
}

export function fmtTime(t) {
  if (!t) return '--시 --분';
  const [h, m] = t.split(':').map(Number);
  return `${h}시 ${String(m).padStart(2,'0')}분`;
}
```

**`fmtMin`**: `"1h 30m"` → `"1시간 30분"` 으로 전면 한글화. 설계 단계에서 영문 축약형을 썼지만 실제 화면에서 보니 앱 전체가 한국어인데 시간 형식만 영문이어서 어색했다. 또 원래 코드에는 `m <= 0` 가드가 없었는데 0분이 `"NaN분"` 으로 표시되는 버그도 함께 수정됐다.

**`fmtTime`**: 퀵 클록 토스트 메시지("8시 30분 출근")와 DaySheet 기록 표시에 쓰인다. 원래 명세에는 없던 함수인데, 시간 포맷이 여러 곳에서 반복되면서 자연스럽게 constants.js에 추가됐다.

---

## 13. 로그인 화면: 비밀번호 확인 필드 추가

### 원래 설계

CLAUDE.md:
> 로그인/회원가입 토글 (같은 화면)

회원가입 시 비밀번호 확인 필드에 대한 언급 없음.

### 실제 구현

회원가입 모드에서 `passwordConfirm` 입력 필드가 추가됐다. 클라이언트 사이드에서 두 비밀번호가 일치하는지 먼저 확인하고, 불일치 시 에러 메시지를 바로 표시한다.

```js
if (mode === 'register' && password !== passwordConfirm) {
  error = '비밀번호가 일치하지 않습니다.';
  return;
}
```

로그인/회원가입 모드 전환 시 앱 이름과 설명 텍스트도 달라진다:
- 로그인: "공노기 / 근무 / 기록 / 공무원 출퇴근·초과근무·급량비 기록"
- 회원가입: "새 계정 / 만들기 / 아이디와 비밀번호를 입력해주세요"

로그인 성공 후에는 `showSplash` 플래그로 짧은 전환 효과를 준 뒤 메인으로 이동한다.

---

## 14. 모바일 확대 방지 강화

### 원래 설계

`app.html` viewport meta:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```

viewport meta 한 줄로 끝이었다.

### 실제 구현

iOS Safari에서 viewport meta를 무시하고 더블탭 시 확대되는 문제가 있었다. JavaScript 이벤트 차단이 추가됐다.

```js
// 더블탭 확대 방지
document.addEventListener('touchstart', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
```

CSS에도 `touch-action: manipulation`이 버튼 요소에 추가됐다. 버튼 연타 시 iOS가 더블탭으로 인식해서 확대하던 문제를 해결한다.

커밋 이력을 보면 `f455a50 fix: 모바일 버튼 연타 시 확대 방지`, `f170eee fix: 모바일 확대 완전 차단`으로 두 번에 걸쳐 개선됐다.

---

## 15. 앱 아이콘 추가

### 원래 설계

`static/` 폴더에 대한 언급:
> 필요시 정적 파일

### 실제 구현

`static/app-icon.svg` — 스플래시 화면에서 사용되는 앱 아이콘.

---

## 목업(mockup_ios.html) vs 실제 구현

`docs/mockup_ios.html`은 DB 연결 없이 바닐라 JS로 동작하는 단일 HTML 파일이다. 설계의 시각적 기준이자 레이아웃/CSS 확정 레퍼런스였지만, **목업에서 전제했던 것들이 실제 구현에서 상당히 달라졌다.**

### 16-1. 핵심 구조 차이: 상세 영역 위치

목업에서 가장 큰 문제점은 **DaySheet(상세 영역)가 캘린더 그리드 아래에 인라인으로 붙어 있다**는 것이었다.

```
목업 레이아웃:
┌──────────────────┐
│ 헤더 (~80px)    │
│ 요약 스트립      │
│ 캘린더 그리드    │  ← ~372px (6주 x 62px)
│ ─────────────   │  ← detail-wrap (flex:1, overflow-y:auto)
│ [날짜 선택 상세] │  ← 여기에 공간이 없음
└──────────────────┘
```

`detail-wrap`에 `flex:1`을 줘서 남은 공간을 채우는 구조인데, 실제 모바일(390px 기준)에서는 남은 공간이 거의 없다. 헤더+요약+그리드 합산이 ~622px이고 하단 바가 ~50px이면, 상세 영역에 주어지는 공간은 0에 가깝다.

팀 회의(calendar-detail-ux-meeting.md)에서 3개 방안을 비교한 끝에 **A안(고정 오버레이)**으로 확정됐다.

```
실제 구현 레이아웃:
┌──────────────────┐
│ 헤더             │
│ 요약 스트립      │
│ 캘린더 그리드    │
└──────────────────┘
       ↕
┌──────────────────┐  ← position: fixed, slide-up
│ DaySheet 오버레이│  (캘린더 위에 떠서 표시)
└──────────────────┘
```

### 16-2. 식비 입력: 4분할 → 단일 필드

목업의 DB 데이터:
```js
"2026-03-02": { ci:"08:00", co:"18:00", work:600, ot:0, meals:1,
                expB:0, expL:7500, expD:0, expE:0 }  // 조식/중식/석식/간식 4분할
```

목업에는 `expB`(조식), `expL`(중식), `expD`(석식), `expE`(간식) 4개 필드가 있다. 하지만 실제 DB 스키마와 구현에서는 `meal_expense` 단일 필드로 통합됐다. 입력 UX에서도 "오늘 총 식비 지출" 하나의 숫자 필드만 쓴다.

CLAUDE.md가 명시했다:
> "식비는 `meal_expense` 단일 필드 (목업의 expB/L/D/E 4분할 무시)"

이유는 간단하다. 식사별로 금액을 나눠서 입력하는 것이 너무 불편하다. 공무원이 급량비를 관리하는 실제 목적은 "수령액 - 총 식비 = 수지"를 파악하는 것이지, 끼니별 지출 분석이 아니다.

### 16-3. 요일 순서

| 구분 | 요일 순서 |
|------|-----------|
| 목업 | **월화수목금토일** (월요일 시작) |
| 실제 | **일월화수목금토** (일요일 시작) |

목업의 `week-hdr`에서 `월 화 수 목 금 토 일` 순서로 하드코딩됐다. 실제로 바꾸게 된 이유는 앞서 설명했다.

### 16-4. `fmtMin` 단위

| 구분 | 형식 예시 |
|------|-----------|
| 목업 | `"1h 30m"`, `"30분"` (영문/한글 혼용) |
| 실제 | `"1시간 30분"`, `"30분"` (전부 한글) |

목업 코드:
```js
const fmtMin=m=>{...return h>0?`${h}h${n>0?" "+n+"m":""}`:n+"분";}
```

0분 처리도 없었다(`null`이나 0을 넣으면 `"NaN분"`이 출력된다).

### 16-5. 하드코딩된 계산 값

목업에서 `bufferMin=60`, `maxOtMin=240`, `MEAL_PRICE=9000`이 전부 상수로 하드코딩됐다.

```js
// 목업 calcR 함수
const ot = we ? Math.max(0, Math.min(240, work))
             : Math.max(0, Math.min(240, work - 540 - 60)); // 240, 60 하드코딩
```

실제 구현은 이 값들을 전부 settings DB에서 읽어온다. `bufferMin`과 `maxOtMin`은 설정 탭에서 변경 가능하다.

### 16-6. DaySheet 내용: 편집 버튼만 → 퀵 액션 버튼 추가

목업 DaySheet:
```html
<button>✏️ 편집</button>  <!-- 오른쪽 상단 단독 -->
```

실제 구현 DaySheet:
```
[출근] [퇴근] [식사]   <!-- 퀵 액션 버튼 3개 추가 -->
[✏️ 편집]              <!-- 여전히 존재 -->
```

### 16-7. 공휴일 데이터 확장

목업:
```js
const HOL = {
  "2026-01-01": "신정",
  "2026-01-29": "설날",      // 당일만
  "2026-03-01": "삼일절",
  ...
  "2026-09-25": "추석",      // 당일만
  // 총 11개
};
```

실제:
```js
export const HOLIDAYS = {
  "2026-01-01": "신정",
  "2026-01-28": "설날 연휴",  // 연휴 포함
  "2026-01-29": "설날",
  "2026-01-30": "설날 연휴",  // 연휴 포함
  ...
  "2026-09-24": "추석 연휴",  // 연휴 포함
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",  // 연휴 포함
  // 총 15개
};
```

연휴 날짜들이 추가됐다. 연휴에 출근하면 주말과 동일하게 초과근무 계산이 적용된다.

### 16-8. 앱 이름

| 구분 | 앱 이름 |
|------|---------|
| 목업 HTML title | "근무기록" |
| 로그인 화면 | "근무" / "기록" (두 줄 타이포) |
| 실제 구현 | **"공노기"** (페이지 타이틀, 스플래시, 헤더) |

"공노기"는 "공무원 노동 기록"의 줄임말로, 배포 후 앱 정체성 확립을 위해 변경됐다.

### 16-9. 목업에 없던 기능들

| 기능 | 목업 | 실제 |
|------|------|------|
| 스플래시 화면 | ✗ | ✅ (app-icon.svg + fade) |
| 토스트 알림 | ✗ | ✅ (퀵 액션 결과 피드백) |
| 튜토리얼 시스템 | ✗ | ✅ (Tutorial.svelte) |
| ? 도움말 버튼 | ✗ | ✅ (헤더 고정, pulse 애니메이션) |
| 퀵 시간 조절 버튼 | ✗ | ✅ (-1/-5/-10/-60분) |
| 미래 날짜 차단 | ✗ | ✅ |
| 뒤로가기 지원 | ✗ | ✅ (popstate) |
| 설정 미저장 경고 | ✗ | ✅ (settingsDirty) |
| 커스텀 Alert/Confirm | ✗ | ✅ (CustomDialog) |
| 근무시간 색상 구분 | ✗ | ✅ (workZoneColor) |

### 16-10. CSS/스타일 — 거의 그대로 이식

반면 CSS는 목업에서 거의 그대로 가져왔다. `.dcell`, `.ev`, `.chip`, `.spill`, `.modal-sheet`, `.btm-bar` 같은 핵심 클래스들의 스타일 규칙은 목업의 것을 `app.css`로 옮겼다. CSS 변수 체계(테마 시스템)도 목업에서 정의한 것을 그대로 사용한다.

목업이 가장 크게 기여한 부분은 CSS다. 레이아웃, 컴포넌트 스타일, 테마 변수를 빠르게 확정할 수 있었다.

---

## 정리: 설계가 현실에서 달라지는 이유

이 프로젝트에서 원래 명세와 구현 사이의 격차는 크게 세 가지 원인에서 왔다.

**1. 실제로 써봐야 알 수 있는 UX 문제**

캘린더 DaySheet 공간 부족 문제, 미래 날짜 기록 차단, 시간 형식 한글화 같은 것들은 설계 단계에서 예측하기 어렵다. 문서에서 "Bottom Sheet 형태"라고 써도 실제로 모바일에서 열어보기 전에는 공간이 얼마나 부족한지 모른다. 팀 회의가 열리고, A/B/C 방안이 비교되고, 그래야 결론이 난다.

**2. 설계 누락 — 당연해 보이는 것들**

비밀번호 확인 필드, 브라우저 alert 대체, 스플래시 화면 같은 것들은 명세에 없었지만 "당연히 있어야 하는 것"이었다. 설계 문서가 아무리 상세해도 이런 디테일을 전부 담기는 어렵다. 구현하다 보면 자연스럽게 추가된다.

**3. 기능 추가 — 설계 후 발생한 새로운 요구**

튜토리얼 시스템은 초기 설계에 없었다. 앱을 어느 정도 만들고 나서야 "신규 사용자가 아무것도 모르고 들어오면 어떡하지?"라는 질문이 생겼다. 별도 스펙 문서(gongnog-tutorial-spec.md, gongnog-tutorial-impl.md)가 만들어졌고, LAMDice 프로젝트에서 배운 교훈들을 반영해서 설계했다. 이 경우 설계 → 구현 사이클이 다시 돌았다.

---

**공노기 git 커밋 수**: 약 45개 (397ff96 ~ 207af15)
**초기 명세 작성일**: 2026-03-10
**배포**: https://gongnog.up.railway.app/
