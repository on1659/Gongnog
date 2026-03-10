<script>
  import '../app.css';
  import { settings, themePreview } from '$lib/stores.js';
  import CustomDialog from './CustomDialog.svelte';

  export let data;

  // 서버에서 받은 테마로 초기값 설정 (FOUC 방지)
  $: if (data?.theme) {
    settings.update(s => ({
      ...s,
      accTheme: data.theme.accTheme || s.accTheme,
      bgTheme: data.theme.bgTheme || s.bgTheme,
    }));
  }

  $: accTheme = $themePreview.accTheme || $settings.accTheme;
  $: bgTheme = $themePreview.bgTheme || $settings.bgTheme;
</script>

<div id="app" class="acc-{accTheme} bg-{bgTheme}">
  <slot />
  <CustomDialog />
</div>
