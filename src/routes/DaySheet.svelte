<script>
  import { createEventDispatcher } from 'svelte';
  import { settings, records, customConfirm } from '$lib/stores.js';
  import { HOLIDAYS, WKKO, isWeekend, fmtMin, fmtW, fmtTime } from '$lib/constants.js';

  export let date = null;

  const dispatch = createEventDispatcher();

  let showMealPopup = false;
  let mealInputAmount = 0;
  let showClockPopup = false;
  let clockPopupMode = 'in';
  let clockPopupTime = '';

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  $: rec = date ? $records[date] : null;
  $: dow = date ? WKKO[new Date(date).getDay()] : '';
  $: holiday = date ? HOLIDAYS[date] : null;
  $: weekend = date ? isWeekend(date) : false;
  $: isToday = date === todayStr();
  $: mealPrice = date
    ? (isWeekend(date) ? $settings.mealPriceWeekend : $settings.mealPriceWeekday)
    : $settings.mealPriceWeekday;
  $: income = (rec?.meals || 0) * mealPrice;
  $: net = income - (rec?.mealExpense || 0);
  $: mealCount = rec?.mealExpense ? Math.round(rec.mealExpense / mealPrice) : 0;

  function fmtDate(d) {
    if (!d) return '';
    return `${parseInt(d.slice(5,7))}월 ${parseInt(d.slice(-2))}일`;
  }

  function nowTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function handleClockIn() {
    clockPopupMode = 'in';
    clockPopupTime = nowTime();
    showClockPopup = true;
  }

  function handleClockOut() {
    clockPopupMode = 'out';
    clockPopupTime = nowTime();
    showClockPopup = true;
  }

  function confirmClock() {
    if (clockPopupMode === 'in') {
      dispatch('quickClock', { date, checkIn: clockPopupTime, checkOut: null });
    } else {
      dispatch('quickClock', { date, checkIn: rec.checkIn, checkOut: clockPopupTime });
    }
    showClockPopup = false;
  }

  function cancelClock() {
    showClockPopup = false;
  }

  async function openMealPopup() {
    const currentCount = mealCount;
    if (currentCount >= 2) {
      if (!await customConfirm(`오늘 식사를 ${currentCount}회 하셨습니다.\n더 추가하시는게 맞습니까?`)) return;
    }
    mealInputAmount = mealPrice;
    showMealPopup = true;
  }

  function confirmMeal() {
    const newExpense = (rec?.mealExpense || 0) + mealInputAmount;
    dispatch('quickMeal', { date, mealExpense: newExpense });
    showMealPopup = false;
  }

  function cancelMeal() {
    showMealPopup = false;
  }
</script>

{#if date}
  <div class="ds-hdr">
    <div class="ds-date">{fmtDate(date)} ({dow})</div>
    {#if holiday}
      <span class="ds-tag" style="color:var(--sun-c)">{holiday}</span>
    {:else if weekend}
      <span class="ds-tag" style="color:var(--sat-c)">주말</span>
    {:else if isToday}
      <span class="ds-tag" style="color:var(--acc)">오늘</span>
    {/if}
  </div>

  <div class="ds-body">
    <!-- 오늘: 퀵 액션 인라인 -->
    {#if isToday}
      <div class="ds-quick">
        {#if !rec?.checkIn}
          <button class="qa-btn qa-clockin" on:click={handleClockIn}>
            <span class="qa-icon">&#128340;</span>
            <span class="qa-label">출근</span>
          </button>
        {:else}
          <div class="qa-done">
            <span class="qa-done-icon">&#128340;</span>
            <span class="qa-done-label">출근</span>
            <span class="qa-done-time">{fmtTime(rec.checkIn)}</span>
          </div>
        {/if}

        {#if rec?.checkIn && !rec?.checkOut}
          <button class="qa-btn qa-clockout" on:click={handleClockOut}>
            <span class="qa-icon">&#128682;</span>
            <span class="qa-label">퇴근</span>
          </button>
        {:else if rec?.checkOut}
          <div class="qa-done">
            <span class="qa-done-icon">&#128682;</span>
            <span class="qa-done-label">퇴근</span>
            <span class="qa-done-time">{fmtTime(rec.checkOut)}</span>
          </div>
        {/if}

        <button class="qa-btn qa-meal" on:click={openMealPopup}>
          <span class="qa-icon">&#127858;</span>
          <span class="qa-label">식사</span>
          {#if mealCount > 0}
            <span class="qa-badge">{mealCount}</span>
          {/if}
        </button>
      </div>
    {/if}

    {#if rec && rec.checkIn}
      <div class="dcard">
        <div class="dcard-bar"></div>
        <div class="dcard-body">
          <div class="dcard-title">근무 기록</div>
          <div class="dcard-time">
            {fmtTime(rec.checkIn)} → {fmtTime(rec.checkOut)}
            {#if rec.workMin}
              <span style="color:var(--t3)">|</span>
              {fmtMin(rec.workMin)}
            {/if}
          </div>
          <div class="dcard-chips">
            {#if rec.otMin > 0}
              <span class="chip chip-ot">초과 {fmtMin(rec.otMin)}</span>
            {/if}
            {#if rec.meals > 0}
              <span class="chip chip-meal">급량 {rec.meals}회</span>
            {/if}
            {#if weekend || holiday}
              <span class="chip chip-we">{holiday ? '공휴일' : '주말'}</span>
            {/if}
          </div>
          {#if rec.memo}
            <div style="font-size:12px;color:var(--t3);margin-top:6px">{rec.memo}</div>
          {/if}
        </div>
        <button class="dcard-edit" on:click={() => dispatch('edit', { date })}>✏️</button>
      </div>

      {#if rec.meals > 0 || rec.mealExpense > 0}
        <div class="mfcard">
          <div class="mfc-title">급량비 수지</div>
          <div class="mfc-row">
            <span class="mfc-label">수령액 ({rec.meals || 0}회)</span>
            <span class="mfc-val pos">{fmtW(income)}</span>
          </div>
          <div class="mfc-row">
            <span class="mfc-label">식비 지출 ({mealCount}회)</span>
            <span class="mfc-val neg">-{fmtW(rec.mealExpense || 0)}</span>
          </div>
          <div class="mfc-row">
            <span class="mfc-label">순수 수지</span>
            <span class="mfc-val mfc-net" class:pos={net >= 0} class:neg={net < 0}>{fmtW(net)}</span>
          </div>
        </div>
      {/if}
    {:else}
      <div class="ds-empty">
        기록이 없습니다
        <button class="ds-add-btn" on:click={() => dispatch('add', { date })}>＋ 기록 입력</button>
      </div>
    {/if}
  </div>
{/if}

<!-- 출퇴근 시간 입력 팝업 -->
<div class="meal-popup-overlay" class:open={showClockPopup} on:click|self={cancelClock}>
  <div class="meal-popup">
    <div class="meal-popup-title">{clockPopupMode === 'in' ? '출근 시간' : '퇴근 시간'}</div>
    <div class="meal-popup-desc">{clockPopupMode === 'in' ? '출근 시간을 확인해주세요' : '퇴근 시간을 확인해주세요'}</div>
    <div class="meal-popup-input-wrap">
      <input class="meal-popup-input" type="time" bind:value={clockPopupTime} />
    </div>
    <div class="meal-popup-btns">
      <button class="meal-popup-cancel" on:click={cancelClock}>취소</button>
      <button class="meal-popup-confirm" on:click={confirmClock}>등록</button>
    </div>
  </div>
</div>

<!-- 식사 금액 입력 팝업 -->
<div class="meal-popup-overlay" class:open={showMealPopup} on:click|self={cancelMeal}>
  <div class="meal-popup">
    <div class="meal-popup-title">식사 금액 입력</div>
    <div class="meal-popup-desc">식비 지출 금액을 입력해주세요</div>
    <div class="meal-popup-input-wrap">
      <input class="meal-popup-input" type="number" bind:value={mealInputAmount} min="0" step="100" />
      <span class="meal-popup-unit">원</span>
    </div>
    <div class="meal-popup-btns">
      <button class="meal-popup-cancel" on:click={cancelMeal}>취소</button>
      <button class="meal-popup-confirm" on:click={confirmMeal}>확인</button>
    </div>
  </div>
</div>
