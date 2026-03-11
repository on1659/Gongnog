<script>
  import { onMount, onDestroy } from 'svelte';
  import { records, settings, createHasSeenStore } from '$lib/stores.js';
  import { fmtMin, fmtW, isWeekend } from '$lib/constants.js';
  import Tutorial from './Tutorial.svelte';

  let tutorialRef;
  const hasSeenStats = createHasSeenStore('stats');

  const tutorialSteps = [
    {
      target: '.stats-grid',
      title: '이달 통계 요약',
      content: '총 근무시간, 초과근무, 급량비 수령액과 순수 수지를 한눈에 볼 수 있어요.',
      position: 'bottom',
    },
    {
      target: '.chart-card',
      title: '근무 현황 차트',
      content: '최근 기록을 바 차트로 시각화해요. 근무 패턴을 파악하는 데 도움이 됩니다.',
      position: 'top',
    },
    {
      target: '.exp-row',
      title: '데이터 내보내기',
      content: '엑셀 또는 CSV 파일로 내보내 급여·근태 증빙 자료로 활용할 수 있어요.',
      position: 'top',
    },
  ];

  let canvas;
  let chart;

  $: allRecs = Object.entries($records);
  $: totalWork = allRecs.reduce((s, [, r]) => s + (r.workMin || 0), 0);
  $: totalOt = allRecs.reduce((s, [, r]) => s + (r.otMin || 0), 0);
  $: totalMealIncome = allRecs.reduce((s, [d, r]) => {
    const price = isWeekend(d) ? $settings.mealPriceWeekend : $settings.mealPriceWeekday;
    return s + (r.meals || 0) * price;
  }, 0);
  $: totalMealExpense = allRecs.reduce((s, [, r]) => s + (r.mealExpense || 0), 0);
  $: netMeal = totalMealIncome - totalMealExpense;

  let ChartLib = null;

  onMount(async () => {
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);
    ChartLib = Chart;
    buildChart(Chart);
    setTimeout(() => tutorialRef?.start(), 400);
  });

  onDestroy(() => { chart?.destroy(); });

  // records 또는 테마 변경 시 차트 재빌드
  $: if (ChartLib && canvas && allRecs && $settings.accTheme && $settings.bgTheme) {
    // tick으로 지연하여 CSS 변수 적용 후 읽기
    setTimeout(() => buildChart(ChartLib), 50);
  }

  function getThemeColor(varName) {
    const el = document.getElementById('app') || document.documentElement;
    return getComputedStyle(el).getPropertyValue(varName).trim();
  }

  function buildChart(Chart) {
    if (!canvas) return;
    chart?.destroy();

    const accColor = getThemeColor('--acc') || '#1a56db';
    const otColor = getThemeColor('--ot-c') || '#f97316';
    const textColor = getThemeColor('--t2') || '#6b7280';
    const gridColor = getThemeColor('--border') || '#e5e7eb';

    // 최근 7개 기록
    const recs = allRecs
      .filter(([, r]) => r.checkIn)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7);

    const labels = recs.map(([d]) => `${parseInt(d.slice(5,7))}/${parseInt(d.slice(-2))}`);
    const workData = recs.map(([, r]) => Math.round((r.workMin || 0) / 60 * 10) / 10);
    const otData = recs.map(([, r]) => Math.round((r.otMin || 0) / 60 * 10) / 10);

    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '근무(h)',
            data: workData,
            backgroundColor: accColor,
            borderRadius: 4,
          },
          {
            label: '초과(h)',
            data: otData,
            backgroundColor: otColor,
            borderRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: textColor } },
          y: { grid: { color: gridColor + '33' }, ticks: { font: { size: 10 }, color: textColor } }
        }
      }
    });
  }

  async function exportExcel() {
    const { utils, writeFile } = await import('xlsx');
    const rows = allRecs.map(([d, r]) => ({
      날짜: d,
      출근: r.checkIn || '',
      퇴근: r.checkOut || '',
      근무시간: r.workMin || 0,
      초과근무: r.otMin || 0,
      급량횟수: r.meals || 0,
      식비지출: r.mealExpense || 0,
      메모: r.memo || '',
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, '근무기록');
    writeFile(wb, '근무기록.xlsx');
  }

  async function exportCsv() {
    const rows = [['날짜','출근','퇴근','근무시간','초과근무','급량횟수','식비지출','메모']];
    for (const [d, r] of allRecs) {
      rows.push([d, r.checkIn||'', r.checkOut||'', r.workMin||0, r.otMin||0, r.meals||0, r.mealExpense||0, r.memo||'']);
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '근무기록.csv'; a.click();
    URL.revokeObjectURL(url);
  }
</script>

<Tutorial bind:this={tutorialRef} steps={tutorialSteps} tutorialKey="stats" />

<div class="view-scroll" style="flex:1;overflow-y:auto;padding-bottom:80px">
  <div class="stats-topbar">
    <div class="stats-title">통계</div>
  </div>

  <div class="stats-grid">
    <div class="sbox">
      <div class="sbox-lbl">총 근무시간</div>
      <div class="sbox-val ac">{fmtMin(totalWork)}</div>
    </div>
    <div class="sbox">
      <div class="sbox-lbl">초과근무</div>
      <div class="sbox-val ot">{fmtMin(totalOt)}</div>
    </div>
    <div class="sbox">
      <div class="sbox-lbl">급량비 수령액</div>
      <div class="sbox-val ml">{fmtW(totalMealIncome)}</div>
    </div>
    <div class="sbox">
      <div class="sbox-lbl">급량 수지</div>
      <div class="sbox-val" class:pos={netMeal >= 0} class:neg={netMeal < 0} style="font-size:20px">{fmtW(netMeal)}</div>
    </div>
  </div>

  <div class="chart-card">
    <div class="chart-lbl">최근 근무 현황 (시간)</div>
    <canvas bind:this={canvas}></canvas>
  </div>

  <div class="stat-sect">
    <div class="srow">
      <span class="srl">수령액 합계</span>
      <span class="srv pos">{fmtW(totalMealIncome)}</span>
    </div>
    <div class="srow">
      <span class="srl">식비 지출 합계</span>
      <span class="srv neg">-{fmtW(totalMealExpense)}</span>
    </div>
    <div class="srow">
      <span class="srl">순수 수지</span>
      <span class="srv" class:pos={netMeal >= 0} class:neg={netMeal < 0}>{fmtW(netMeal)}</span>
    </div>
  </div>

  <div class="exp-row">
    <button class="exp-btn" on:click={exportExcel}>📊 엑셀 내보내기</button>
    <button class="exp-btn" on:click={exportCsv}>📄 CSV 내보내기</button>
  </div>
</div>
