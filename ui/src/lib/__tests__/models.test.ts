import { describe, it, expect } from 'vitest';
import { emptyRequest, normalizeRequest, newId } from '../models';

describe('newId', () => {
  it('returns a string that looks like a UUID', () => {
    const id = newId();
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
  });
});

describe('emptyRequest', () => {
  it('creates a request with defaults', () => {
    const req = emptyRequest('coll-1');
    expect(req.collection_id).toBe('coll-1');
    expect(req.method).toBe('GET');
    expect(req.folder_id).toBeNull();
    expect(req.auth.kind).toBe('none');
    expect(req.body_mode).toBe('none');
    expect(req.follow_redirects).toBe(true);
    expect(req.verify_tls).toBe(true);
  });
});

describe('normalizeRequest', () => {
  it('fills missing fields with defaults', () => {
    const raw = { id: 'x', collection_id: 'c', method: 'POST', url: 'http://test.com' };
    const req = normalizeRequest(raw);
    expect(req.name).toBe('New Request');
    expect(req.headers).toEqual([]);
    expect(req.query_params).toEqual([]);
    expect(req.body).toEqual({ kind: 'none' });
    expect(req.auth).toEqual({ kind: 'none' });
    expect(req.folder_id).toBeNull();
    expect(req.follow_redirects).toBe(true);
  });

  it('preserves existing fields', () => {
    const raw = {
      id: 'r1',
      collection_id: 'c1',
      folder_id: 'f1',
      name: 'My Request',
      method: 'DELETE',
      url: 'https://api.example.com/items/1',
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
      query_params: [],
      body_mode: 'none',
      body: { kind: 'none' },
      auth: { kind: 'bearer', token: 'tok' },
      timeout_ms: 5000,
      follow_redirects: false,
      verify_tls: false,
      sort_index: 100,
      created_at: 1000,
      updated_at: 2000,
    };
    const req = normalizeRequest(raw);
    expect(req.folder_id).toBe('f1');
    expect(req.name).toBe('My Request');
    expect(req.method).toBe('DELETE');
    expect(req.headers).toHaveLength(1);
    expect(req.auth).toEqual({ kind: 'bearer', token: 'tok' });
    expect(req.follow_redirects).toBe(false);
  });
});
