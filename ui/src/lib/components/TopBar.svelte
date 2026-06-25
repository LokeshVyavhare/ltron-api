<script lang="ts">
  import { appState } from '../state/app.svelte';
  import { saveSettings } from '../storage/store';

  interface Props {
    onexport: () => void;
    onimport: () => void;
    onenvironments: () => void;
    onhelp: () => void;
    onhistory: () => void;
  }
  let { onexport, onimport, onenvironments, onhelp, onhistory }: Props = $props();

  const themeLabels: Record<string, string> = { dark: 'Dark', light: 'Light', system: 'System' };
  const themeOrder = ['dark', 'light', 'system'] as const;

  function cycleTheme() {
    const idx = themeOrder.indexOf(appState.settings.theme as any);
    const next = themeOrder[(idx + 1) % themeOrder.length];
    appState.settings = { ...appState.settings, theme: next };
    applyTheme(next);
    saveSettings(appState.settings).catch(console.error);
  }

  function applyTheme(theme: string) {
    const cl = document.documentElement.classList;
    cl.remove('dark', 'light', 'system');
    if (theme !== 'dark') cl.add(theme); // 'dark' = no extra class (default)
  }
</script>

<div class="topbar">
  <div class="brand">Ltron-api</div>
  <div class="spacer"></div>
  <button onclick={onenvironments}>Environments</button>
  <button onclick={onhistory}>History</button>
  <div class="divider"></div>
  <button onclick={onexport}>Export</button>
  <button onclick={onimport}>Import</button>
  <div class="divider"></div>
  <button onclick={onhelp}>Help</button>
  <button class="theme-btn" onclick={cycleTheme} title="Toggle theme">
    {themeLabels[appState.settings.theme] ?? 'Dark'}
  </button>
</div>

<style>
  .topbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 12px;
    height: 38px;
    background: var(--bg-2);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .brand {
    font-weight: 700;
    font-size: 13px;
    color: var(--accent);
    letter-spacing: 0.3px;
    margin-right: 8px;
  }
  .spacer { flex: 1; }
  .divider {
    width: 1px;
    height: 18px;
    background: var(--border);
    margin: 0 4px;
  }
  .topbar button {
    padding: 3px 10px;
    font-size: 12px;
    border: 1px solid transparent;
    background: transparent;
  }
  .topbar button:hover {
    background: var(--bg-3);
    border-color: var(--border);
  }
  .theme-btn { min-width: 60px; }
</style>
