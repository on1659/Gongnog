<script>
  import { createEventDispatcher } from 'svelte';
  import { currentView, selectedDate } from '$lib/stores.js';

  const dispatch = createEventDispatcher();

  function openModal() {
    const date = $selectedDate || today();
    dispatch('openModal', { date });
  }

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
</script>

<div class="btm-bar">
  <button class="add-btn" on:click={openModal}>
    <span style="font-size:20px;font-weight:400">＋</span> 기록 입력
  </button>
  <div class="nav-pills">
    <button class="npill" class:on={$currentView === 'cal'} on:click={() => currentView.set('cal')}>캘린더</button>
    <button class="npill" class:on={$currentView === 'stats'} on:click={() => currentView.set('stats')}>통계</button>
    <button class="npill" class:on={$currentView === 'settings'} on:click={() => currentView.set('settings')}>설정</button>
  </div>
</div>
