<script>
  import { createEventDispatcher } from 'svelte';
  import { settings, records } from '$lib/stores.js';
  import { calcRecord, getMealPrice } from '$lib/calc.js';
  import { HOLIDAYS, WKKO, isWeekend, fmtMin, fmtW } from '$lib/constants.js';

  export let open = false;
  export let date = null;

  const dispatch = createEventDispatcher();

  $: rec = date ? $records[date] : null;

  let checkIn = '08:00';
  let checkOut = '18:00';
  let mealExpense = 0;
  let memo = '';

  $: if (open && date) {
    checkIn = rec?.checkIn || '08:00';
    checkOut = rec?.checkOut || '18:00';
    mealExpense = rec?.mealExpense || 0;
    memo = rec?.memo || '';
  }

  $: calc = date ? calcRecord(checkIn, checkOut, date, $settings) : { workMin: null, otMin: null, meals: 0 };
  $: mealPrice = date ? getMealPrice(date, $settings) : $settings.mealPriceWeekday;
  $: mealIncome = (calc.meals || 0) * mealPrice;
  $: netMeal = mealIncome - (mealExpense || 0);

  $: dow = date ? WKKO[new Date(date).getDay()] : '';
  $: holiday = date ? HOLIDAYS[date] : null;
  $: weekend = date ? isWeekend(date) : false;

  function save() {
    dispatch('save', { date, checkIn, checkOut, mealExpense: Number(mealExpense) || 0, memo });
  }

  function del() {
    if (confirm('이 날의 기록을 삭제할까요?')) {
      dispatch('delete', { date });
    }
  }

  function close() {
    dispatch('close');
  }

  function fmtDate(d) {
    if (!d) return '';
    return `${parseInt(d.slice(5,7))}월 ${parseInt(d.slice(-2))}일`;
  }
</script>

<div
  class="modal-overlay"
  class:open
  role="dialog"
  aria-modal="true"
  aria-label="근무 기록 입력"
  on:click|self={close}
  on:keydown={e => e.key === 'Escape' && close()}
>
  <div class="modal-sheet">
    <div class="mhandle"></div>
    <div class="modal-date">{fmtDate(date)} ({dow})</div>
    <div class="modal-badge">
      {#if holiday}{holiday}
      {:else if weekend}주말
      {:else}평일{/if}
    </div>

    <!-- 출퇴근 시간 -->
    <div class="msec-lbl">출퇴근 시간</div>
    <div class="time-grid">
      <div class="tf">
        <label for="rm-checkin">출근</label>
        <input id="rm-checkin" type="time" bind:value={checkIn} />
      </div>
      <div class="tf">
        <label for="rm-checkout">퇴근</label>
        <input id="rm-checkout" type="time" bind:value={checkOut} />
      </div>
    </div>

    <!-- 실시간 계산 칩 -->
    <div class="calc-chips">
      <div class="cchip">
        <div class="cchip-lbl">근무시간</div>
        <div class="cchip-val">{calc.workMin != null ? fmtMin(calc.workMin) : '--'}</div>
      </div>
      <div class="cchip">
        <div class="cchip-lbl">초과근무</div>
        <div class="cchip-val" style="color:var(--ot-c)">{calc.otMin != null ? fmtMin(calc.otMin) : '--'}</div>
      </div>
      <div class="cchip">
        <div class="cchip-lbl">급량 횟수</div>
        <div class="cchip-val" style="color:var(--meal-c)">{calc.meals || 0}회</div>
      </div>
    </div>

    <!-- 식비 지출 -->
    <div class="msec-lbl">실제 식비 지출</div>
    <div class="tf" style="margin-bottom:0">
      <label for="rm-expense">지출 금액</label>
      <input id="rm-expense" type="number" bind:value={mealExpense} min="0" step="100"
        style="width:100%;padding:12px;border-radius:12px;border:none;background:var(--surface);font-size:17px;font-weight:600;color:var(--t1);outline:none;" />
    </div>

    <!-- 급량비 미리보기 -->
    <div class="mbpreview">
      <div class="mbp-row">
        <span class="mbp-lbl">수령액 ({calc.meals || 0}회 × {fmtW(mealPrice)})</span>
        <span class="mbp-val pos">{fmtW(mealIncome)}</span>
      </div>
      <div class="mbp-row">
        <span class="mbp-lbl">식비 지출</span>
        <span class="mbp-val neg">-{fmtW(Number(mealExpense) || 0)}</span>
      </div>
      <div class="mbp-div"></div>
      <div class="mbp-net">
        <span class="mbp-net-lbl">순수 수지</span>
        <span class="mbp-net-val" class:pos={netMeal >= 0} class:neg={netMeal < 0}>{fmtW(netMeal)}</span>
      </div>
    </div>

    <!-- 메모 -->
    <div class="memo-field">
      <label for="rm-memo">메모 (선택)</label>
      <input id="rm-memo" type="text" bind:value={memo} placeholder="메모를 입력하세요" />
    </div>

    <!-- 버튼 -->
    <div class="modal-btns">
      {#if rec?.checkIn}
        <button class="mbtn-del" on:click={del}>삭제</button>
      {/if}
      <button class="mbtn-cancel" on:click={close}>취소</button>
      <button class="mbtn-save" on:click={save}>저장</button>
    </div>
  </div>
</div>
