<script>
  let mode = 'login';
  let username = '';
  let password = '';
  let error = '';
  let loading = false;
  let showSplash = false;

  async function submit() {
    error = '';
    loading = true;
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    loading = false;
    if (data.ok) {
      showSplash = true;
      setTimeout(() => { window.location.href = '/'; }, 800);
    } else {
      error = data.message;
    }
  }

  function toggleMode() {
    mode = mode === 'login' ? 'register' : 'login';
    error = '';
  }
</script>

<div style="flex:1; display:flex; flex-direction:column; justify-content:flex-end; padding:0 28px 52px; min-height:100vh;">
  <div class="login-hero">
    <div class="login-logo">근무</div>
    <div class="login-logo-sub">기록</div>
    <div class="login-desc">공무원 출퇴근 · 초과근무 · 급량비 기록</div>
  </div>
  <div class="login-divider"></div>
  <label class="lf-label" for="inp-user">아이디</label>
  <input id="inp-user" class="lf-input" type="text" bind:value={username} placeholder="아이디 입력" autocomplete="username" on:keydown={e => e.key === 'Enter' && submit()} />
  <label class="lf-label" for="inp-pw">비밀번호</label>
  <input id="inp-pw" class="lf-input" type="password" bind:value={password} placeholder="비밀번호 입력" autocomplete="current-password" on:keydown={e => e.key === 'Enter' && submit()} />
  <div class="login-error">{error}</div>
  <button class="login-btn" on:click={submit} disabled={loading}>
    {loading ? '...' : mode === 'login' ? '로그인' : '회원가입'}
  </button>
  <div class="login-sub">
    {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
    <button style="background:none;border:none;color:var(--acc);font-weight:600;font-size:13px;cursor:pointer;padding:0" on:click={toggleMode}>{mode === 'login' ? '회원가입' : '로그인'}</button>
  </div>
</div>

{#if showSplash}
  <div class="splash">
    <img class="splash-icon" src="/app-icon.svg" alt="공녹" />
    <div class="splash-name">공녹</div>
    <div class="splash-desc">공무원 근무기록</div>
  </div>
{/if}
