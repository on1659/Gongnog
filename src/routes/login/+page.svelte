<script>
  let mode = 'login';
  let username = '';
  let password = '';
  let passwordConfirm = '';
  let error = '';
  let loading = false;
  let showSplash = false;

  async function submit() {
    error = '';
    if (mode === 'register' && password !== passwordConfirm) {
      error = '비밀번호가 일치하지 않습니다.';
      return;
    }
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
    passwordConfirm = '';
  }
</script>

<div class="login-wrap" class:register={mode === 'register'}>
  <div class="login-hero">
    {#if mode === 'login'}
      <img src="/logo.png" alt="공노기" class="login-logo-img" />
    {:else}
      <div class="login-logo" style="font-size:28px;">새 계정</div>
      <div class="login-logo-sub" style="font-size:24px;">만들기</div>
      <div class="login-desc">아이디와 비밀번호를 입력해주세요</div>
    {/if}
  </div>
  <div class="login-divider"></div>
  <label class="lf-label" for="inp-user">아이디</label>
  <input id="inp-user" class="lf-input" type="text" bind:value={username} placeholder="아이디 입력" autocomplete="username" on:keydown={e => e.key === 'Enter' && submit()} />
  <label class="lf-label" for="inp-pw">비밀번호</label>
  <input id="inp-pw" class="lf-input" type="password" bind:value={password} placeholder="비밀번호 입력" autocomplete={mode === 'login' ? 'current-password' : 'new-password'} on:keydown={e => e.key === 'Enter' && submit()} />
  {#if mode === 'register'}
    <label class="lf-label" for="inp-pw2">비밀번호 확인</label>
    <input id="inp-pw2" class="lf-input" type="password" bind:value={passwordConfirm} placeholder="비밀번호 다시 입력" autocomplete="new-password" on:keydown={e => e.key === 'Enter' && submit()} />
  {/if}
  <div class="login-error">{error}</div>
  <button class="login-btn" on:click={submit} disabled={loading}>
    {loading ? '...' : mode === 'login' ? '로그인' : '회원가입'}
  </button>
  <div class="login-sub">
    {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
    <button style="background:none;border:none;color:var(--acc);font-weight:600;font-size:13px;cursor:pointer;padding:0" on:click={toggleMode}>{mode === 'login' ? '회원가입' : '로그인'}</button>
  </div>
</div>

<style>
  .login-wrap { flex:1; display:flex; flex-direction:column; justify-content:flex-end; padding:0 28px 52px; min-height:100%; }
  .login-wrap.register :global(.login-divider) { margin: 16px 0; }
  .login-wrap.register :global(.lf-input) { margin-bottom: 12px; }
  .login-wrap.register :global(.login-btn) { margin-top: 4px; }
  .login-wrap.register :global(.login-sub) { margin-top: 10px; }
  .login-wrap.register :global(.login-error) { margin-top: 4px; min-height: 16px; }
</style>

{#if showSplash}
  <div class="splash">
    <img class="splash-icon" src="/logo.png" alt="공노기" />
  </div>
{/if}
