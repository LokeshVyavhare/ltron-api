<script lang="ts">
  interface Row {
    key: string;
    value: string;
    enabled: boolean;
  }
  interface Props {
    rows: Row[];
    onchange: (rows: Row[]) => void;
    placeholderKey?: string;
    placeholderValue?: string;
  }
  let { rows, onchange, placeholderKey = 'key', placeholderValue = 'value' }: Props = $props();

  function ensureTrailing(next: Row[]): Row[] {
    const last = next[next.length - 1];
    if (!last || last.key || last.value) {
      return [...next, { key: '', value: '', enabled: true }];
    }
    return next;
  }

  function update(i: number, patch: Partial<Row>) {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onchange(ensureTrailing(next));
  }

  function remove(i: number) {
    const next = rows.filter((_, idx) => idx !== i);
    onchange(ensureTrailing(next));
  }

  $effect(() => {
    if (rows.length === 0 || rows[rows.length - 1].key || rows[rows.length - 1].value) {
      onchange(ensureTrailing(rows));
    }
  });
</script>

<div class="kvtable">
  <div class="row header">
    <div class="cell-cb"></div>
    <div class="cell">Key</div>
    <div class="cell">Value</div>
    <div class="cell-del"></div>
  </div>
  {#each rows as row, i (i)}
    <div class="row" class:disabled={!row.enabled}>
      <div class="cell-cb">
        <input
          type="checkbox"
          checked={row.enabled}
          onchange={(e) => update(i, { enabled: (e.target as HTMLInputElement).checked })}
        />
      </div>
      <div class="cell">
        <input
          type="text"
          value={row.key}
          placeholder={placeholderKey}
          oninput={(e) => update(i, { key: (e.target as HTMLInputElement).value })}
        />
      </div>
      <div class="cell">
        <input
          type="text"
          value={row.value}
          placeholder={placeholderValue}
          oninput={(e) => update(i, { value: (e.target as HTMLInputElement).value })}
        />
      </div>
      <div class="cell-del">
        {#if i < rows.length - 1 || row.key || row.value}
          <button class="del" onclick={() => remove(i)} title="Remove">×</button>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .kvtable {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }
  .row {
    display: grid;
    grid-template-columns: 32px 1fr 1.5fr 28px;
    background: var(--bg-1);
  }
  .row.header {
    background: var(--bg-2);
    font-weight: 600;
    color: var(--fg-2);
    font-size: 11px;
    text-transform: uppercase;
  }
  .row.header .cell {
    padding: 4px 8px;
  }
  .row.disabled input[type="text"] {
    color: var(--fg-3);
    text-decoration: line-through;
  }
  .cell {
    display: flex;
  }
  .cell-cb, .cell-del {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  input[type="text"] {
    flex: 1;
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 6px 8px;
    width: 100%;
  }
  input[type="text"]:focus {
    background: var(--bg-2);
  }
  input[type="checkbox"] {
    cursor: pointer;
  }
  .del {
    background: transparent;
    border: none;
    color: var(--fg-3);
    font-size: 16px;
    padding: 0;
    width: 20px;
    height: 20px;
    line-height: 1;
    cursor: pointer;
  }
  .del:hover {
    color: var(--err);
  }
</style>
