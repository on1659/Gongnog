<script>
  import '../app.css';
  import { settings, themePreview } from '$lib/stores.js';
  $: accTheme = $themePreview.accTheme || $settings.accTheme;
  $: bgTheme = $themePreview.bgTheme || $settings.bgTheme;
</script>

<div id="app" class="acc-{accTheme} bg-{bgTheme}">
  <slot />
</div>
