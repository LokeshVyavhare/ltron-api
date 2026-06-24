/**
 * Variable interpolation: {{var_name}} with optional whitespace, escape via \{{ ... \}}.
 * Precedence: request override > active env > global. Unresolved = throw.
 * No nested resolution (resolved values are not re-scanned).
 */

export class VarUnresolvedError extends Error {
  constructor(public readonly name: string) {
    super(`unresolved variable: ${name}`);
    this.name = 'VarUnresolvedError';
  }
}

export interface VariableContext {
  // Map<key, value> — caller resolves precedence by Object.assign order.
  values: Record<string, string>;
  // Disabled keys still present in the map are skipped by caller; we do strict lookup here.
}

export function resolve(template: string, ctx: VariableContext): string {
  if (template == null) return template;
  const out: string[] = [];
  let i = 0;
  const n = template.length;

  while (i < n) {
    const ch = template[i];

    // Escape: \{{...\}} → literal {{...}}
    if (ch === '\\' && i + 2 < n && template[i + 1] === '{' && template[i + 2] === '{') {
      // Find matching \}}
      const end = template.indexOf('\\}}', i + 3);
      if (end === -1) {
        out.push(ch);
        i++;
        continue;
      }
      out.push(template.slice(i + 1, end), '}}');
      i = end + 3;
      continue;
    }

    if (ch === '{' && i + 1 < n && template[i + 1] === '{') {
      const end = template.indexOf('}}', i + 2);
      if (end === -1) {
        // Unmatched — treat as literal
        out.push(ch);
        i++;
        continue;
      }
      const key = template.slice(i + 2, end).trim();
      if (!key) {
        throw new VarUnresolvedError('(empty)');
      }
      if (!(key in ctx.values)) {
        throw new VarUnresolvedError(key);
      }
      out.push(ctx.values[key]);
      i = end + 2;
      continue;
    }

    out.push(ch);
    i++;
  }

  return out.join('');
}

export function findReferences(template: string): string[] {
  const refs = new Set<string>();
  if (template == null) return [];
  let i = 0;
  const n = template.length;
  while (i < n) {
    if (template[i] === '\\' && template[i + 1] === '{' && template[i + 2] === '{') {
      const end = template.indexOf('\\}}', i + 3);
      i = end === -1 ? i + 1 : end + 3;
      continue;
    }
    if (template[i] === '{' && template[i + 1] === '{') {
      const end = template.indexOf('}}', i + 2);
      if (end === -1) {
        i++;
        continue;
      }
      const key = template.slice(i + 2, end).trim();
      if (key) refs.add(key);
      i = end + 2;
      continue;
    }
    i++;
  }
  return Array.from(refs);
}
