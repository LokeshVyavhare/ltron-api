<script lang="ts">
  import type { Auth } from '../models';

  interface Props {
    auth: Auth;
    onchange: (auth: Auth) => void;
  }
  let { auth, onchange }: Props = $props();

  function setKind(kind: Auth['kind']) {
    if (kind === 'none') onchange({ kind: 'none' });
    else if (kind === 'bearer') onchange({ kind: 'bearer', token: '' });
    else if (kind === 'basic') onchange({ kind: 'basic', username: '', password: '' });
    else if (kind === 'api_key') onchange({ kind: 'api_key', key: '', value: '', in: 'header' });
  }
</script>

<div class="auth">
  <div class="row">
    <label>Type</label>
    <select value={auth.kind} onchange={(e) => setKind((e.target as HTMLSelectElement).value as Auth['kind'])}>
      <option value="none">No Auth</option>
      <option value="bearer">Bearer Token</option>
      <option value="basic">Basic Auth</option>
      <option value="api_key">API Key</option>
    </select>
  </div>

  {#if auth.kind === 'bearer'}
    <div class="row">
      <label>Token</label>
      <input
        type="text"
        class="mono"
        value={auth.token}
        oninput={(e) => onchange({ ...auth, token: (e.target as HTMLInputElement).value })}
        placeholder="{'{{access_token}}'} or a literal value"
      />
    </div>
    <p class="muted">Adds header: <code>Authorization: Bearer &lt;token&gt;</code></p>
  {:else if auth.kind === 'basic'}
    <div class="row">
      <label>Username</label>
      <input
        type="text"
        value={auth.username}
        oninput={(e) => onchange({ ...auth, username: (e.target as HTMLInputElement).value })}
      />
    </div>
    <div class="row">
      <label>Password</label>
      <input
        type="password"
        value={auth.password}
        oninput={(e) => onchange({ ...auth, password: (e.target as HTMLInputElement).value })}
      />
    </div>
    <p class="muted">Adds header: <code>Authorization: Basic base64(user:pass)</code></p>
  {:else if auth.kind === 'api_key'}
    <div class="row">
      <label>Key</label>
      <input
        type="text"
        value={auth.key}
        oninput={(e) => onchange({ ...auth, key: (e.target as HTMLInputElement).value })}
        placeholder="X-API-Key"
      />
    </div>
    <div class="row">
      <label>Value</label>
      <input
        type="text"
        class="mono"
        value={auth.value}
        oninput={(e) => onchange({ ...auth, value: (e.target as HTMLInputElement).value })}
        placeholder="{'{{api_key}}'} or a literal value"
      />
    </div>
    <div class="row">
      <label>Add to</label>
      <select
        value={auth.in}
        onchange={(e) => onchange({ ...auth, in: (e.target as HTMLSelectElement).value as 'header' | 'query' })}
      >
        <option value="header">Header</option>
        <option value="query">Query Param</option>
      </select>
    </div>
  {:else}
    <p class="muted">No authentication will be sent with this request.</p>
  {/if}
</div>

<style>
  .auth {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 600px;
  }
  .row {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 8px;
    align-items: center;
  }
  label {
    color: var(--fg-2);
    font-size: 12px;
  }
  input, select {
    width: 100%;
  }
  p {
    margin: 4px 0;
    font-size: 12px;
  }
  code {
    background: var(--bg-2);
    padding: 1px 6px;
    border-radius: 3px;
    font-family: var(--mono);
    font-size: 11px;
  }
</style>
