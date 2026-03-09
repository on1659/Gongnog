<script>
  import '../app.css';
  import { settings } from '$lib/stores.js';
</script>

<div id="app" class="acc-{$settings.accTheme} bg-{$settings.bgTheme}">
  <slot />
</div>
