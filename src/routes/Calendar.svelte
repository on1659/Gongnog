<script>
  import { createEventDispatcher } from 'svelte';
  import { settings, records, selectedDate } from '$lib/stores.js';
  import { HOLIDAYS, WKKO, isWeekend, fmtMin, fmtW, pad } from '$lib/constants.js';
  import DaySheet from './DaySheet.svelte';

  export let user = null;

  const dispatch = createEventDispatcher();

  let today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth(); // 0-indexed

  $: monthStr = String(viewMonth + 1) + '월';
  $: yearStr = String(viewYear) + '년';
  $: calDays = buildCal(viewYear, viewMonth);

  function buildCal(y, m) {
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    let startDow = first.getDay();
    const leading = startDow === 0 ? 6 : startDow - 1;
    const days = [];
    for (let i = leading - 1; i >= 0; i--) {
      const d = new Date(y, m, -i);
      days.push({ date: pad(d.getFullYear(), d.getMonth(), d.getDate()), other: true });
    }
    for (let d = 1; d <= last.getDate(); d++) {
      days.push({ date: pad(y, m, d), other: false });
    }
    const trailing = 42 - days.length;
    for (let i = 1; i <= trailing; i++) {
      const d = new Date(y, m + 1, i);
      days.push({ date: pad(d.getFullYear(), d.getMonth(), d.getDate()), other: true });
    }
    return days;
  }

  function todayStr() {
    const d = today;
    return pad(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function isToday(dateStr) { return dateStr === todayStr(); }
  function isSun(dateStr) { return new Date(dateStr).getDay() === 0; }
  function isSat(dateStr) { return new Date(dateStr).getDay() === 6; }
  function isHoliday(dateStr) { return !!HOLIDAYS[dateStr]; }
  function isSelected(dateStr) { return $selectedDate === dateStr; }

  function cellMealPrice(dateStr) {
    return isWeekend(dateStr) ? $settings.mealPriceWeekend : $settings.mealPriceWeekday;
  }

  function selectDate(dateStr) {
    selectedDate.set(dateStr);
  }

  function prevMonth() {
    if (viewMonth === 0) { viewYear--; viewMonth = 11; }
    else viewMonth--;
    dispatch('monthChange', { year: viewYear, month: viewMonth + 1 });
  }
  function nextMonth() {
    if (viewMonth === 11) { viewYear++; viewMonth = 0; }
    else viewMonth++;
    dispatch('monthChange', { year: viewYear, month: viewMonth + 1 });
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  // 요약 스트립: 이번 달 기록 집계
  $: monthEntries = Object.entries($records).filter(([d]) => {
    const dt = new Date(d);
    return dt.getFullYear() === viewYear && dt.getMonth() === viewMonth;
  });

  $: totalWork = monthEntries.reduce((s, [, r]) => s + (r.workMin || 0), 0);
  $: totalOt = monthEntries.reduce((s, [, r]) => s + (r.otMin || 0), 0);
  $: totalIncome = monthEntries.reduce((s, [d, r]) => {
    return s + (r.meals || 0) * cellMealPrice(d);
  }, 0);
  $: totalExpense = monthEntries.reduce((s, [, r]) => s + (r.mealExpense || 0), 0);
  $: netMeal = totalIncome - totalExpense;
</script>

<!-- 헤더 -->
<div class="header-top">
  <div class="nick-chip">
    <div class="nick-avatar">{user?.username?.[0]?.toUpperCase() || '?'}</div>
    <span class="nick-name">{user?.username || ''}</span>
  </div>
  <button class="logout-btn" on:click={logout} title="로그아웃">↩</button>
</div>

<div class="header-main">
  <div class="header-left">
    <div class="month-year">{yearStr}</div>
    <div class="month-big">{monthStr}</div>
  </div>
  <div class="topbar-icons">
    <button class="ico-btn" on:click={prevMonth} aria-label="이전 달">‹</button>
    <button class="ico-btn" on:click={nextMonth} aria-label="다음 달">›</button>
  </div>
</div>

<!-- 요약 스트립 -->
<div class="summary-row">
  <div class="spill" style="--c:var(--acc)">
    <div class="spill-lbl">총 근무</div>
    <div class="spill-val">{fmtMin(totalWork)}</div>
  </div>
  <div class="spill" style="--c:var(--ot-c)">
    <div class="spill-lbl">초과</div>
    <div class="spill-val" style="color:var(--ot-c)">{fmtMin(totalOt)}</div>
  </div>
  <div class="spill" style="--c:var(--meal-c)">
    <div class="spill-lbl">급량 수지</div>
    <div class="spill-val" class:pos={netMeal >= 0} class:neg={netMeal < 0}>{fmtW(netMeal)}</div>
  </div>
</div>

<!-- 요일 헤더 (월~일) -->
<div class="week-hdr">
  {#each ['월','화','수','목','금','토','일'] as d, i}
    <div class="wlbl" class:sat={i === 5} class:sun={i === 6}>{d}</div>
  {/each}
</div>

<!-- 캘린더 그리드 -->
<div class="cal-wrap">
  {#each {length: Math.ceil(calDays.length / 7)} as _, week}
    <div class="cal-row">
      {#each calDays.slice(week * 7, week * 7 + 7) as { date, other }}
        {@const rec = $records[date]}
        {@const mp = cellMealPrice(date)}
        <div
          class="dcell"
          class:other-month={other}
          class:is-today={isToday(date)}
          class:is-sel={isSelected(date) && !other}
          class:is-sun={isSun(date)}
          class:is-sat={isSat(date)}
          class:is-holiday={isHoliday(date)}
          role="button"
          tabindex={other ? -1 : 0}
          on:click={() => !other && selectDate(date)}
          on:keydown={e => (e.key === 'Enter' || e.key === ' ') && !other && selectDate(date)}
        >
          <div class="dnum-ring">
            <span class="dnum">{parseInt(date.slice(-2))}</span>
          </div>
          {#if rec && !other}
            <div class="ev-list">
              {#if rec.otMin > 0}
                <div class="ev ev-ot">{fmtMin(rec.otMin)}</div>
              {/if}
              {#if rec.checkIn}
                <div class="ev ev-in">{rec.checkIn}</div>
              {/if}
              {#if rec.meals > 0}
                {@const net = rec.meals * mp - (rec.mealExpense || 0)}
                <div class="ev" style="background:{net >= 0 ? 'var(--meal-c)' : 'var(--neg-c)'}">{fmtW(net)}</div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>

<!-- 상세 영역 (DaySheet) -->
<div class="detail-wrap">
  <DaySheet
    date={$selectedDate}
    on:edit={e => dispatch('openModal', { date: e.detail.date })}
    on:add={e => dispatch('openModal', { date: e.detail.date })}
  />
</div>
