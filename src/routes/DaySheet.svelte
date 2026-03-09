<script>
  import { createEventDispatcher } from 'svelte';
  import { settings, records } from '$lib/stores.js';
  import { HOLIDAYS, WKKO, isWeekend, fmtMin, fmtW } from '$lib/constants.js';

  export let date = null;

  const dispatch = createEventDispatcher();

  $: rec = date ? $records[date] : null;
  $: dow = date ? WKKO[new Date(date).getDay()] : '';
  $: holiday = date ? HOLIDAYS[date] : null;
  $: weekend = date ? isWeekend(date) : false;
  $: mealPrice = date
    ? (isWeekend(date) ? $settings.mealPriceWeekend : $settings.mealPriceWeekday)
    : $settings.mealPriceWeekday;
  $: income = (rec?.meals || 0) * mealPrice;
  $: net = income - (rec?.mealExpense || 0);

  function fmtDate(d) {
    if (!d) return '';
    return `${parseInt(d.slice(5,7))}월 ${parseInt(d.slice(-2))}일`;
  }
</script>

{#if date}
  <div class="detail-hdr">
    <div class="detail-date">{fmtDate(date)} ({dow})</div>
    {#if holiday}
      <div class="detail-tag" style="color:var(--sun-c)">{holiday}</div>
    {:else if weekend}
      <div class="detail-tag" style="color:var(--sat-c)">주말</div>
    {/if}
  </div>

  <div class="detail-list">
    {#if rec && rec.checkIn}
      <!-- 근무 카드 -->
      <div class="dcard">
        <div class="dcard-bar"></div>
        <div class="dcard-body">
          <div class="dcard-title">근무 기록</div>
          <div class="dcard-time">
            {rec.checkIn} → {rec.checkOut}
            <span style="color:var(--t3)">|</span>
            {fmtMin(rec.workMin)}
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

      <!-- 급량비 수지 카드 -->
      {#if rec.meals > 0 || rec.mealExpense > 0}
        <div class="mfcard">
          <div class="mfc-title">급량비 수지</div>
          <div class="mfc-row">
            <span class="mfc-label">수령액 ({rec.meals || 0}회)</span>
            <span class="mfc-val pos">{fmtW(income)}</span>
          </div>
          <div class="mfc-row">
            <span class="mfc-label">식비 지출</span>
            <span class="mfc-val neg">-{fmtW(rec.mealExpense || 0)}</span>
          </div>
          <div class="mfc-row">
            <span class="mfc-label">순수 수지</span>
            <span class="mfc-val mfc-net" class:pos={net >= 0} class:neg={net < 0}>{fmtW(net)}</span>
          </div>
        </div>
      {/if}
    {:else}
      <div class="detail-empty">
        기록이 없습니다<br/>
        <button
          style="margin-top:16px;padding:12px 24px;border-radius:14px;border:none;background:var(--acc);color:#fff;font-size:14px;font-weight:700;cursor:pointer;"
          on:click={() => dispatch('add', { date })}
        >＋ 기록 입력</button>
      </div>
    {/if}
  </div>
{:else}
  <div class="detail-empty">날짜를 선택하면<br/>상세 정보가 표시됩니다</div>
{/if}
