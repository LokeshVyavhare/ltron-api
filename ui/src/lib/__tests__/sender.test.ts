import { describe, it, expect } from 'vitest';
import { buildVariableContext } from '../sender';
import type { Variable } from '../models';

function v(key: string, value: string, enabled = true, is_secret = false): Variable {
  return { key, value, enabled, is_secret };
}

describe('buildVariableContext', () => {
  it('builds context from globals only', () => {
    const ctx = buildVariableContext([v('host', 'localhost')]);
    expect(ctx.values).toEqual({ host: 'localhost' });
  });

  it('env vars override globals', () => {
    const ctx = buildVariableContext(
      [v('host', 'global.example.com')],
      [v('host', 'staging.example.com')],
    );
    expect(ctx.values.host).toBe('staging.example.com');
  });

  it('globals fill keys not in env', () => {
    const ctx = buildVariableContext(
      [v('base', 'https://api.example.com'), v('timeout', '5000')],
      [v('base', 'https://staging.example.com')],
    );
    expect(ctx.values.base).toBe('https://staging.example.com');
    expect(ctx.values.timeout).toBe('5000');
  });

  it('skips disabled globals', () => {
    const ctx = buildVariableContext([v('host', 'x', false)]);
    expect(ctx.values).not.toHaveProperty('host');
  });

  it('skips disabled env vars', () => {
    const ctx = buildVariableContext([], [v('host', 'x', false)]);
    expect(ctx.values).not.toHaveProperty('host');
  });

  it('skips empty-key entries', () => {
    const ctx = buildVariableContext([v('', 'value')]);
    expect(Object.keys(ctx.values)).toHaveLength(0);
  });

  it('handles empty arrays', () => {
    const ctx = buildVariableContext([], []);
    expect(ctx.values).toEqual({});
  });

  it('uses empty array as default for envVars', () => {
    const ctx = buildVariableContext([v('k', 'v')]);
    expect(ctx.values).toEqual({ k: 'v' });
  });
});
