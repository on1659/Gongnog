# 공노기 (Gongnog) 튜토리얼 시스템 구현 스펙

> **프로젝트**: SvelteKit + PostgreSQL 공무원 근무기록 웹앱
> **배포**: https://gongnog.up.railway.app/
> **참고**: LAMDice 로비 튜토리얼 구현 경험 (설계↔구현 차이점) 반영
> **목표**: 첫 방문 사용자를 위한 스포트라이트 튜토리얼

---

## 1. 문제 정의

신규 사용자가 공노기에 처음 접속했을 때:
- 어떤 기능이 있는지 모름
- 출퇴근 기록, 초과근무, 급량비 등 핵심 기능 발견이 어려움
- UI 흐름 (로그인 → 대시보드 → 기록 작성)을 직관적으로 파악 못함

---

## 2. 기술 스택 및 구현 방식

### SvelteKit 맞춤 선택

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| A) Svelte 컴포넌트 (`Tutorial.svelte`) | 타입안전, 반응성, 라이프사이클 관리 | 페이지별 import 필요 | ✅ **권장** |
| B) 바닐라 JS 모듈 | 페이지 무관 전역 사용 | Svelte 반응성 활용 불가 | △ |

**→ `src/routes/Tutorial.svelte` 컴포넌트로 구현** (기존 컴포넌트와 동일 위치)

---

## 3. 오버레이 + 스포트라이트 구현

> ⚡ LAMDice에서 설계와 가장 크게 달라진 부분. 아래는 **실제 검증된 방식**을 기준으로 작성.

### 3-1. DOM 구조 (3개만)

```
click-blocker (투명 div, 클릭 차단)
  └ z-index: 1009
highlight (타겟 복제/강조, box-shadow로 딤드 겸용)
  └ z-index: 1010
tooltip (설명 박스)
  └ z-index: 1012
```

**별도 overlay div 불필요** — highlight의 `box-shadow: 0 0 0 9999px`가 딤드를 겸함.

### 3-2. 스포트라이트 (딤드 + 하이라이트)

```css
.tutorial-highlight {
    position: absolute;
    z-index: 1010;
    border-radius: 8px;
    border: 2px solid var(--acc);
    /* 핵심: 거대한 box-shadow로 나머지 전체를 딤드 처리 */
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65);
    pointer-events: none;
    transition: all 0.3s ease;
}
/* pulse 애니메이션 불필요 — spotlight shadow가 이미 충분히 시각적으로 구분됨 */
```

### 3-3. 클릭 차단 레이어

```css
.tutorial-click-blocker {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 1009;
    background: transparent;
    pointer-events: all;  /* 배경 클릭 전부 차단 */
}
```

### 3-4. Z-Index 규칙

```
⚠️ 기존 UI의 z-index를 먼저 확인한 후 설정할 것
  click-blocker : 1009
  highlight     : 1010
  tooltip       : 1012
```

공노기 기존 z-index 현황:
- splash: 9999 (초기 로딩용, 튜토리얼과 무관)
- cdlg-overlay (커스텀 다이얼로그): 500
- toast: 300
- meal-popup-overlay: 250
- modal-overlay: 200
- ds-overlay: 150
- btm-bar: 10

→ 1009~1012는 cdlg-overlay(500) 위, splash(9999) 아래로 안전한 범위.

---

## 4. 툴팁 배치

### 4-1. 상하 전용 (좌우 제거)

> LAMDice 교훈: 좌우 배치는 모바일에서 거의 항상 flip되거나 짤림. 상하만으로 충분.

```javascript
// position은 'top' 또는 'bottom'만 지원
// 'left', 'right' 입력해도 → 상하로 자동 배치
function positionTooltip(targetRect, tooltipEl, preferredPosition) {
    const gap = 12;
    let top, left;
    
    // 1) 상하 결정 (flip 포함)
    if (preferredPosition === 'top') {
        top = targetRect.top - tooltipEl.offsetHeight - gap;
        if (top < 8) top = targetRect.bottom + gap; // flip
    } else {
        top = targetRect.bottom + gap;
        if (top + tooltipEl.offsetHeight > window.innerHeight - 8) {
            top = targetRect.top - tooltipEl.offsetHeight - gap; // flip
        }
    }
    
    // 2) 좌우 중앙 정렬 + clamp
    left = targetRect.left + (targetRect.width / 2) - (tooltipEl.offsetWidth / 2);
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipEl.offsetWidth - 8));
    
    // 3) 최종 clamp
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipEl.offsetHeight - 8));
    
    return { top, left };
}
```

### 4-2. 화살표 (상하 2방향만)

```css
/* 화살표 위치를 CSS 변수로 동적 계산 */
.tutorial-tooltip[data-arrow="top"]::before {
    content: '';
    position: absolute;
    top: -8px;
    left: var(--ax, 50%);   /* 동적 계산 */
    transform: translateX(-50%);
    border: 8px solid transparent;
    border-bottom-color: var(--surface);
}

.tutorial-tooltip[data-arrow="bottom"]::after {
    content: '';
    position: absolute;
    bottom: -8px;
    left: var(--ax, 50%);
    transform: translateX(-50%);
    border: 8px solid transparent;
    border-top-color: var(--surface);
}
```

`--ax` 값 계산 (JS):

```javascript
// 타겟 중심이 툴팁 좌측 어디에 위치하는지 계산
function calcArrowX(targetRect, tooltipLeft, tooltipWidth) {
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const ax = targetCenterX - tooltipLeft;
    // 툴팁 범위 내로 clamp (양끝 16px 여백)
    const clamped = Math.max(16, Math.min(ax, tooltipWidth - 16));
    return `${clamped}px`;
}

// 사용: tooltipEl.style.setProperty('--ax', calcArrowX(rect, left, tooltipWidth));
```

화살표가 항상 대상 중심을 정확히 가리킴 (고정 `left: 50%`가 아닌 동적 계산).

### 4-3. 타겟 스크롤

```javascript
// 타겟이 뷰포트 밖이면 먼저 스크롤
function scrollToTarget(targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!inView) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
// showStep()에서 highlight 배치 전에 호출
// ⚠️ smooth scroll은 비동기 — scroll 완료 후 getBoundingClientRect() 해야 정확.
//    방법 1: 'scrollend' 이벤트 대기 후 배치
//    방법 2: behavior: 'instant'로 즉시 스크롤 (애니메이션 없음)
//    방법 3: requestAnimationFrame 또는 setTimeout(, 300) 후 배치
```

### 4-4. 툴팁 기본 CSS

```css
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

.tutorial-tooltip__title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--t1);
    margin-bottom: 8px;
}

.tutorial-tooltip__content {
    font-size: 0.9rem;
    color: var(--t2);
    line-height: 1.5;
    margin-bottom: 16px;
}

.tutorial-tooltip__close {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    font-size: 1.1rem;
    color: var(--t3);
    cursor: pointer;
    padding: 4px 8px;
}

.tutorial-tooltip__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.tutorial-tooltip__prev {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 0.85rem;
    cursor: pointer;
    color: var(--t2);
}

.tutorial-tooltip__next {
    background: var(--acc);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 8px 20px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
}

.tutorial-tooltip__progress {
    color: var(--t3);
    font-size: 0.8rem;
}

@keyframes tutorialFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
}
```

---

## 5. 버튼 구성

> LAMDice 교훈: "건너뛰기 + 다음"에서 **"✕ 닫기 + ← 이전 + 다음"**으로 변경. 이전 버튼은 UX에 큰 차이.

```
┌──────────────────────────────────┐
│                           [✕]   │  ← 우상단 닫기 (튜토리얼 종료)
│  제목                           │
│  설명 텍스트                     │
│                                  │
│  [← 이전]          1/N  [다음→] │  ← 첫 스텝에서는 이전 숨김
└──────────────────────────────────┘
```

- **✕ 닫기**: `stop()` 호출 → cleanup 일괄 실행 + setSeen 저장 (다시 안 뜸)
- **← 이전**: 현재 스텝 `cleanup()` 호출 후 이전으로 (첫 스텝에서는 숨김)
- **다음 →**: 마지막 스텝에서는 "완료"로 변경 → `complete()` 호출 (= stop()과 동일)

---

## 6. 가시성 판정

> LAMDice 교훈: `offsetParent`는 `position: fixed`에서 null 반환하여 오판. `getComputedStyle`이 정확.

```javascript
function isVisible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
}
```

---

## 7. beforeShow / cleanup 콜백

> LAMDice에서 설계에 없었으나 **가장 중요한 추가 기능**.
> 타겟 요소가 DOM에 없는 상태에서도 임시 주입 후 튜토리얼 가능.

```javascript
// 스텝 정의 예시
{
    target: '.overtime-section',
    fallbackTarget: '.main-content',  // target 못 찾을 때 대체 (선택)
    title: '초과근무 기록',
    content: '초과근무 시간을 입력하고 관리합니다.',
    position: 'bottom',
    
    // 스텝 표시 전에 실행 (DOM 주입 등)
    beforeShow: function() {
        injectDemoOvertimeUI();
    },
    
    // 스텝 떠날 때 정리 (DOM 제거 등)
    cleanup: function() {
        removeDemoOvertimeUI();
    }
}
```

### Step Schema 전체 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `target` | string | ✅ | CSS 셀렉터 |
| `fallbackTarget` | string | - | target 못 찾을 때 대체 셀렉터 |
| `title` | string \| function | ✅ | 제목 (함수면 호출 결과 사용) |
| `content` | string \| function | ✅ | 설명 (함수면 호출 결과 사용) |
| `position` | 'top' \| 'bottom' | - | 툴팁 위치 (기본 'bottom', 좌우 입력 시 무시) |
| `beforeShow` | function | - | 스텝 표시 전 실행 (DOM 주입 등) |
| `cleanup` | function | - | 스텝 떠날 때 실행 (DOM 제거 등) |

### 핵심 동작 규칙

| 상황 | 동작 |
|------|------|
| `beforeShow` 있는 스텝 | 가시성 검사 스킵 → `beforeShow`가 DOM을 만들어줄 것으로 신뢰 |
| `prev()` 호출 시 | 현재 스텝의 `cleanup()` 실행 후 이전 스텝으로 |
| `next()` 호출 시 | cleanup **안 함** (스텝 레이어링 가능) |
| 튜토리얼 완료/종료 시 | `_complete()`에서 모든 스텝의 `cleanup()` 일괄 실행 |

### 활용 시나리오

- 비로그인 사용자에게 데모 UI 주입 (서버 카드, 승인 대기 상태 등)
- 아직 접근 못하는 페이지의 기능을 미리 보여주기
- 특정 상태에서만 보이는 UI를 임시로 표시

---

## 8. 함수형 title / content

> LAMDice 교훈: 상태에 따라 메시지가 달라야 하는 경우 `hostOnly` 플래그보다 함수형이 유연.

```javascript
{
    target: '.record-section',
    title: '근무 기록',
    content: function() {
        // 오늘 이미 기록이 있는지에 따라 다른 메시지
        const hasRecord = document.querySelector('.today-record');
        if (hasRecord) {
            return '오늘 기록이 이미 있네요! 여기서 수정할 수 있습니다.';
        }
        return '출근/퇴근 시간을 기록합니다. 버튼 한 번으로 간편하게!';
    },
    position: 'bottom'
}
```

`typeof step.content === 'function' ? step.content() : step.content` 패턴으로 처리.

---

## 9. 튜토리얼 스텝 설계 원칙

> LAMDice 교훈: "최소 스텝"(4개)으로 설계했다가 사용자 여정을 빠뜨려 8개로 대폭 추가됨.
> **처음부터 사용자 플로우 전체를 스텝으로 잡을 것.**

> *각 스텝의 실제 target/title/content는 구현 시 페이지 DOM을 확인 후 확정. 아래는 포맷 예시.*

### 9-1. 로그인 페이지 (`/login`)

> ⚠️ 셀렉터는 실제 DOM 확인 후 교체

| # | target | title | content | position | beforeShow |
|---|--------|-------|---------|----------|------------|
| 1 | `[아이디 입력 필드]` | 로그인 | 아이디와 비밀번호를 입력하세요 | bottom | - |
| 2 | `[회원가입 링크]` | 회원가입 | 처음이시라면 여기서 계정을 만드세요 | bottom | - |

### 9-2. 대시보드 (로그인 후) — 전체 사용자 여정

> **비로그인 원칙 (LAMDice 교훈)**: 타겟이 없을 때 "자동 스킵"은 쉽지만,
> 비로그인 사용자가 핵심 기능을 전혀 못 보게 됨.
> `beforeShow`로 fake UI를 주입해서 전체 여정을 체험시키는 것이 UX적으로 우월.
> LAMDice에서 설계(4스텝 auto-skip) → 구현(8스텝 fake UI 주입)으로 변경된 핵심 이유.

| # | target | title | content | position | beforeShow / cleanup |
|---|--------|-------|---------|----------|---------------------|
| 1 | `[출퇴근 기록 버튼]` | 출퇴근 기록 | 출근/퇴근 시간을 기록합니다 | bottom | - |
| 2 | `[기록 입력 폼]` | 시간 입력 | 출근·퇴근 시간을 선택하세요 | bottom | `beforeShow: 폼 열기` |
| 3 | `[초과근무 섹션]` | 초과근무 | 초과근무 시간을 입력하고 관리합니다 | bottom | - |
| 4 | `[급량비 섹션]` | 급량비 기록 | 급량비 정보를 기록합니다 | bottom | - |
| 5 | `[캘린더/월간 뷰]` | 월간 조회 | 한 달 근무 기록을 한눈에 확인 | top | 해당 요소 없으면 자동 스킵 |
| 6 | `[설정/프로필]` | 내 정보 | 근무 설정을 관리합니다 | bottom | - |

### 셀렉터 확인 방법
```bash
# 프로젝트에서 실제 사용 중인 클래스/ID 확인
grep -r "class=" src/routes/ --include="*.svelte" | head -50
grep -r "id=" src/routes/ --include="*.svelte" | head -50
```

---

## 10. 완료 추적: localStorage + DB 이중 저장

> LAMDice 교훈: localStorage만으로는 크로스 디바이스 지원 불가. DB bit flags 병행.

### 10-1. 저장 구조

```
localStorage: tutorialSeen_login = 'v1'
              tutorialSeen_dashboard = 'v1'

DB (users 테이블): tutorial_flags INTEGER (bit flags)
  bit 0 = login 튜토리얼
  bit 1 = dashboard 튜토리얼
  bit 2 = (향후 확장)
```

### 10-2. 확인 로직 (이중 체크)

> 아래는 개념 설명. 실제 Svelte 구현은 §13-3의 `createHasSeenStore()` 참조.

```javascript
function hasSeen(tutorialKey) {
    const bit = FLAG_BITS[tutorialKey];
    // 로그인 유저: DB 우선
    if (bit && flagsLoaded && (serverFlags & bit)) return true;
    // 비로그인 / 폴백: localStorage
    return localStorage.getItem(`tutorialSeen_${tutorialKey}`) === 'v1';
}
```

### 10-3. SvelteKit에서의 구현

**DB 스키마 변경 (db.js init()에 추가)**:
```sql
-- users 테이블에 tutorial_flags 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS tutorial_flags INTEGER DEFAULT 0;
```

**API Route**:
```javascript
// src/routes/api/tutorial-flags/+server.js
import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

// 허용된 flag 값만 (보안)
const VALID_FLAGS = [1, 2]; // login=1, dashboard=2, 향후 확장 시 추가

// GET: 현재 유저의 flags 조회
export async function GET({ locals }) {
    if (!locals.user) return json({ ok: true, flags: 0 });
    const r = await pool.query(
        'SELECT tutorial_flags FROM users WHERE id = $1',
        [locals.user.user_id]
    );
    return json({ ok: true, flags: r.rows[0]?.tutorial_flags || 0 });
}

// POST: flags 업데이트 (OR 연산으로 비트 추가)
export async function POST({ request, locals }) {
    if (!locals.user) return new Response(null, { status: 401 });
    const { flag } = await request.json();
    if (!VALID_FLAGS.includes(flag)) return json({ ok: false, message: 'Invalid flag' }, { status: 400 });
    // 현재 flags를 DB에서 읽어온 후 OR 연산
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

## 11. "?" 도움말 버튼

> LAMDice 교훈: container 하단은 스크롤 시 안 보임. **항상 보이는 고정 위치(header)에 배치**.

```css
.help-btn {
    /* header 우측에 배치 (position: fixed 또는 header 내부) */
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--acc);
    color: #fff;
    border: 2px solid var(--acc-soft);
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: bold;
    box-shadow: 0 2px 8px var(--acc-soft);
    transition: transform 0.2s;
}

.help-btn:hover {
    transform: scale(1.1);
}

/* 첫 방문 유도용 pulse (비로그인 또는 미완료 시) */
@keyframes helpPulse {
    0%, 100% { box-shadow: 0 0 0 0 var(--acc-soft); }
    50%      { box-shadow: 0 0 0 8px transparent; }
}
.help-btn--pulse {
    animation: helpPulse 2s ease-in-out infinite;
}
```

**자동 시작 대신 버튼 pulse로 유도** — LAMDice에서도 setTimeout 자동 시작 → 버튼 pulse 유도로 변경됨.

---

## 12. 모바일 대응

> LAMDice 교훈: 상하 전용 배치 + flip/clamp로 PC/모바일 JS 분기 불필요. CSS만 별도.

```css
@media (max-width: 480px) {
    .tutorial-tooltip {
        max-width: calc(100vw - 32px);
        font-size: 0.85rem;
        padding: 14px;
    }

    .tutorial-highlight {
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55); /* 모바일: 약간 밝게 */
    }

    .tutorial-tooltip__footer {
        gap: 6px;
    }
}
/* ⚠️ 공노기 규칙: app.css 내 색상 하드코딩 금지 (#fff 제외).
   위 CSS의 모든 색상은 var(--acc), var(--surface), var(--t1~t3), var(--border) 등 CSS 변수 사용.
   dimmed overlay의 rgba(0,0,0,0.65)는 반투명 검정으로 테마 무관하므로 예외 허용. */
```

JS 분기 없이 CSS `@media`만으로 충분.

---

## 13. Svelte 컴포넌트 설계

### 13-1. 파일 구조

```
src/
  routes/
    Tutorial.svelte          ← 메인 컴포넌트 (기존 컴포넌트와 동일 위치)
  lib/
    stores.js                ← 기존 stores에 튜토리얼 상태 통합
                                (tutorialFlags, flagsLoaded, createHasSeenStore, setSeen, loadFlags)
```

> ⚠️ 공노기 프로젝트는 컴포넌트가 `src/routes/`에 직접 배치 (Calendar.svelte, DaySheet.svelte 등).
> Store는 `src/lib/stores.js` 단일 파일. 별도 `stores/` 디렉토리 없음.

### 13-2. Tutorial.svelte 인터페이스

```svelte
<script>
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    
    export let steps = [];
    export let tutorialKey = '';
    export let autoStartDelay = 0;  // 0이면 버튼 pulse로 유도
    
    let currentStep = 0;
    let isActive = false;
    
    // 공개 메서드
    export function start(force = false) { ... }
    export function stop() { ... }
    export function reset() { ... }
    export function prev() { ... }
    export function next() { ... }
    
    // ⚠️ 컴포넌트 파괴 시 정리 (페이지 이동 등)
    onDestroy(() => {
        if (!browser) return;
        if (isActive) stop();
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('keydown', handleKeydown);
    });
</script>

<!-- 
    ⚠️ 컴포넌트가 highlight/tooltip/blocker DOM을 자동 생성.
    페이지 HTML에 수동으로 추가할 것 없음.
-->
```

### 13-3. tutorial store (상태 관리)

```javascript
// src/lib/stores.js 에 아래 코드 추가 (기존 stores에 통합)
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// DB에서 로드된 flags
export const tutorialFlags = writable(0);
export const flagsLoaded = writable(false);

const FLAG_BITS = {
    login: 1,
    dashboard: 2,
    // 향후 확장...
};

// 특정 튜토리얼 완료 여부 (Svelte store로 반응형)
export function createHasSeenStore(tutorialKey) {
    return derived([tutorialFlags, flagsLoaded], ([$flags, $loaded]) => {
        const bit = FLAG_BITS[tutorialKey];
        if (bit && $loaded && ($flags & bit)) return true;
        if (!browser) return false;
        return localStorage.getItem(`tutorialSeen_${tutorialKey}`) === 'v1';
    });
}

// 완료 기록
export async function setSeen(tutorialKey) {
    if (browser) {
        localStorage.setItem(`tutorialSeen_${tutorialKey}`, 'v1');
    }
    const bit = FLAG_BITS[tutorialKey];
    if (bit) {
        tutorialFlags.update(f => f | bit);
        // DB 저장 (로그인 유저)
        try {
            await fetch('/api/tutorial-flags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flag: bit })
            });
        } catch (e) { /* 비로그인이면 실패해도 무시 */ }
    }
}

// 페이지 로드 시 DB에서 flags 불러오기
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

### 13-4. 핵심 로직 흐름

```
start(force?)
  ├─ force=false이고 hasSeen(tutorialKey) → 종료
  ├─ isActive = true
  ├─ click-blocker 생성
  ├─ currentStep = 0
  └─ showStep(0)

showStep(index)
  ├─ step = steps[index]
  ├─ step.beforeShow 있으면 → beforeShow() 실행
  ├─ target = querySelector(step.target)
  ├─ target 없으면 → querySelector(step.fallbackTarget)
  ├─ target 찾음 + (beforeShow 있었거나 isVisible(target)) → 진행
  ├─ target 못 찾음 or 안 보임 → findNext(index) (아래 참조)
  ├─ scrollToTarget(target)              ← 뷰포트 밖이면 스크롤
  ├─ scroll 완료 대기 후 getBoundingClientRect()
  ├─ highlight 위치/크기 세팅 + box-shadow 딤드
  ├─ tooltip 위치 계산 (상하 전용 + flip + clamp)
  ├─ --ax CSS 변수로 화살표 위치 계산
  └─ tooltip 표시

next()
  ├─ cleanup 안 함 (레이어링 허용)
  ├─ currentStep++
  ├─ >= steps.length → complete()
  └─ showStep(currentStep)

prev()
  ├─ currentStep === 0 → 무시 (no-op)
  ├─ 현재 스텝 cleanup() 실행
  ├─ currentStep--
  └─ showStep(currentStep)

stop()                         ← ✕ 닫기 클릭 또는 ESC 키
  ├─ 모든 스텝의 cleanup() 일괄 실행
  ├─ setSeen(tutorialKey)      ← 다시 안 뜨도록 완료 처리
  ├─ DOM 정리 (blocker, highlight, tooltip 제거)
  └─ isActive = false

complete()                     ← 마지막 스텝 "완료" 클릭
  └─ stop()과 동일 (내부적으로 stop() 호출)

reset(tutorialKey)             ← 테스트/디버깅용
  ├─ localStorage.removeItem(`tutorialSeen_${tutorialKey}`)
  └─ tutorialFlags에서 해당 bit 제거

findNext(fromIndex)            ← 스킵할 다음 유효 스텝 탐색
  ├─ fromIndex+1부터 순회
  ├─ beforeShow 있는 스텝 → 유효 (가시성 미검사)
  ├─ target이 DOM에 있고 isVisible → 유효
  ├─ 유효 스텝 발견 → showStep(해당 index)
  └─ 끝까지 못 찾으면 → complete()
```

---

## 14. 사용 예시 (페이지 적용)

```svelte
<!-- src/routes/+page.svelte (메인 페이지 = 대시보드) -->
<script>
    import { onMount } from 'svelte';
    import Tutorial from './Tutorial.svelte';
    import { createHasSeenStore, loadFlags } from '$lib/stores.js';
    
    let tutorialRef;
    const hasSeenDashboard = createHasSeenStore('dashboard');
    
    onMount(() => {
        loadFlags(); // 로그인 유저면 DB에서 flags 로드
    });
    
    const steps = [
        {
            target: '.btn-commute',
            title: '출퇴근 기록',
            content: '출근/퇴근 시간을 기록합니다.',
            position: 'bottom'
        },
        {
            target: '.section-overtime',
            title: '초과근무',
            content: function() {
                return hasOvertimeData()
                    ? '기존 초과근무 기록을 수정할 수 있어요.'
                    : '초과근무 시간을 입력하고 관리합니다.';
            },
            position: 'bottom'
        },
        {
            target: '.demo-record',
            title: '기록 확인',
            content: '이렇게 기록이 저장됩니다.',
            position: 'top',
            beforeShow: () => injectDemoRecord(),
            cleanup: () => removeDemoRecord()
        }
    ];
</script>

<Tutorial bind:this={tutorialRef} {steps} tutorialKey="dashboard" />

<!-- header 내부 ? 버튼 -->
<button 
    class="help-btn" 
    class:help-btn--pulse={!$hasSeenDashboard}
    on:click={() => tutorialRef.start(true)}
>
    ?
</button>
```

---

## 15. 엣지 케이스

| 상황 | 처리 |
|------|------|
| target이 DOM에 없음 + beforeShow 없음 | fallbackTarget 시도 → 둘 다 없으면 findNext로 스킵 |
| target이 DOM에 없음 + beforeShow 있음 | beforeShow 실행 → 가시성 검사 스킵 |
| target이 `display:none` | `getComputedStyle` 체크 → 스킵 |
| target이 뷰포트 밖 | `scrollIntoView` 후 scroll 완료 대기 → 배치 |
| 남은 스텝이 전부 스킵 대상 | findNext가 끝까지 못 찾으면 → complete() |
| 윈도우 리사이즈 | resize 이벤트에 highlight + tooltip 위치 재계산 |
| ESC 키 | stop() → cleanup + setSeen + DOM 정리 |
| ✕ 닫기 클릭 | stop() → ESC와 동일 동작 |
| 모바일 뷰포트 | CSS `@media 480px`만 (JS 분기 없음) |
| SSR 환경 | `browser` 체크로 서버사이드 실행 방지 |
| 컴포넌트 파괴 (페이지 이동) | `onDestroy`에서 stop() + 이벤트 리스너 해제 |
| prev() at step 0 | no-op (첫 스텝에서 이전 버튼은 숨겨짐 + 로직에서도 무시) |
| prev()에서 cleanup | 현재 스텝 cleanup 실행 후 이전으로 |
| next()에서 cleanup | 안 함 (레이어링 허용, stop()에서 일괄 정리) |

---

## 16. 구현 순서

```
1단계: DB 스키마 변경
   → db.js init()에 ALTER TABLE users ADD COLUMN IF NOT EXISTS tutorial_flags INTEGER DEFAULT 0 추가
   → 서버 재시작 시 자동 적용

2단계: Tutorial.svelte 컴포넌트 생성
   → src/routes/Tutorial.svelte (기존 컴포넌트 패턴)
   → click-blocker + highlight(box-shadow spotlight) + tooltip
   → 상하 전용 배치 + flip + clamp + scrollIntoView
   → ✕ 닫기 + ← 이전 + 다음 버튼
   → beforeShow / cleanup 콜백 지원
   → 함수형 title/content 지원
   → fallbackTarget 지원
   → getComputedStyle 가시성 판정
   → ESC 키 종료, resize 대응, onDestroy 정리

3단계: tutorial store + API route 생성
   → $lib/stores.js에 튜토리얼 관련 코드 통합 (createHasSeenStore, setSeen, loadFlags)
   → /api/tutorial-flags (GET + POST)

4단계: 각 페이지 실제 셀렉터 확인
   → grep으로 class/id 검색
   → 기존 z-index 최대값 확인
   → 페이지별 steps 배열 작성

5단계: 페이지에 Tutorial 컴포넌트 삽입
   → src/routes/+page.svelte에 import Tutorial from './Tutorial.svelte' + ? 버튼
   → pulse 애니메이션 (미완료 시)

6단계: 테스트 (아래 체크리스트)
```

### 구현 시 주의사항

| 항목 | 설명 |
|------|------|
| **HTML 수동 주입 불필요** | Tutorial.svelte가 blocker/highlight/tooltip DOM을 자동 생성. 페이지 HTML에 추가할 것 없음 |
| **사운드** | LAMDice 설계에 있었으나 미구현. 필요 시 별도 결정 (우선순위 낮음) |
| **highlight pulse vs ? 버튼 pulse** | 둘은 별개. highlight에는 pulse 불필요 (box-shadow가 충분), ? 버튼에만 pulse 적용 |
| **config 파일** | 별도 config 파일 불필요. 상수(FLAG_BITS 등)는 store 내 정의로 충분 |

---

## 17. 검증 체크리스트

```
[오버레이]
□ 타겟 요소 밝게 + 나머지 box-shadow 딤드 (별도 overlay div 없음)
□ var(--acc) border 강조 (highlight pulse 불필요, ? 버튼 pulse와 혼동 금지)
□ click-blocker가 배경 클릭 정상 차단

[툴팁 배치]
□ 상하 전용 배치 + 자동 flip (좌우 입력 시 무시)
□ 화살표(--ax)가 타겟 중심을 정확히 가리킴
□ 뷰포트 밖 타겟에 scrollIntoView 동작 (scroll 완료 후 배치)

[버튼/네비게이션]
□ "✕ 닫기" + "← 이전" + "다음 →" 3버튼 구성
□ 첫 스텝에서 이전 버튼 숨김 (prev()도 no-op)
□ 마지막 스텝에서 "완료" 표시
□ ESC 키 → stop() 호출

[콜백/동적 기능]
□ beforeShow 콜백으로 DOM 주입 동작
□ cleanup 콜백으로 DOM 정리 동작
□ prev() 시 현재 cleanup 실행
□ stop()/complete() 시 모든 cleanup 일괄 실행
□ 함수형 content 동작 (조건부 메시지)

[스킵 로직]
□ 없는 타겟 → fallbackTarget 시도 → 둘 다 없으면 자동 스킵
□ beforeShow 있는 스텝은 가시성 검사 스킵
□ getComputedStyle로 display:none 감지
□ findNext가 끝까지 유효 스텝 없으면 → complete()

[저장/추적]
□ stop()과 complete() 모두 setSeen 호출 (✕ 닫기 해도 다시 안 뜸)
□ localStorage + DB 이중 저장
□ DB 스키마에 tutorial_flags 컬럼 존재 (ALTER TABLE으로 추가)
□ API route: pool.query() + json() 헬퍼 사용 + flag 값 검증
□ 비로그인 시 localStorage만으로 동작
□ reset()으로 seen 상태 초기화 가능 (테스트용)

[UI]
□ ? 버튼 header 고정 위치
□ 미완료 시 ? 버튼 pulse 애니메이션
□ 윈도우 리사이즈 시 위치 재계산

[환경]
□ 모바일(480px 이하) CSS 적용
□ SSR에서 에러 안 남 (browser 체크)
□ 페이지 이동 시 onDestroy에서 정리 (이벤트 리스너 해제)
```

---

## 부록: LAMDice 설계↔구현 차이에서 배운 핵심 교훈 요약

이 문서는 아래 교훈들을 **이미 반영**한 상태:

| # | 교훈 | 반영 위치 |
|---|------|----------|
| 1 | 별도 overlay div 불필요, box-shadow가 딤드 겸용 | §3 |
| 2 | z-index는 기존 UI 확인 후 설정 | §3.4 |
| 3 | highlight pulse 불필요 (? 버튼 pulse와 별개) | §3.2, §16 주의사항 |
| 4 | 이전(←) 버튼 필수 | §5 |
| 5 | 좌우 배치 제거, 상하 전용 | §4.1 |
| 6 | `getComputedStyle` > `offsetParent` | §6 |
| 7 | beforeShow/cleanup 콜백 필수 | §7 |
| 8 | 함수형 title/content | §8 |
| 9 | 전체 사용자 여정을 처음부터 스텝으로 잡기 | §9 |
| 10 | 비로그인 시 auto-skip보다 fake UI 주입이 UX 우월 | §9.2 |
| 11 | localStorage + DB 이중 추적 | §10 |
| 12 | ? 버튼은 header 고정 위치 | §11 |
| 13 | 자동 시작 대신 버튼 pulse로 유도 | §11 |
| 14 | 모바일은 CSS만, JS 분기 불필요 | §12 |
| 15 | next()는 cleanup 안 함, complete()에서 일괄 | §7 |
| 16 | 화살표 --ax CSS 변수로 동적 계산 | §4.2 |
| 17 | fallbackTarget으로 대체 타겟 지원 | §7 Step Schema |
| 18 | scrollIntoView로 뷰포트 밖 타겟 대응 | §4.3 |
| 19 | onDestroy에서 이벤트 리스너 해제 | §13.2 |
| 20 | 컴포넌트가 DOM 자동 생성 — HTML 수동 주입 불필요 | §16 주의사항 |
| 21 | 별도 config 파일 불필요 — 상수는 store 내 정의 | §16 주의사항 |
| 22 | 사운드: 설계에 있었으나 미구현, 우선순위 낮음 | §16 주의사항 |
