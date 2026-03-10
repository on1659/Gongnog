<script>
  import { dialogState } from '$lib/stores.js';

  $: dialog = $dialogState;

  function handleOk() {
    if (dialog) {
      dialog.resolve(dialog.type === 'confirm' ? true : undefined);
      dialogState.set(null);
    }
  }

  function handleCancel() {
    if (dialog) {
      dialog.resolve(false);
      dialogState.set(null);
    }
  }
</script>

<div class="cdlg-overlay" class:open={!!dialog} on:click|self={dialog?.type === 'alert' ? handleOk : handleCancel} role="dialog" aria-modal="true" on:keydown={e => e.key === 'Escape' && (dialog?.type === 'alert' ? handleOk() : handleCancel())}>
  <div class="cdlg">
    <div class="cdlg-msg">{dialog?.message || ''}</div>
    <div class="cdlg-btns">
      {#if dialog?.type === 'confirm'}
        <button class="cdlg-cancel" on:click={handleCancel}>취소</button>
      {/if}
      <button class="cdlg-ok" on:click={handleOk}>확인</button>
    </div>
  </div>
</div>
