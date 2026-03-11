<script>
  import { onMount, onDestroy } from 'svelte';
  import { settings, themePreview, settingsDirty, createHasSeenStore } from '$lib/stores.js';
  import Tutorial from './Tutorial.svelte';

  let tutorialRef;
  const hasSeenSettings = createHasSeenStore('settings');

  const tutorialSteps = [
    {
      target: '#sect-theme',
      title: '앱 테마',
      content: '액센트 컬러와 배경 테마를 원하는 조합으로 바꿀 수 있어요. 변경 즉시 미리보기가 적용됩니다.',
      position: 'bottom',
    },
    {
      target: '#sect-ot',
      title: '초과근무 규칙',
      content: '자동공제 시간과 최대 초과근무 시간을 본인 근무환경에 맞게 조정해요.',
      position: 'bottom',
    },
    {
      target: '.save-btn',
      title: '저장하기',
      content: '설정을 변경한 뒤 반드시 저장 버튼을 눌러야 반영됩니다.',
      position: 'top',
    },
  ];

  onMount(() => {
    setTimeout(() => tutorialRef?.start(), 300);
  });

  let s = { ...$settings };
  let saved = false;
  let initial = JSON.stringify($settings);

  $: {
    const current = JSON.stringify({
      ...s,
      mealMorningStart: toMin(morningStart),
      mealMorningEnd: toMin(morningEnd),
      mealEveningStart: toMin(eveningStart),
      mealEveningEnd: toMin(eveningEnd),
    });
    settingsDirty.set(current !== initial);
  }

  const accColors = [
    { key: 'blue',   label: '블루',   hex: '#1a56db' },
    { key: 'green',  label: '그린',   hex: '#16a34a' },
    { key: 'purple', label: '퍼플',   hex: '#7c3aed' },
    { key: 'rose',   label: '로즈',   hex: '#e11d48' },
    { key: 'orange', label: '오렌지', hex: '#ea580c' },
    { key: 'teal',   label: '틸',     hex: '#0d9488' },
  ];

  const bgThemes = [
    { key: 'light',  label: '라이트', bg: '#ffffff', border: '#e5e7eb' },
    { key: 'warm',   label: '웜',     bg: '#fdf8f3', border: '#e0d4c3' },
    { key: 'dark',   label: '다크',   bg: '#111827', border: 'transparent' },
    { key: 'amoled', label: 'AMOLED', bg: '#000000', border: 'transparent' },
  ];

  function toHHMM(min) {
    return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;
  }
  function toMin(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  let morningStart = toHHMM(s.mealMorningStart);
  let morningEnd = toHHMM(s.mealMorningEnd);
  let eveningStart = toHHMM(s.mealEveningStart);
  let eveningEnd = toHHMM(s.mealEveningEnd);

  // 테마 실시간 프리뷰
  function previewAcc(key) {
    s.accTheme = key;
    themePreview.set({ accTheme: s.accTheme, bgTheme: s.bgTheme });
  }
  function previewBg(key) {
    s.bgTheme = key;
    themePreview.set({ accTheme: s.accTheme, bgTheme: s.bgTheme });
  }

  onDestroy(() => { themePreview.set({}); settingsDirty.set(false); });

  export function resetSettings() {
    s = { ...$settings };
    morningStart = toHHMM(s.mealMorningStart);
    morningEnd = toHHMM(s.mealMorningEnd);
    eveningStart = toHHMM(s.mealEveningStart);
    eveningEnd = toHHMM(s.mealEveningEnd);
    themePreview.set({});
    settingsDirty.set(false);
  }

  export async function saveSettings() {
    s.mealMorningStart = toMin(morningStart);
    s.mealMorningEnd = toMin(morningEnd);
    s.mealEveningStart = toMin(eveningStart);
    s.mealEveningEnd = toMin(eveningEnd);

    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s)
    });
    if (res.ok) {
      settings.set({ ...s });
      themePreview.set({});
      initial = JSON.stringify({ ...s });
      settingsDirty.set(false);
      saved = true;
      setTimeout(() => saved = false, 2000);
    }
  }
</script>

<Tutorial bind:this={tutorialRef} steps={tutorialSteps} tutorialKey="settings" />

<div style="flex:1;overflow-y:auto;padding-bottom:140px">
  <div class="set-topbar">
    <div class="set-title">설정</div>
  </div>

  <!-- 액센트 컬러 -->
  <div id="sect-theme" class="set-section">
    <div class="set-sec-lbl">액센트 컬러</div>
    <div class="theme-swatches">
      {#each accColors as { key, label, hex }}
        <button class="sw-item" on:click={() => previewAcc(key)} style="background:none;border:none;cursor:pointer;padding:0">
          <div class="sw-circle" class:on={s.accTheme === key} style="background:{hex}"></div>
          <span class="sw-name">{label}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- 배경 테마 -->
  <div class="set-section">
    <div class="set-sec-lbl">배경 테마</div>
    <div class="theme-swatches">
      {#each bgThemes as { key, label, bg, border }}
        <button class="sw-item" on:click={() => previewBg(key)} style="background:none;border:none;cursor:pointer;padding:0">
          <div class="sw-circle" class:on={s.bgTheme === key} style="background:{bg};{key==='light'?'border:3px solid #e5e7eb':''}"></div>
          <span class="sw-name">{label}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- 초과근무 규칙 -->
  <div id="sect-ot" class="set-section">
    <div class="set-sec-lbl">초과근무 규칙</div>
    <div class="spr">
      <span class="spr-lbl">자동 공제시간</span>
      <div class="spr-r">
        <input class="spr-in" type="number" bind:value={s.bufferMin} min="0" max="240" />
        <span class="spr-unit">분</span>
      </div>
    </div>
    <div class="spr">
      <span class="spr-lbl">최대 초과근무</span>
      <div class="spr-r">
        <input class="spr-in" type="number" bind:value={s.maxOtMin} min="0" max="600" />
        <span class="spr-unit">분</span>
      </div>
    </div>
  </div>

  <!-- 급량비 단가 -->
  <div class="set-section">
    <div class="set-sec-lbl">급량비 단가</div>
    <div class="spr">
      <span class="spr-lbl">평일 단가</span>
      <div class="spr-r">
        <input class="spr-in" type="number" bind:value={s.mealPriceWeekday} min="0" step="100" style="width:90px" />
        <span class="spr-unit">원</span>
      </div>
    </div>
    <div class="spr">
      <span class="spr-lbl">주말 단가</span>
      <div class="spr-r">
        <input class="spr-in" type="number" bind:value={s.mealPriceWeekend} min="0" step="100" style="width:90px" />
        <span class="spr-unit">원</span>
      </div>
    </div>
  </div>

  <!-- 평일 급량비 시간 -->
  <div class="set-section">
    <div class="set-sec-lbl">평일 급량비 시간</div>
    <div class="spr">
      <span class="spr-lbl">오전 구간</span>
      <div class="spr-r">
        <div class="tr-wrap">
          <input class="tr-in" type="time" bind:value={morningStart} />
          <span class="tr-sep">~</span>
          <input class="tr-in" type="time" bind:value={morningEnd} />
        </div>
      </div>
    </div>
    <div class="spr">
      <span class="spr-lbl">오후 구간</span>
      <div class="spr-r">
        <div class="tr-wrap">
          <input class="tr-in" type="time" bind:value={eveningStart} />
          <span class="tr-sep">~</span>
          <input class="tr-in" type="time" bind:value={eveningEnd} />
        </div>
      </div>
    </div>
    <div class="spr">
      <span class="spr-lbl">최소 근무시간</span>
      <div class="spr-r">
        <input class="spr-in" type="number" bind:value={s.mealMinOverlap} min="0" max="120" />
        <span class="spr-unit">분</span>
      </div>
    </div>
  </div>

  <!-- 주말 급량비 -->
  <div class="set-section">
    <div class="set-sec-lbl">주말 급량비 조건</div>
    <div class="spr">
      <span class="spr-lbl">최소 근무시간</span>
      <div class="spr-r">
        <input class="spr-in" type="number" bind:value={s.mealWeekendMinMin} min="0" max="480" />
        <span class="spr-unit">분</span>
      </div>
    </div>
  </div>

  <!-- 안내 박스 -->
  <div class="note-box">
    ℹ️ 기준 근무시간 540분(9h)은 고정값입니다.<br/>
    설정 변경은 이후 저장 기록부터 적용됩니다.<br/>
    기존 기록은 재계산되지 않습니다.
  </div>

  <button class="save-btn" on:click={saveSettings}>
    {saved ? '✓ 저장 완료' : '저장'}
  </button>
</div>
