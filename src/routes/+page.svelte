<script>
  import { onMount } from 'svelte';
  import { settings, records, currentView, selectedDate } from '$lib/stores.js';
  import Calendar from './Calendar.svelte';
  import Stats from './Stats.svelte';
  import Settings from './Settings.svelte';
  import BottomBar from './BottomBar.svelte';
  import RecordModal from './RecordModal.svelte';

  export let data;

  let modalOpen = false;
  let modalDate = null;

  onMount(async () => {
    // settings 로드
    const sr = await fetch('/api/settings');
    if (sr.ok) {
      const s = await sr.json();
      settings.set(s);
    }
    // 이번달 records 로드
    const now = new Date();
    await loadRecords(now.getFullYear(), now.getMonth() + 1);
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

  async function handleMonthChange(e) {
    await loadRecords(e.detail.year, e.detail.month);
  }
</script>

{#if $currentView === 'cal'}
  <Calendar
    user={data.user}
    on:openModal={e => openModal(e.detail.date)}
    on:monthChange={handleMonthChange}
  />
{:else if $currentView === 'stats'}
  <Stats />
{:else if $currentView === 'settings'}
  <Settings />
{/if}

<BottomBar on:openModal={e => openModal(e.detail.date)} />

<RecordModal
  open={modalOpen}
  date={modalDate}
  on:save={handleSave}
  on:delete={handleDelete}
  on:close={closeModal}
/>
