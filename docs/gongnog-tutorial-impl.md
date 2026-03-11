# 공노기 튜토리얼 구현 가이드

> **용도**: 새 세션에서 이 문서만 보고 튜토리얼 기능을 구현할 수 있도록 작성
> **기반**: `docs/gongnog-tutorial-spec.md` (검증 완료, 현재 프로젝트와 정합 확인)
> **참고**: 설계 의도·엣지케이스·LAMDice 교훈 등 상세 내용은 스펙 문서 참조

---

## 프로젝트 현황 (구현 전 확인 사항)

### 기술 스택
- SvelteKit (Svelte 4) + raw PostgreSQL (`pg` Pool) + Railway
- 인증: 커스텀 쿠키 세션 (`event.locals.user = { user_id, username }`)
- 스타일: CSS 변수 기반 테마 (6 액센트 + 4 배경), **색상 하드코딩 금지 (#fff 제외)**

### 파일 배치 규칙
- 컴포넌트: `src/routes/` 직접 배치 (Calendar.svelte, DaySheet.svelte 등)
- Store: `src/lib/stores.js` 단일 파일
- API: `src/routes/api/{카테고리}/+server.js`
- DB: `src/lib/server/db.js` (init()에서 테이블 자동 생성)

### 현재 z-index 현황
| 요소 | z-index |
|------|---------|
| splash | 9999 |
| cdlg-overlay | 500 |
| toast | 300 |
| meal-popup-overlay | 250 |
| modal-overlay | 200 |
| ds-overlay | 150 |
| btm-bar | 10 |

### 확인된 CSS 변수 (app.css에 존재)
`--acc`, `--acc-soft`, `--acc-text`, `--surface`, `--surface2`, `--border`, `--t1`, `--t2`, `--t3`, `--bg`, `--today-bg`

---

## 구현 순서

### 1단계: DB 스키마 변경

**파일**: `src/lib/server/db.js`

init() 함수의 기존 CREATE TABLE 쿼리 뒤에 추가:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS tutorial_flags INTEGER DEFAULT 0;
```

> PostgreSQL 10+에서 IF NOT EXISTS 지원. Railway는 12-15이므로 문제없음.

---

### 2단계: Store 확장

**파일**: `src/lib/stores.js`

기존 import에 `derived` 추가하고, `$app/environment`에서 `browser` import:

```javascript
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
```

파일 하단에 아래 코드 추가:

```javascript
// ── 튜토리얼 ──
export const tutorialFlags = writable(0);
export const flagsLoaded = writable(false);

const FLAG_BITS = {
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
        body: JSON.stringify({ flag: bit })
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
```

---

### 3단계: API Route 생성

**파일**: `src/routes/api/tutorial-flags/+server.js` (새 파일)

```javascript
import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

const VALID_FLAGS = [1, 2];

export async function GET({ locals }) {
  if (!locals.user) return json({ ok: true, flags: 0 });
  const r = await pool.query(
    'SELECT tutorial_flags FROM users WHERE id = $1',
    [locals.user.user_id]
  );
  return json({ ok: true, flags: r.rows[0]?.tutorial_flags || 0 });
}

export async function POST({ request, locals }) {
  if (!locals.user) return new Response(null, { status: 401 });
  const { flag } = await request.json();
  if (!VALID_FLAGS.includes(flag)) return json({ ok: false, message: 'Invalid flag' }, { status: 400 });
  const r = await pool.query(
    'SELECT tutorial_flags FROM users WHERE id = $1',
    [locals.user.user_id]
  );
  const currentFlags = r.rows[0]?.tutorial_flags || 0;
  await pool.query(
    'UPDATE users SET tutorial_flags = $1 WHERE id = $2',
    [currentFlags | flag, locals.user.user_id]
  );
  return json({ ok: true });
}
```

---

### 4단계: Tutorial.svelte 컴포넌트

**파일**: `src/routes/Tutorial.svelte` (새 파일)

#### 핵심 구조

```
DOM 3개:
  click-blocker (z-index: 1009) — 배경 클릭 차단
  highlight     (z-index: 1010) — box-shadow: 0 0 0 9999px rgba(0,0,0,0.65)로 딤드 겸용
  tooltip       (z-index: 1012) — 설명 박스
```

#### Props & 공개 메서드

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { setSeen } from '$lib/stores.js';

  export let steps = [];
  export let tutorialKey = '';

  let currentStep = 0;
  let isActive = false;

  export function start(force = false) { ... }
  export function stop() { ... }
  export function prev() { ... }
  export function next() { ... }
  export function reset() { ... }
</script>
```

#### Step Schema

```javascript
{
  target: '.css-selector',        // 필수
  fallbackTarget: '.fallback',    // 선택
  title: '제목' || function,      // 필수
  content: '설명' || function,    // 필수
  position: 'top' | 'bottom',    // 기본 'bottom'
  beforeShow: function,           // 선택 (DOM 주입 등)
  cleanup: function,              // 선택 (DOM 정리)
}
```

#### 핵심 로직 규칙

| 동작 | 규칙 |
|------|------|
| start() | hasSeen 확인 → blocker 생성 → showStep(0) |
| showStep(i) | beforeShow 실행 → target 탐색 → scroll → highlight + tooltip 배치 |
| next() | cleanup **안 함** → currentStep++ → showStep |
| prev() | 현재 cleanup **실행** → currentStep-- → showStep |
| stop() | 모든 cleanup **일괄 실행** → setSeen → DOM 정리 |
| target 못 찾음 | fallbackTarget 시도 → 둘 다 없으면 findNext로 스킵 |
| beforeShow 있는 스텝 | 가시성 검사 스킵 (beforeShow가 DOM 만들어줄 것으로 신뢰) |

#### 가시성 판정 (offsetParent 아닌 getComputedStyle 사용)

```javascript
function isVisible(el) {
  if (!el) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}
```

#### 툴팁 배치 (상하 전용, 좌우 안 함)

```javascript
function positionTooltip(targetRect, tooltipEl, preferredPosition) {
  const gap = 12;
  let top, left;

  if (preferredPosition === 'top') {
    top = targetRect.top - tooltipEl.offsetHeight - gap;
    if (top < 8) top = targetRect.bottom + gap; // flip
  } else {
    top = targetRect.bottom + gap;
    if (top + tooltipEl.offsetHeight > window.innerHeight - 8) {
      top = targetRect.top - tooltipEl.offsetHeight - gap; // flip
    }
  }

  left = targetRect.left + (targetRect.width / 2) - (tooltipEl.offsetWidth / 2);
  left = Math.max(8, Math.min(left, window.innerWidth - tooltipEl.offsetWidth - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - tooltipEl.offsetHeight - 8));

  return { top, left };
}
```

#### 화살표 위치 (--ax CSS 변수)

```javascript
function calcArrowX(targetRect, tooltipLeft, tooltipWidth) {
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const ax = targetCenterX - tooltipLeft;
  const clamped = Math.max(16, Math.min(ax, tooltipWidth - 16));
  return `${clamped}px`;
}
// 사용: tooltipEl.style.setProperty('--ax', calcArrowX(...));
```

#### 스크롤 처리

```javascript
function scrollToTarget(targetEl) {
  const rect = targetEl.getBoundingClientRect();
  const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
  if (!inView) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
// ⚠️ smooth scroll 후 getBoundingClientRect() 호출 시
//    scrollend 이벤트 대기 또는 setTimeout(, 300) 필요
```

#### 이벤트 처리

- ESC 키 → stop()
- 윈도우 리사이즈 → highlight + tooltip 위치 재계산
- onDestroy → stop() + 이벤트 리스너 해제

#### 버튼 구성

```
[✕ 닫기] — 우상단, stop() 호출
[← 이전] — 첫 스텝에서 숨김
[1/N]    — 진행 표시
[다음 →] — 마지막 스텝에서 "완료"로 변경
```

#### CSS (모든 색상 CSS 변수 사용)

```css
.tutorial-click-blocker {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1009;
  background: transparent;
  pointer-events: all;
}

.tutorial-highlight {
  position: absolute;
  z-index: 1010;
  border-radius: 8px;
  border: 2px solid var(--acc);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65);
  pointer-events: none;
  transition: all 0.3s ease;
}

.tutorial-tooltip {
  position: fixed;
  z-index: 1012;
  background: var(--surface);
  border-radius: 12px;
  padding: 20px;
  max-width: 300px;
  min-width: 200px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: tutorialFadeIn 0.2s ease-out;
}

.tutorial-tooltip__title { font-size: 1.1rem; font-weight: 700; color: var(--t1); margin-bottom: 8px; }
.tutorial-tooltip__content { font-size: 0.9rem; color: var(--t2); line-height: 1.5; margin-bottom: 16px; }
.tutorial-tooltip__close { position: absolute; top: 8px; right: 8px; background: none; border: none; font-size: 1.1rem; color: var(--t3); cursor: pointer; padding: 4px 8px; }
.tutorial-tooltip__footer { display: flex; justify-content: space-between; align-items: center; }
.tutorial-tooltip__prev { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 6px 12px; font-size: 0.85rem; cursor: pointer; color: var(--t2); }
.tutorial-tooltip__next { background: var(--acc); color: #fff; border: none; border-radius: 8px; padding: 8px 20px; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
.tutorial-tooltip__progress { color: var(--t3); font-size: 0.8rem; }

/* 화살표 */
.tutorial-tooltip[data-arrow="top"]::before {
  content: ''; position: absolute; top: -8px;
  left: var(--ax, 50%); transform: translateX(-50%);
  border: 8px solid transparent; border-bottom-color: var(--surface);
}
.tutorial-tooltip[data-arrow="bottom"]::after {
  content: ''; position: absolute; bottom: -8px;
  left: var(--ax, 50%); transform: translateX(-50%);
  border: 8px solid transparent; border-top-color: var(--surface);
}

@keyframes tutorialFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 모바일 */
@media (max-width: 480px) {
  .tutorial-tooltip { max-width: calc(100vw - 32px); font-size: 0.85rem; padding: 14px; }
  .tutorial-highlight { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55); }
  .tutorial-tooltip__footer { gap: 6px; }
}
```

> ⚠️ 컴포넌트가 blocker/highlight/tooltip DOM을 JS로 동적 생성. HTML 수동 추가 불필요.

---

### 5단계: 페이지에 Tutorial 삽입 + ? 버튼

**파일**: `src/routes/+page.svelte`

기존 import에 추가:
```javascript
import Tutorial from './Tutorial.svelte';
import { createHasSeenStore, loadFlags } from '$lib/stores.js';
```

script 내부:
```javascript
let tutorialRef;
const hasSeenDashboard = createHasSeenStore('dashboard');

onMount(() => {
  loadFlags();
});
```

스텝 정의 (실제 셀렉터는 DOM 확인 후 교체):
```javascript
const tutorialSteps = [
  {
    target: '[실제 셀렉터 — 기록입력 버튼]',
    title: '출퇴근 기록',
    content: '출근/퇴근 시간을 기록합니다.',
    position: 'bottom'
  },
  // ... 추가 스텝 (스펙 §9-2 참조)
];
```

> ⚠️ 셀렉터 확정 전에 `grep -r "class=" src/routes/ --include="*.svelte"` 로 실제 클래스 확인

템플릿:
```svelte
<Tutorial bind:this={tutorialRef} steps={tutorialSteps} tutorialKey="dashboard" />
```

헤더에 ? 버튼 추가:
```svelte
<button
  class="help-btn"
  class:help-btn--pulse={!$hasSeenDashboard}
  on:click={() => tutorialRef.start(true)}
>?</button>
```

? 버튼 CSS:
```css
.help-btn {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--acc); color: #fff;
  border: 2px solid var(--acc-soft);
  cursor: pointer; font-size: 0.9rem; font-weight: bold;
  box-shadow: 0 2px 8px var(--acc-soft);
  transition: transform 0.2s;
}
.help-btn:hover { transform: scale(1.1); }

@keyframes helpPulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--acc-soft); }
  50%      { box-shadow: 0 0 0 8px transparent; }
}
.help-btn--pulse { animation: helpPulse 2s ease-in-out infinite; }
```

---

### 6단계: 셀렉터 확정

구현 시 실제 DOM을 확인하여 steps의 target을 채워야 함:

```bash
# 프로젝트의 실제 CSS 클래스 확인
grep -r "class=" src/routes/ --include="*.svelte" | head -50
```

필요하면 타겟 요소에 `data-tutorial="step-name"` 속성을 추가하여 안정적인 셀렉터 확보.

---

## 검증 체크리스트

구현 완료 후 아래 항목 확인:

```
[오버레이]
□ 타겟 요소 밝게 + 나머지 box-shadow 딤드
□ var(--acc) border 강조
□ click-blocker 배경 클릭 차단

[툴팁]
□ 상하 전용 배치 + 자동 flip
□ 화살표(--ax)가 타겟 중심 가리킴
□ 뷰포트 밖 타겟 scrollIntoView

[버튼]
□ ✕ 닫기 + ← 이전 + 다음 → 3버튼
□ 첫 스텝: 이전 숨김
□ 마지막 스텝: "완료" 표시
□ ESC 키 → stop()

[콜백]
□ beforeShow → DOM 주입
□ cleanup → DOM 정리
□ prev() → 현재 cleanup
□ stop() → 모든 cleanup 일괄

[저장]
□ localStorage + DB 이중 저장
□ ✕ 닫기해도 다시 안 뜸 (setSeen)
□ 비로그인 시 localStorage만

[테마]
□ 다크모드(dark/amoled)에서 깨지지 않음
□ 6종 액센트 컬러에서 모두 정상

[환경]
□ SSR 에러 없음 (browser 체크)
□ 모바일(480px 이하) 정상
□ 페이지 이동 시 onDestroy 정리
□ 윈도우 리사이즈 시 위치 재계산
```

---

## 주의사항 요약

| 항목 | 규칙 |
|------|------|
| CSS 색상 | 하드코딩 금지, `#fff` 제외 전부 CSS 변수 |
| DB 접근 | `pool.query()` + `$1, $2` 파라미터 (Prisma 아님) |
| 인증 필드 | `locals.user.user_id` (`.id` 아님) |
| 응답 형식 | `json({ ok: true, ... })` 패턴 |
| 인증 실패 | `return new Response(null, { status: 401 })` |
| 컴포넌트 위치 | `src/routes/Tutorial.svelte` |
| Store 위치 | `src/lib/stores.js`에 통합 |
| z-index | 1009 / 1010 / 1012 |
| SSR 방지 | `browser` 체크 또는 `onMount` 내부 |
| 함수형 content | `typeof step.content === 'function' ? step.content() : step.content` |
