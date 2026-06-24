<script lang="ts">
  import { appState, activeEnvironment } from '../state/app.svelte';

  // ── Collect all available variable names ─────────────────────
  function allVarNames(): { name: string; source: 'global' | 'env' }[] {
    const map = new Map<string, 'global' | 'env'>();
    for (const v of appState.globals?.variables ?? []) {
      if (v.enabled && v.key.trim()) map.set(v.key, 'global');
    }
    const env = activeEnvironment();
    for (const v of env?.variables ?? []) {
      if (v.enabled && v.key.trim()) map.set(v.key, 'env'); // env overrides global label
    }
    return Array.from(map.entries())
      .map(([name, source]) => ({ name, source }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // ── State ─────────────────────────────────────────────────────
  let show = $state(false);
  let anchorEl = $state<HTMLElement | null>(null);
  let prefix = $state('');
  let menuX = $state(0);
  let menuY = $state(0);
  let focused = $state(-1);

  let filtered = $derived(
    prefix === ''
      ? allVarNames()
      : allVarNames().filter((v) =>
          v.name.toLowerCase().startsWith(prefix.toLowerCase()),
        ),
  );

  // ── Input monitoring ──────────────────────────────────────────
  function onDocInput(e: Event) {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!el || !('selectionStart' in el)) return;
    // Skip inputs inside the suggest dropdown itself
    if ((el as HTMLElement).closest?.('.var-suggest')) return;

    const val = el.value ?? '';
    const pos = el.selectionStart ?? val.length;
    const before = val.slice(0, pos);
    const match = before.match(/\{\{([a-zA-Z0-9_.]*)$/);

    if (match) {
      anchorEl = el;
      prefix = match[1];
      focused = -1;
      // Position below the input element
      const rect = el.getBoundingClientRect();
      menuX = rect.left;
      menuY = rect.bottom + 4;
      show = true;
    } else {
      show = false;
    }
  }

  function onDocFocusout(e: FocusEvent) {
    // Delay so a click on a suggestion registers first
    setTimeout(() => {
      if (
        !document.activeElement ||
        !(document.activeElement as HTMLElement).closest?.('.var-suggest')
      ) {
        show = false;
      }
    }, 150);
  }

  function onDocKeydown(e: KeyboardEvent) {
    if (!show || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focused = Math.min(focused + 1, filtered.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focused = Math.max(focused - 1, 0);
    } else if (e.key === 'Enter' && focused >= 0) {
      e.preventDefault();
      applyVar(filtered[focused].name);
    } else if (e.key === 'Escape') {
      show = false;
    }
  }

  // ── Apply selection ───────────────────────────────────────────
  function applyVar(name: string) {
    const el = anchorEl as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;

    const val = el.value;
    const pos = el.selectionStart ?? val.length;
    const before = val.slice(0, pos);
    const after = val.slice(pos);
    const newBefore = before.replace(/\{\{[a-zA-Z0-9_.]*$/, `{{${name}}}`);
    el.value = newBefore + after;

    const newPos = newBefore.length;
    el.setSelectionRange(newPos, newPos);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    show = false;
  }
</script>

<svelte:document
  oninput={onDocInput}
  onfocusout={onDocFocusout}
  onkeydown={onDocKeydown}
/>

{#if show && filtered.length > 0}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="var-suggest"
    style:left="{menuX}px"
    style:top="{menuY}px"
    onmousedown={(e) => e.preventDefault()}
  >
    <div class="hint">Variables — {prefix ? `matching "${prefix}"` : 'all'}</div>
    {#each filtered as v, i}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="item"
        class:focused={i === focused}
        onclick={() => applyVar(v.name)}
      >
        <span class="braces">{'{{'}</span><span class="varname">{v.name}</span><span class="braces">{'}}'}</span>
        <span class="source {v.source}">{v.source === 'env' ? 'env' : 'global'}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .var-suggest {
    position: fixed;
    z-index: 600;
    background: var(--bg-2);
    border: 1px solid var(--accent);
    border-radius: 7px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.35);
    min-width: 200px;
    max-width: 320px;
    max-height: 220px;
    overflow-y: auto;
    padding: 2px 0 4px;
  }
  .hint {
    padding: 5px 12px 4px;
    font-size: 10px;
    color: var(--fg-3);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 2px;
  }
  .item {
    padding: 6px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--fg-1);
  }
  .item:hover, .item.focused { background: var(--bg-3); }
  .braces { color: var(--accent); }
  .varname { color: var(--fg-1); }
  .source {
    margin-left: auto;
    padding-left: 8px;
    font-size: 10px;
    font-family: inherit;
  }
  .source.global { color: var(--fg-3); }
  .source.env { color: var(--ok); }
</style>
