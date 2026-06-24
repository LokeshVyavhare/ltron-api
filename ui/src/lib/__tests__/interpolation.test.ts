import { describe, it, expect } from 'vitest';
import { resolve, findReferences, VarUnresolvedError } from '../interpolation';

describe('resolve', () => {
  it('passes through plain strings unchanged', () => {
    expect(resolve('hello world', { values: {} })).toBe('hello world');
  });

  it('substitutes a single variable', () => {
    expect(resolve('{{host}}/users', { values: { host: 'https://api.example.com' } }))
      .toBe('https://api.example.com/users');
  });

  it('substitutes multiple variables', () => {
    const ctx = { values: { base: 'https://api.example.com', id: '42' } };
    expect(resolve('{{base}}/users/{{id}}', ctx)).toBe('https://api.example.com/users/42');
  });

  it('trims whitespace inside braces', () => {
    expect(resolve('{{ token }}', { values: { token: 'abc123' } })).toBe('abc123');
  });

  it('throws VarUnresolvedError for missing variable', () => {
    expect(() => resolve('{{missing}}', { values: {} })).toThrow(VarUnresolvedError);
    expect(() => resolve('{{missing}}', { values: {} })).toThrow('missing');
  });

  it('throws VarUnresolvedError with correct message', () => {
    let err: VarUnresolvedError | null = null;
    try { resolve('{{foo}}', { values: {} }); } catch (e) { err = e as VarUnresolvedError; }
    expect(err).not.toBeNull();
    expect(err!.message).toContain('foo');
  });

  it('treats unmatched {{ as literal', () => {
    expect(resolve('hello {{ world', { values: {} })).toBe('hello {{ world');
  });

  it('handles escape \\{{ ... \\}}', () => {
    const result = resolve('\\{{literal\\}}', { values: {} });
    expect(result).toBe('{{literal}}');
  });

  it('returns empty string for empty template', () => {
    expect(resolve('', { values: {} })).toBe('');
  });

  it('does not re-resolve substituted values', () => {
    // The substituted value contains {{...}} but it should NOT be resolved again
    const ctx = { values: { a: '{{b}}', b: 'dangerous' } };
    expect(resolve('{{a}}', ctx)).toBe('{{b}}');
  });
});

describe('findReferences', () => {
  it('returns empty for plain string', () => {
    expect(findReferences('hello')).toEqual([]);
  });

  it('finds a single reference', () => {
    expect(findReferences('{{host}}/api')).toEqual(['host']);
  });

  it('finds multiple references', () => {
    const refs = findReferences('{{base}}/users/{{id}}');
    expect(refs).toContain('base');
    expect(refs).toContain('id');
    expect(refs).toHaveLength(2);
  });

  it('deduplicates repeated references', () => {
    const refs = findReferences('{{x}} and {{x}}');
    expect(refs).toEqual(['x']);
  });

  it('skips escaped references', () => {
    const refs = findReferences('\\{{escaped\\}}');
    expect(refs).toEqual([]);
  });

  it('handles null/undefined gracefully', () => {
    expect(findReferences(null as any)).toEqual([]);
  });
});
