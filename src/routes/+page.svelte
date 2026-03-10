<script>
  import { onMount, onDestroy } from 'svelte';
  import { settings, records, currentView, selectedDate } from '$lib/stores.js';
  import { fmtW, fmtTime } from '$lib/constants.js';

  // 뒤로가기 시 탭 전환 (설정/통계 → 캘린더)
  function handlePopState() {
    if ($currentView !== 'cal') {
      currentView.set('cal');
      history.pushState({ view: 'cal' }, '');
    }
  }

  // 탭 변경 시 히스토리 push
  const unsubView = currentView.subscribe(v => {
    if (typeof window !== 'undefined' && v !== 'cal') {
      history.pushState({ view: v }, '');
    }
  });
  import Calendar from './Calendar.svelte';
  import Stats from './Stats.svelte';
  import Settings from './Settings.svelte';
  import BottomBar from './BottomBar.svelte';
  import RecordModal from './RecordModal.svelte';

  export let data;

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
        showToast(`${fmtTime(checkIn)} 출근 기록됨`, date);
      } else {
        showToast(`${fmtTime(checkOut)} 퇴근 기록됨`, date);
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
    on:openModal={e => openModal(e.detail.date)}
    on:monthChange={handleMonthChange}
    on:quickClock={handleQuickClock}
    on:quickMeal={handleQuickMeal}
  />
{:else if $currentView === 'stats'}
  <Stats />
{:else if $currentView === 'settings'}
  <Settings />
{/if}

<BottomBar
  on:openModal={e => openModal(e.detail.date)}
  on:quickClock={handleQuickClock}
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

{#if splashVisible}
  <div class="splash" class:fade-out={splashFading}>
    <img class="splash-icon" src="/app-icon.svg" alt="공녹" />
    <div class="splash-name">공녹</div>
    <div class="splash-desc">공무원 근무기록</div>
  </div>
{/if}
