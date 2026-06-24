<script lang="ts">
  import type { Environment } from '../models';

  interface Props {
    environments: Environment[];
    activeId: string | null;
    onswitch: (id: string | null) => void;
    onmanage: () => void;
  }
  let { environments, activeId, onswitch, onmanage }: Props = $props();

  let activeName = $derived(
    activeId ? (environments.find((e) => e.id === activeId)?.name ?? 'No Environment') : 'No Environment',
  );
</script>

<div class="env-switcher">
  <select
    value={activeId ?? ''}
    onchange={(e) => {
      const v = (e.target as HTMLSelectElement).value;
      onswitch(v === '' ? null : v);
    }}
    title="Active environment"
  >
    <option value="">Globals only</option>
    {#each environments as e (e.id)}
      <option value={e.id}>{e.name}</option>
    {/each}
  </select>
  <button class="manage" onclick={onmanage} title="Manage environments">Manage</button>
</div>

<style>
  .env-switcher {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  select {
    font-size: 12px;
    min-width: 140px;
  }
  .manage {
    padding: 3px 8px;
    font-size: 11px;
    white-space: nowrap;
  }
</style>
