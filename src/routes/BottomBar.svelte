<script>
  import { createEventDispatcher } from 'svelte';
  import { currentView, selectedDate, records } from '$lib/stores.js';

  const dispatch = createEventDispatcher();

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function nowTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  $: today = todayStr();
  $: todayRec = $records[today];
  $: btnState = !todayRec?.checkIn ? 'clockIn'
    : !todayRec?.checkOut ? 'clockOut'
    : 'edit';

  function handleMainBtn() {
    if (btnState === 'clockIn') {
      dispatch('quickClock', { date: today, checkIn: nowTime(), checkOut: null });
    } else if (btnState === 'clockOut') {
      dispatch('quickClock', { date: today, checkIn: todayRec.checkIn, checkOut: nowTime() });
    } else {
      selectedDate.set(today);
      dispatch('openModal', { date: today });
    }
  }

  function openModal() {
    const date = $selectedDate || today;
    dispatch('openModal', { date });
  }
</script>

<div class="btm-bar">
  {#if $currentView === 'cal'}
    {#if btnState === 'clockIn'}
      <button class="quick-btn quick-in" on:click={handleMainBtn}>&#128340; 지금 출근</button>
    {:else if btnState === 'clockOut'}
      <button class="quick-btn quick-out" on:click={handleMainBtn}>&#128682; 지금 퇴근</button>
    {:else}
      <button class="add-btn" on:click={handleMainBtn}>&#9998; 기록 수정</button>
    {/if}
  {:else}
    <button class="add-btn" on:click={openModal}>
      <span style="font-size:20px;font-weight:400">＋</span> 기록 입력
    </button>
  {/if}
  <div class="nav-pills">
    <button class="npill" class:on={$currentView === 'cal'} on:click={() => currentView.set('cal')}>캘린더</button>
    <button class="npill" class:on={$currentView === 'stats'} on:click={() => currentView.set('stats')}>통계</button>
    <button class="npill" class:on={$currentView === 'settings'} on:click={() => currentView.set('settings')}>설정</button>
  </div>
</div>
