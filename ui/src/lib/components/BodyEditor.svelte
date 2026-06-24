<script lang="ts">
  import type { Body, BodyMode, RawSubtype } from '../models';
  import KVTable from './KVTable.svelte';

  interface Props {
    bodyMode: BodyMode;
    body: Body;
    onchange: (mode: BodyMode, body: Body) => void;
  }
  let { bodyMode, body, onchange }: Props = $props();

  function setMode(mode: BodyMode) {
    let nextBody: Body;
    if (mode === 'none') nextBody = { kind: 'none' };
    else if (mode === 'raw') {
      nextBody = body.kind === 'raw' ? body : { kind: 'raw', subtype: 'json', text: '' };
    } else {
      nextBody =
        body.kind === 'urlencoded'
          ? body
          : { kind: 'urlencoded', fields: [{ key: '', value: '', enabled: true }] };
    }
    onchange(mode, nextBody);
  }

  function setSubtype(st: RawSubtype) {
    if (body.kind === 'raw') {
      onchange('raw', { ...body, subtype: st });
    }
  }

  function setText(text: string) {
    if (body.kind === 'raw') {
      onchange('raw', { ...body, text });
    }
  }
</script>

<div class="body-editor">
  <div class="toolbar">
    <label><input type="radio" name="mode" checked={bodyMode === 'none'} onclick={() => setMode('none')} /> none</label>
    <label><input type="radio" name="mode" checked={bodyMode === 'raw'} onclick={() => setMode('raw')} /> raw</label>
    <label><input type="radio" name="mode" checked={bodyMode === 'urlencoded'} onclick={() => setMode('urlencoded')} /> x-www-form-urlencoded</label>

    {#if bodyMode === 'raw' && body.kind === 'raw'}
      <div class="spacer"></div>
      <select value={body.subtype} onchange={(e) => setSubtype((e.target as HTMLSelectElement).value as RawSubtype)}>
        <option value="json">JSON</option>
        <option value="xml">XML</option>
        <option value="html">HTML</option>
        <option value="text">Text</option>
      </select>
    {/if}
  </div>

  {#if bodyMode === 'none'}
    <div class="empty muted">No body</div>
  {:else if bodyMode === 'raw' && body.kind === 'raw'}
    <textarea
      class="raw mono"
      value={body.text}
      oninput={(e) => setText((e.target as HTMLTextAreaElement).value)}
      placeholder="Request body…"
      spellcheck="false"
    ></textarea>
  {:else if bodyMode === 'urlencoded' && body.kind === 'urlencoded'}
    <KVTable
      rows={body.fields}
      onchange={(rows) => onchange('urlencoded', { kind: 'urlencoded', fields: rows })}
    />
  {/if}
</div>

<style>
  .body-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    min-height: 0;
  }
  .toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 12px;
    color: var(--fg-2);
  }
  .toolbar label {
    cursor: pointer;
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .spacer { flex: 1; }
  .empty {
    padding: 12px;
    text-align: center;
    border: 1px dashed var(--border);
    border-radius: 4px;
  }
  textarea.raw {
    flex: 1;
    min-height: 200px;
    resize: none;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 8px;
    font-size: 12px;
    line-height: 1.5;
    outline: none;
  }
  textarea.raw:focus {
    border-color: var(--accent);
  }
</style>
