<script lang="ts">
  interface Props { onclose: () => void; }
  let { onclose }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <header>
      <h2>Quick start</h2>
      <button class="x" onclick={onclose} aria-label="Close">×</button>
    </header>
    <div class="body">
      <section>
        <h3>Sidebar — left panel</h3>
        <ul>
          <li>Your workspace is shown at the top. Below it are your <strong>collections</strong>.</li>
          <li>Click the <strong>▸</strong> caret to expand a collection or folder.</li>
          <li>Hover any collection, folder, or request row and click <strong>•••</strong> to open its context menu — add requests, add folders, rename, duplicate, or delete.</li>
          <li>Click <strong>+ New Collection</strong> at the bottom of the sidebar to add a collection.</li>
          <li>Folders can be nested inside other folders.</li>
        </ul>
      </section>
      <section>
        <h3>Sending a request</h3>
        <ul>
          <li>Select a request in the sidebar.</li>
          <li>Choose an HTTP method, type (or paste) the URL, then click <strong>Send</strong> or press <kbd>Ctrl+Enter</kbd>.</li>
          <li>While a request is in flight, <strong>Send</strong> becomes <strong>Cancel</strong>.</li>
          <li>The response (status, latency, body, headers) appears below the URL bar.</li>
        </ul>
      </section>
      <section>
        <h3>Params / Headers / Body / Auth tabs</h3>
        <ul>
          <li><strong>Params</strong> — query-string key/value pairs appended to the URL.</li>
          <li><strong>Headers</strong> — custom request headers; toggle each row on/off.</li>
          <li><strong>Body</strong> — none (default for GET/HEAD), raw JSON/XML/text, or URL-encoded form.</li>
          <li><strong>Auth</strong> — Bearer token, Basic (username+password), or API key (header or query param).</li>
        </ul>
      </section>
      <section>
        <h3>Variables — <code>{'{{var}}'}</code></h3>
        <ul>
          <li>Open <strong>Environments</strong> in the top bar to create environments and set variables.</li>
          <li>Switch the active environment via the dropdown next to the request name.</li>
          <li>Use <code>{'{{variable_name}}'}</code> anywhere in the URL, headers, params, or body.</li>
          <li>Global variables (available in all environments) can be edited from the Environments screen.</li>
        </ul>
      </section>
      <section>
        <h3>Export / Import</h3>
        <ul>
          <li>Use <strong>Export</strong> in the top bar to save all workspaces to a single JSON file (secret values are stripped by default).</li>
          <li>Use <strong>Import</strong> to restore from a bundle — new UUIDs are assigned so it never overwrites existing data.</li>
        </ul>
      </section>
      <section>
        <h3>Data storage</h3>
        <ul>
          <li>Everything is saved automatically as you type — there is no Save button.</li>
          <li>Files live under <code>~/.local/share/dev.tricog.ltron-api/</code> as plain JSON — easy to back up or diff.</li>
        </ul>
      </section>
    </div>
    <footer>
      <button class="primary" onclick={onclose}>Got it</button>
    </footer>
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.55);
    display: flex; align-items: center; justify-content: center;
    z-index: 200;
  }
  .modal {
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: 640px; max-width: 95vw;
    max-height: 85vh;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  header {
    display: flex; align-items: center;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
  }
  header h2 { flex: 1; margin: 0; font-size: 15px; }
  .x { width: 26px; height: 26px; padding: 0; font-size: 18px; line-height: 1; }
  .body {
    overflow-y: auto; padding: 18px;
    display: flex; flex-direction: column; gap: 18px;
  }
  section h3 { margin: 0 0 8px; font-size: 13px; color: var(--accent); }
  ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 5px; }
  li { color: var(--fg-2); line-height: 1.5; }
  li strong, li code { color: var(--fg-1); }
  code { font-family: var(--mono); font-size: 12px; background: var(--bg-3); padding: 1px 4px; border-radius: 3px; }
  kbd { font-family: var(--mono); font-size: 11px; background: var(--bg-3); border: 1px solid var(--border); border-radius: 3px; padding: 1px 5px; }
  footer { padding: 12px 18px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; }
</style>
