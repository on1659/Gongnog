<script>
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { settings, records, currentView, selectedDate, settingsDirty, customConfirm, createHasSeenStore, loadFlags } from '$lib/stores.js';
  import { fmtW, fmtTime } from '$lib/constants.js';

  // 뒤로가기 시 탭 전환 (설정/통계 → 캘린더)
  async function handlePopState() {
    if ($currentView === 'settings' && $settingsDirty) {
      history.pushState({ view: 'settings' }, '');
      const save = await customConfirm('저장되지 않은 변경사항이 있습니다.\n저장하시겠습니까?');
      if (save) {
        settingsRef?.saveSettings();
      } else {
        settingsRef?.resetSettings();
      }
      currentView.set('cal');
      return;
    }
    if ($currentView !== 'cal') {
      currentView.set('cal');
      history.pushState({ view: 'cal' }, '');
    }
  }

  // 탭 변경 시 히스토리 push + 스크롤 리셋
  const unsubView = currentView.subscribe(v => {
    if (typeof window !== 'undefined' && v !== 'cal') {
      history.pushState({ view: v }, '');
    }
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        document.querySelector('.view-scroll')?.scrollTo({ top: 0 });
      });
    }
  });
  import Calendar from './Calendar.svelte';
  import Stats from './Stats.svelte';
  import Settings from './Settings.svelte';
  import BottomBar from './BottomBar.svelte';
  import RecordModal from './RecordModal.svelte';
  import Tutorial from './Tutorial.svelte';

  export let data;

  let settingsRef;
  let tutorialRef;
  let tutorialFakeKeys = [];
  const hasSeenDashboard = createHasSeenStore('dashboard');

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
      content: '각 날짜를 탭하면 기록을 확인하고 수정할 수 있어요. 색상 바로 근무 현황을 파악합니다.',
      position: 'top',
      beforeShow() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const fakeData = {
          [`${y}-${m}-03`]: { checkIn: '08:00', checkOut: '18:00', workMin: 600, otMin: 0,   meals: 1, mealExpense: 9000,  memo: '' },
          [`${y}-${m}-04`]: { checkIn: '08:30', checkOut: '19:30', workMin: 660, otMin: 60,  meals: 2, mealExpense: 14000, memo: '' },
          [`${y}-${m}-05`]: { checkIn: '08:00', checkOut: '20:00', workMin: 720, otMin: 120, meals: 2, mealExpense: 18000, memo: '' },
          [`${y}-${m}-06`]: { checkIn: '08:10', checkOut: '18:00', workMin: 590, otMin: 0,   meals: 1, mealExpense: 9000,  memo: '' },
          [`${y}-${m}-09`]: { checkIn: '08:00', checkOut: '19:00', workMin: 660, otMin: 60,  meals: 2, mealExpense: 15000, memo: '' },
          [`${y}-${m}-10`]: { checkIn: '08:00', checkOut: '18:00', workMin: 600, otMin: 0,   meals: 1, mealExpense: 9000,  memo: '' },
        };
        const cur = get(records);
        tutorialFakeKeys = Object.keys(fakeData).filter(k => !cur[k]);
        const toAdd = {};
        tutorialFakeKeys.forEach(k => { toAdd[k] = fakeData[k]; });
        records.update(r => ({ ...r, ...toAdd }));
      },
      cleanup() {
        records.update(r => {
          const copy = { ...r };
          tutorialFakeKeys.forEach(k => delete copy[k]);
          return copy;
        });
        tutorialFakeKeys = [];
      },
    },
    {
      target: '.nav-pills',
      title: '통계 · 설정',
      content: '통계 탭에서 차트로 분석하고, 설정 탭에서 초과근무 기준과 급량비 단가를 조정해요.',
      position: 'top',
    },
  ];

  let modalOpen = false;
  let modalDate = null;
  let toast = null;
  let toastTimer = null;
  let splashVisible = true;
  let splashFading = false;

  onMount(async () => {
    window.addEventListener('popstate', handlePopState);
    const sr = await fetch('/api/settings');
    if (sr.ok) {
      const s = await sr.json();
      settings.set(s);
    }
    const now = new Date();
    await loadRecords(now.getFullYear(), now.getMonth() + 1);
    loadFlags();
    splashFading = true;
    setTimeout(() => { splashVisible = false; }, 500);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', handlePopState);
    }
    unsubView();
  });

  async function loadRecords(year, month) {
    const rr = await fetch(`/api/records?year=${year}&month=${month}`);
    if (rr.ok) {
      const recs = await rr.json();
      records.update(r => ({ ...r, ...recs }));
    }
  }

  function openModal(date) {
    modalDate = date;
    modalOpen = true;
  }

  function closeModal() {
    modalOpen = false;
  }

  function showToast(msg, date) {
    clearTimeout(toastTimer);
    toast = { msg, date };
    toastTimer = setTimeout(() => { toast = null; }, 3000);
  }

  async function handleQuickClock(e) {
    const { date, checkIn, checkOut } = e.detail;
    const existing = $records[date];
    const res = await fetch(`/api/records/${date}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkIn,
        checkOut,
        mealExpense: existing?.mealExpense || 0,
        memo: existing?.memo || ''
      })
    });
    if (res.ok) {
      const { record } = await res.json();
      records.update(r => ({ ...r, [date]: record }));
      if (!checkOut) {
        showToast(`${fmtTime(checkIn)} 출근`, date);
      } else {
        showToast(`${fmtTime(checkOut)} 퇴근`, date);
      }
    }
  }

  async function handleSave(e) {
    const { date, checkIn, checkOut, mealExpense, memo } = e.detail;
    const res = await fetch(`/api/records/${date}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkIn, checkOut, mealExpense, memo })
    });
    if (res.ok) {
      const { record } = await res.json();
      records.update(r => ({ ...r, [date]: record }));
    }
    closeModal();
  }

  async function handleDelete(e) {
    const { date } = e.detail;
    await fetch(`/api/records/${date}`, { method: 'DELETE' });
    records.update(r => { const n = { ...r }; delete n[date]; return n; });
    closeModal();
  }

  async function handleQuickMeal(e) {
    const { date, mealExpense } = e.detail;
    const existing = $records[date];
    const res = await fetch(`/api/records/${date}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkIn: existing?.checkIn || null,
        checkOut: existing?.checkOut || null,
        mealExpense,
        memo: existing?.memo || ''
      })
    });
    if (res.ok) {
      const { record } = await res.json();
      records.update(r => ({ ...r, [date]: record }));
      showToast(`식사 ${fmtW(mealExpense)} 기록됨`, date);
    }
  }

  async function handleMonthChange(e) {
    await loadRecords(e.detail.year, e.detail.month);
  }
</script>

{#if $currentView === 'cal'}
  <Calendar
    user={data.user}
    helpPulse={!$hasSeenDashboard}
    on:helpClick={() => tutorialRef?.start(true)}
    on:openModal={e => openModal(e.detail.date)}
    on:monthChange={handleMonthChange}
    on:quickClock={handleQuickClock}
    on:quickMeal={handleQuickMeal}
  />
{:else if $currentView === 'stats'}
  <Stats />
{:else if $currentView === 'settings'}
  <Settings bind:this={settingsRef} />
{/if}

<BottomBar
  on:openModal={e => openModal(e.detail.date)}
  on:quickClock={handleQuickClock}
  on:saveSettings={() => settingsRef?.saveSettings()}
  on:resetSettings={() => settingsRef?.resetSettings()}
/>

<RecordModal
  open={modalOpen}
  date={modalDate}
  on:save={handleSave}
  on:delete={handleDelete}
  on:close={closeModal}
/>

{#if toast}
  <div class="toast" on:click={() => { toast = null; openModal(toast?.date); }}>
    <span class="toast-msg">{toast.msg}</span>
    <span class="toast-edit">수정</span>
  </div>
{/if}

<Tutorial bind:this={tutorialRef} steps={tutorialSteps} tutorialKey="dashboard" />

{#if splashVisible}
  <div class="splash" class:fade-out={splashFading}>
    <img class="splash-icon" src="/logo.png" alt="공노기" />
  </div>
{/if}
