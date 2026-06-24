import { defineConfig, presetUno } from 'unocss';

export default defineConfig({
  presets: [presetUno()],
  theme: {
    colors: {
      bg: {
        1: 'var(--bg-1)',
        2: 'var(--bg-2)',
        3: 'var(--bg-3)',
      },
      fg: {
        1: 'var(--fg-1)',
        2: 'var(--fg-2)',
        3: 'var(--fg-3)',
      },
      accent: 'var(--accent)',
      border: 'var(--border)',
      ok: 'var(--ok)',
      warn: 'var(--warn)',
      err: 'var(--err)',
    },
  },
});
