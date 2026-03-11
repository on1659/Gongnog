<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  import { setSeen, createHasSeenStore, tutorialFlags, FLAG_BITS } from '$lib/stores.js';

  export let steps = [];
  export let tutorialKey = '';

  let currentStep = 0;
  let isActive = false;
  let hasSeenStore;

  $: if (tutorialKey) hasSeenStore = createHasSeenStore(tutorialKey);

  // DOM elements (동적 생성)
  let blockerEl = null, highlightEl = null, tooltipEl = null;

  // ── 가시성 판정 (offsetParent 아닌 getComputedStyle 사용) ──
  function isVisible(el) {
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden';
  }

  function getTarget(step) {
    let el = document.querySelector(step.target);
    if (!el && step.fallbackTarget) el = document.querySelector(step.fallbackTarget);
    return el;
  }

  // ── 배치 계산 (상하 전용 + flip + clamp) ──
  function doPosition(index) {
    if (!isActive || !tooltipEl || !highlightEl) return;
    const step = steps[index];
    const target = getTarget(step);
    if (!target) { findNext(index); return; }

    const rect = target.getBoundingClientRect();

    // Highlight 배치
    Object.assign(highlightEl.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    // 툴팁 콘텐츠 업데이트
    const title = typeof step.title === 'function' ? step.title() : step.title;
    const content = typeof step.content === 'function' ? step.content() : step.content;
    tooltipEl.querySelector('.tut-title').textContent = title;
    tooltipEl.querySelector('.tut-content').textContent = content;
    tooltipEl.querySelector('.tut-progress').textContent = `${index + 1}/${steps.length}`;
    tooltipEl.querySelector('.tut-prev').style.visibility = index === 0 ? 'hidden' : 'visible';
    tooltipEl.querySelector('.tut-next').textContent = index === steps.length - 1 ? '완료' : '다음 →';

    // 툴팁 크기 측정
    tooltipEl.style.visibility = 'hidden';
    tooltipEl.style.display = 'block';
    const tw = tooltipEl.offsetWidth;
    const th = tooltipEl.offsetHeight;

    // 상하 위치 결정 (flip 포함)
    const gap = 12;
    const pref = step.position || 'bottom';
    let top, left;
    if (pref === 'top') {
      top = rect.top - th - gap;
      if (top < 8) top = rect.bottom + gap;
    } else {
      top = rect.bottom + gap;
      if (top + th > window.innerHeight - 8) top = rect.top - th - gap;
    }

    // 좌우 중앙 정렬 + clamp
    left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - th - 8));

    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;

    // 화살표 방향 및 --ax 계산
    const isBelow = top >= rect.bottom;
    tooltipEl.setAttribute('data-arrow', isBelow ? 'top' : 'bottom');
    const ax = Math.max(16, Math.min(rect.left + rect.width / 2 - left, tw - 16));
    tooltipEl.style.setProperty('--ax', `${ax}px`);

    tooltipEl.style.visibility = 'visible';
  }

  // ── 스텝 표시 ──
  function showStep(index) {
    if (!isActive) return;
    const step = steps[index];

    if (step.beforeShow) step.beforeShow();

    const target = getTarget(step);

    // beforeShow 없고 타겟 안 보이면 스킵
    if (!step.beforeShow && (!target || !isVisible(target))) {
      findNext(index);
      return;
    }
    if (!target) { findNext(index); return; }

    const rect = target.getBoundingClientRect();
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!inView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => doPosition(index), 300);
    } else {
      doPosition(index);
    }
  }

  function findNext(fromIndex) {
    for (let i = fromIndex + 1; i < steps.length; i++) {
      const step = steps[i];
      if (step.beforeShow) { currentStep = i; showStep(i); return; }
      const el = getTarget(step);
      if (el && isVisible(el)) { currentStep = i; showStep(i); return; }
    }
    complete();
  }

  // ── DOM 생성/제거 ──
  function createDOM() {
    blockerEl = document.createElement('div');
    blockerEl.className = 'tut-blocker';
    document.body.appendChild(blockerEl);

    highlightEl = document.createElement('div');
    highlightEl.className = 'tut-highlight';
    document.body.appendChild(highlightEl);

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'tut-tooltip';
    tooltipEl.innerHTML = `
      <button class="tut-close" aria-label="닫기">✕</button>
      <div class="tut-title"></div>
      <div class="tut-content"></div>
      <div class="tut-footer">
        <button class="tut-prev">← 이전</button>
        <span class="tut-progress"></span>
        <button class="tut-next">다음 →</button>
      </div>
    `;
    document.body.appendChild(tooltipEl);

    tooltipEl.querySelector('.tut-close').addEventListener('click', stop);
    tooltipEl.querySelector('.tut-prev').addEventListener('click', prev);
    tooltipEl.querySelector('.tut-next').addEventListener('click', next);
  }

  function destroyDOM() {
    blockerEl?.remove(); blockerEl = null;
    highlightEl?.remove(); highlightEl = null;
    tooltipEl?.remove(); tooltipEl = null;
  }

  // ── 공개 API ──
  export function start(force = false) {
    if (!browser || isActive) return;
    if (!force && hasSeenStore && get(hasSeenStore)) return;
    isActive = true;
    currentStep = 0;
    createDOM();
    showStep(0);
  }

  function complete() { stop(); }

  export function stop() {
    if (!isActive) return;
    steps.forEach(s => s.cleanup?.());
    setSeen(tutorialKey);
    destroyDOM();
    isActive = false;
  }

  export function prev() {
    if (currentStep === 0) return;
    steps[currentStep].cleanup?.();
    currentStep--;
    showStep(currentStep);
  }

  export function next() {
    if (currentStep >= steps.length - 1) { complete(); return; }
    currentStep++;
    showStep(currentStep);
  }

  export function reset() {
    if (browser) localStorage.removeItem(`tutorialSeen_${tutorialKey}`);
    const bit = FLAG_BITS?.[tutorialKey];
    if (bit) tutorialFlags.update(f => f & ~bit);
  }

  // ── 이벤트 핸들러 ──
  function handleKeydown(e) { if (e.key === 'Escape' && isActive) stop(); }
  function handleResize() { if (isActive) doPosition(currentStep); }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', handleResize);

    // 글로벌 CSS 한 번만 주입 (Svelte 스코핑 우회)
    if (!document.getElementById('tut-styles')) {
      const s = document.createElement('style');
      s.id = 'tut-styles';
      s.textContent = `
        .tut-blocker{position:fixed;inset:0;z-index:1009;background:transparent;pointer-events:all}
        .tut-highlight{position:fixed;z-index:1010;border-radius:8px;border:2px solid var(--acc);box-shadow:0 0 0 9999px rgba(0,0,0,.65);pointer-events:none;transition:top .25s,left .25s,width .25s,height .25s}
        .tut-tooltip{position:fixed;z-index:1012;background:var(--surface);border-radius:12px;padding:20px;max-width:300px;min-width:200px;box-shadow:0 4px 20px rgba(0,0,0,.15);animation:tutFadeIn .2s ease-out;font-family:'Noto Sans KR',sans-serif}
        .tut-title{font-size:1.1rem;font-weight:700;color:var(--t1);margin-bottom:8px}
        .tut-content{font-size:.9rem;color:var(--t2);line-height:1.5;margin-bottom:16px}
        .tut-close{position:absolute;top:8px;right:8px;background:none;border:none;font-size:1.1rem;color:var(--t3);cursor:pointer;padding:4px 8px;line-height:1;font-family:inherit}
        .tut-footer{display:flex;justify-content:space-between;align-items:center;gap:8px}
        .tut-prev{background:none;border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:.85rem;cursor:pointer;color:var(--t2);white-space:nowrap;font-family:inherit}
        .tut-next{background:var(--acc);color:#fff;border:none;border-radius:8px;padding:8px 20px;font-size:.9rem;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit}
        .tut-progress{color:var(--t3);font-size:.8rem;flex:1;text-align:center}
        .tut-tooltip[data-arrow="top"]::before{content:'';position:absolute;top:-8px;left:var(--ax,50%);transform:translateX(-50%);border:8px solid transparent;border-bottom-color:var(--surface)}
        .tut-tooltip[data-arrow="bottom"]::after{content:'';position:absolute;bottom:-8px;left:var(--ax,50%);transform:translateX(-50%);border:8px solid transparent;border-top-color:var(--surface)}
        @keyframes tutFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:480px){.tut-tooltip{max-width:calc(100vw - 32px);font-size:.85rem;padding:14px}.tut-highlight{box-shadow:0 0 0 9999px rgba(0,0,0,.55)}.tut-footer{gap:6px}}
      `;
      document.head.appendChild(s);
    }
  });

  onDestroy(() => {
    if (isActive) stop();
    if (browser) {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('resize', handleResize);
    }
  });
</script>
