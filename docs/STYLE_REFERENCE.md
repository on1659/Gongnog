# 스타일 레퍼런스 (mockup_ios.html 기반)

> 이 파일은 mockup_ios.html에서 추출한 모든 CSS 클래스와 스타일 규칙이다.
> app.css 작성 시 이 파일을 기준으로 한다.
> **색상값은 절대 하드코딩하지 않고 themes.css의 CSS 변수를 사용한다.**
> (#fff 흰색 텍스트만 예외)

---

## 전역 기본

```css
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
body { font-family: 'Noto Sans KR', sans-serif; background: var(--surface); display: flex; justify-content: center; min-height: 100vh; }
#app { width: 100%; max-width: 390px; min-height: 100vh; background: var(--bg); display: flex; flex-direction: column; position: relative; box-shadow: 0 0 60px rgba(0,0,0,.12); }
```

---

## 로그인 화면

| 클래스 | 용도 | 핵심 속성 |
|--------|------|-----------|
| `.login-hero` | 히어로 영역 | `flex:1; justify-content:center` |
| `.login-logo` | "근무" 타이틀 | `font-size:38px; font-weight:800; color:var(--acc)` |
| `.login-logo-sub` | "기록" 서브타이틀 | `font-size:38px; font-weight:300; color:var(--t2)` |
| `.login-desc` | 설명 텍스트 | `font-size:13px; color:var(--t3)` |
| `.login-divider` | 구분선 | `height:1px; background:var(--border); margin:32px 0` |
| `.lf-label` | 입력 라벨 | `font-size:11px; font-weight:700; color:var(--t3); uppercase` |
| `.lf-input` | 입력 필드 | `border-bottom:1.5px solid var(--border); font-size:16px` |
| `.lf-input:focus` | 포커스 | `border-bottom-color:var(--acc)` |
| `.login-btn` | 로그인 버튼 | `padding:16px; border-radius:16px; background:var(--acc); color:#fff; font-weight:700` |
| `.login-sub` | 하단 링크 | `font-size:13px; color:var(--t3)` |
| `.login-sub a` | 링크 | `color:var(--acc); font-weight:600` |

```
레이아웃: flex-column, justify-content:flex-end, min-height:100vh, padding:0 28px 52px
```

---

## 캘린더 헤더

| 클래스 | 용도 | 핵심 속성 |
|--------|------|-----------|
| `.month-year` | 년도 텍스트 | `font-size:13px; font-weight:500; color:var(--t3)` |
| `.month-big` | 큰 월 숫자 | `font-size:58px; font-weight:300; color:var(--t1); letter-spacing:-4px` |
| `.topbar-icons` | 아이콘 버튼 그룹 | `display:flex; gap:6px` |
| `.ico-btn` | 36x36 아이콘 버튼 | `width:36px; height:36px; border-radius:10px; background:var(--surface); color:var(--t2)` |

### 닉네임 칩 (인라인 스타일 — 목업 기준)
```css
/* 칩 래퍼 */
display:flex; align-items:center; gap:4px;
background:var(--surface); border-radius:7px; padding:3px 8px 3px 4px;

/* 아바타 */
width:16px; height:16px; border-radius:4px; background:var(--acc);
font-size:9px; font-weight:700; color:#fff;

/* 닉네임 */
font-size:11px; font-weight:600; color:var(--t2);

/* 로그아웃 버튼 */
width:26px; height:26px; border-radius:7px; background:var(--surface); color:var(--t2);
```

---

## 요약 스트립

```css
.summary-row { display:flex; gap:8px; padding:12px 16px 0; }
.spill { flex:1; background:var(--surface); border-radius:12px; padding:10px 12px; border-left:3px solid var(--c, var(--acc)); }
.spill-lbl { font-size:10px; font-weight:600; color:var(--t3); }
.spill-val { font-size:13px; font-weight:700; color:var(--t1); margin-top:3px; }
```

각 spill에 `--c` 커스텀 프로퍼티로 테두리 색상 지정:
- 총 근무: `--c: var(--acc)`
- 초과: `--c: var(--ot-c)` + `.spill-val` color: `var(--ot-c)`
- 급량 수지: `--c: var(--meal-c)`

---

## 요일 헤더 + 캘린더 그리드

```css
.week-hdr { display:grid; grid-template-columns:repeat(7,1fr); padding:16px 10px 6px; }
.wlbl { text-align:center; font-size:11px; font-weight:700; color:var(--t3); }
/* 토요일: color:var(--sat-c), 일요일: color:var(--sun-c) */

.cal-wrap { padding:0 6px; }
.cal-row { display:grid; grid-template-columns:repeat(7,1fr); }

.dcell { min-height:62px; padding:3px; cursor:pointer; display:flex; flex-direction:column; align-items:center; border-radius:10px; transition:.1s; }
.dnum-ring { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; margin-bottom:2px; }
.dnum { font-size:14px; font-weight:500; color:var(--t1); }

/* 오늘 */
.dcell.is-today .dnum-ring { background:var(--today-bg); }
.dcell.is-today .dnum { color:#fff !important; }

/* 선택됨 (오늘 아닐 때) */
.dcell.is-sel:not(.is-today) .dnum-ring { background:var(--acc-soft); border:1.5px solid var(--acc); }
.dcell.is-sel:not(.is-today) .dnum { color:var(--acc-text) !important; }

/* 이벤트 바 */
.ev-list { width:100%; display:flex; flex-direction:column; gap:1.5px; }
.ev { width:100%; border-radius:3px; padding:1.5px 4px; font-size:8.5px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
```

---

## 상세 영역 (캘린더 하단)

```css
.detail-wrap { flex:1; border-top:1px solid var(--border); overflow-y:auto; min-height:0; }
.detail-hdr { padding:16px 20px 8px; display:flex; align-items:center; justify-content:space-between; }
.detail-date { font-size:18px; font-weight:700; color:var(--t1); }
.detail-tag { font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px; background:var(--surface); }
.detail-list { padding:0 14px 110px; }
.detail-empty { padding:40px 20px; text-align:center; color:var(--t3); font-size:14px; line-height:2; }
```

### 근무 카드
```css
.dcard { background:var(--surface); border-radius:16px; padding:16px; display:flex; gap:14px; margin-bottom:8px; animation:fadeUp .22s ease both; }
.dcard-bar { width:3.5px; border-radius:2px; flex-shrink:0; background:var(--acc); }
.dcard-body { flex:1; }
.dcard-title { font-size:15px; font-weight:600; color:var(--t1); margin-bottom:6px; }
.dcard-time { font-size:13px; color:var(--t2); margin-bottom:8px; display:flex; align-items:center; gap:6px; }
.dcard-chips { display:flex; gap:5px; flex-wrap:wrap; }

@keyframes fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
```

### 칩 (chip)
```css
.chip { font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; }
.chip-ot { background:var(--chip-ot-bg); color:var(--ot-c); }
.chip-meal { background:var(--chip-meal-bg); color:var(--meal-c); }
.chip-we { background:var(--acc-soft); color:var(--acc-text); }
```

### 급량비 수지 카드
```css
.mfcard { background:var(--surface); border-radius:16px; padding:16px; margin-bottom:8px; animation:fadeUp .22s ease .05s both; }
.mfc-title { font-size:12px; font-weight:700; color:var(--t3); margin-bottom:10px; }
.mfc-row { display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid var(--border); }
.mfc-row:last-child { border-bottom:none; }
.mfc-label { font-size:13px; color:var(--t2); }
.mfc-val { font-size:13px; font-weight:700; }
.pos { color:var(--pos-c); }
.neg { color:var(--neg-c); }
.mfc-net { font-size:16px; }
```

---

## 하단 바

```css
.btm-bar { position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:390px; background:var(--bg); border-top:1px solid var(--border); padding:10px 20px 28px; display:flex; align-items:center; justify-content:space-between; z-index:10; }
.add-btn { display:flex; align-items:center; gap:7px; background:none; border:none; font-size:15px; font-weight:700; color:var(--acc); cursor:pointer; font-family:inherit; }
.nav-pills { display:flex; background:var(--surface); border-radius:10px; overflow:hidden; }
.npill { padding:7px 14px; border:none; background:none; font-size:12px; font-weight:600; color:var(--t3); cursor:pointer; font-family:inherit; }
.npill.on { background:var(--acc); color:#fff; }
```

---

## 모달 공통 (Bottom Sheet)

```css
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); backdrop-filter:blur(8px); z-index:200; display:flex; align-items:flex-end; justify-content:center; opacity:0; pointer-events:none; transition:opacity .25s; }
.modal-overlay.open { opacity:1; pointer-events:all; }
.modal-sheet { background:var(--bg); border-radius:26px 26px 0 0; padding:18px 20px 38px; width:100%; max-width:390px; transform:translateY(100%); transition:transform .32s cubic-bezier(.25,.46,.45,.94); max-height:90vh; overflow-y:auto; }
.modal-overlay.open .modal-sheet { transform:none; }
.mhandle { width:38px; height:4px; background:var(--border); border-radius:2px; margin:0 auto 16px; }
.modal-date { font-size:19px; font-weight:700; color:var(--t1); }
.modal-badge { display:inline-block; font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; margin:6px 0 16px; background:var(--surface); color:var(--t2); }
```

### 입력 모달 전용
```css
.msec-lbl { font-size:11px; font-weight:700; color:var(--t3); letter-spacing:.5px; text-transform:uppercase; margin:14px 0 8px; }
.time-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:4px; }
.tf label { font-size:11px; color:var(--t3); font-weight:600; display:block; margin-bottom:5px; }
.tf input[type=time] { width:100%; padding:12px; border-radius:12px; border:none; background:var(--surface); font-size:17px; font-weight:600; font-family:inherit; color:var(--t1); outline:none; }

.calc-chips { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin:10px 0; }
.cchip { background:var(--surface); border-radius:12px; padding:10px 10px 8px; }
.cchip-lbl { font-size:10px; color:var(--t3); font-weight:600; margin-bottom:3px; }
.cchip-val { font-size:14px; font-weight:700; }

.modal-hint { font-size:11px; color:var(--t3); margin:6px 0 14px; line-height:1.5; }

.mbpreview { background:var(--surface); border-radius:12px; padding:12px 14px; margin:10px 0; }
.mbp-row { display:flex; justify-content:space-between; padding:3px 0; }
.mbp-lbl { font-size:12px; color:var(--t2); }
.mbp-val { font-size:12px; font-weight:700; }
.mbp-div { height:1px; background:var(--border); margin:6px 0; }
.mbp-net { display:flex; justify-content:space-between; padding:3px 0; }
.mbp-net-lbl { font-size:13px; font-weight:700; color:var(--t1); }
.mbp-net-val { font-size:14px; font-weight:800; }

.memo-field label { font-size:11px; color:var(--t3); font-weight:600; display:block; margin-bottom:5px; }
.memo-field input { width:100%; padding:12px; border-radius:12px; border:none; background:var(--surface); font-size:14px; font-family:inherit; color:var(--t1); outline:none; margin-bottom:18px; }

.modal-btns { display:flex; gap:8px; }
.mbtn-del { padding:14px; border-radius:14px; border:none; background:var(--surface); color:var(--sun-c); font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; }
.mbtn-cancel { flex:1; padding:14px; border-radius:14px; border:none; background:var(--surface); font-size:14px; font-family:inherit; cursor:pointer; color:var(--t2); }
.mbtn-save { flex:2; padding:14px; border-radius:14px; border:none; background:var(--acc); color:#fff; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; }
```

---

## 통계 뷰

```css
.stats-topbar { padding:20px 20px 12px; display:flex; align-items:center; justify-content:space-between; }
.stats-title { font-size:24px; font-weight:700; color:var(--t1); }
.stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:0 14px; }
.sbox { background:var(--surface); border-radius:16px; padding:14px 16px; }
.sbox-lbl { font-size:11px; font-weight:600; color:var(--t3); margin-bottom:4px; }
.sbox-val { font-size:22px; font-weight:700; color:var(--t1); }
.sbox-val.ot { color:var(--ot-c); }
.sbox-val.ml { color:var(--meal-c); }
.sbox-val.ac { color:var(--acc); }

.stat-sect { margin:10px 14px 0; background:var(--surface); border-radius:16px; overflow:hidden; }
.srow { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border); }
.srow:last-child { border-bottom:none; }
.srl { font-size:14px; color:var(--t2); }
.srv { font-size:14px; font-weight:700; color:var(--t1); }

.chart-card { margin:10px 14px 0; background:var(--surface); border-radius:16px; padding:16px; }
.chart-lbl { font-size:12px; font-weight:700; color:var(--t2); margin-bottom:12px; }

.exp-row { display:flex; gap:8px; margin:10px 14px 0; }
.exp-btn { flex:1; padding:13px; border-radius:12px; border:1.5px solid var(--border); background:var(--bg); font-size:13px; font-weight:700; color:var(--acc); cursor:pointer; font-family:inherit; }
```

---

## 설정 뷰

```css
.set-topbar { padding:20px 20px 12px; display:flex; align-items:center; justify-content:space-between; }
.set-title { font-size:24px; font-weight:700; color:var(--t1); }
.set-section { margin:10px 14px 0; background:var(--surface); border-radius:16px; overflow:hidden; }
.set-sec-lbl { padding:10px 16px 4px; font-size:11px; font-weight:700; color:var(--t3); letter-spacing:.5px; text-transform:uppercase; }

.spr { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border); }
.spr:last-child { border-bottom:none; }
.spr-lbl { font-size:15px; color:var(--t1); }
.spr-r { display:flex; align-items:center; gap:6px; }
.spr-in { width:76px; padding:7px 10px; border-radius:8px; border:1.5px solid var(--border); font-size:14px; text-align:right; font-family:inherit; outline:none; background:var(--bg); color:var(--t1); }
.spr-unit { font-size:13px; color:var(--t3); }

.tr-wrap { display:flex; align-items:center; gap:5px; }
.tr-in { width:76px; padding:7px 8px; border-radius:8px; border:1.5px solid var(--border); font-size:13px; font-family:inherit; outline:none; background:var(--bg); color:var(--t1); }
.tr-sep { font-size:12px; color:var(--t3); }

/* 테마 스와치 */
.theme-swatches { padding:14px 16px; display:flex; gap:14px; flex-wrap:wrap; }
.sw-item { display:flex; flex-direction:column; align-items:center; gap:5px; cursor:pointer; }
.sw-circle { width:36px; height:36px; border-radius:50%; border:3px solid transparent; }
.sw-circle.on { box-shadow:0 0 0 2px var(--bg), 0 0 0 4px var(--acc); }
.sw-name { font-size:10px; color:var(--t3); font-weight:500; }

/* 안내 박스 */
.note-box { margin:10px 14px 0; background:var(--acc-soft); border-radius:16px; padding:14px 16px; font-size:12px; color:var(--acc-text); line-height:1.9; }

/* 저장 버튼 */
.save-btn { margin:12px 14px; padding:15px; border-radius:14px; border:none; background:var(--acc); color:#fff; font-size:16px; font-weight:700; font-family:inherit; cursor:pointer; width:calc(100% - 28px); }
```

---

## Svelte 전환 시 참고사항

1. `.modal-overlay.open` → Svelte에서는 `{#if open}` + CSS transition 또는 `class:open`
2. `.npill.on` → `class:on={currentView === 'cal'}`
3. `.dcell.is-today` → `class:is-today={isToday}`
4. `display:none` 토글 → `{#if}` 조건부 렌더링
5. `getElementById` → `bind:this` 또는 그냥 안 씀 (reactive)
6. `innerHTML` → `{@html}` 또는 (권장) Svelte 템플릿으로 대체
