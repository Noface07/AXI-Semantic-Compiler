/**
 * backend-axi/toon.ts
 *
 * Implements the Tabular Object-Oriented Notation (TOON) formatter.
 * TOON is a token-efficient, human-readable and agent-readable text format.
 * - Objects are rendered as key-value pairs (key: value)
 * - Arrays of objects are rendered as padded tables
 * - Scalars are rendered directly
 */

export interface ToonConfig {
  truncateStringsAt?: number;
}

export function formatToon(data: unknown, config: ToonConfig = {}): string {
  if (data === null || data === undefined) {
    return '';
  }

  if (Array.isArray(data)) {
    return formatToonArray(data, config);
  }

  if (typeof data === 'object') {
    return formatToonObject(data as Record<string, unknown>, config);
  }

  // Scalar
  return String(data);
}

function formatToonArray(arr: unknown[], config: ToonConfig): string {
  if (arr.length === 0) {
    return '(empty array)';
  }

  // If it's an array of scalars, just list them comma-separated
  if (arr.every((item) => typeof item !== 'object' || item === null)) {
    return arr.join(', ');
  }

  // It's an array of objects, render as a table
  const objects = arr.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
  
  if (objects.length === 0) {
    return '(mixed array)';
  }

  // Collect all keys
  const keys = new Set<string>();
  for (const obj of objects) {
    for (const k of Object.keys(obj)) {
      keys.add(k);
    }
  }
  const columns = Array.from(keys);

  // Compute column widths
  const widths = new Map<string, number>();
  for (const col of columns) {
    widths.set(col, col.length);
  }

  const rows = objects.map((obj) => {
    const row: Record<string, string> = {};
    for (const col of columns) {
      const val = truncate(formatScalar(obj[col]), config.truncateStringsAt);
      row[col] = val;
      widths.set(col, Math.max(widths.get(col)!, val.length));
    }
    return row;
  });

  // Render header
  let out = columns.map((col) => col.padEnd(widths.get(col)!)).join('  ') + '\n';
  
  // Render rows
  for (const row of rows) {
    out += columns.map((col) => row[col].padEnd(widths.get(col)!)).join('  ') + '\n';
  }

  return out.trimEnd();
}

function formatToonObject(obj: Record<string, unknown>, config: ToonConfig, indent = 0): string {
  let out = '';
  const pad = ' '.repeat(indent);
  
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      continue;
    }
    
    if (Array.isArray(v)) {
      if (v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
        out += `${pad}${k}:\n${formatToonArray(v, config).split('\n').map(l => pad + '  ' + l).join('\n')}\n`;
      } else {
        out += `${pad}${k}: ${v.join(', ')}\n`;
      }
    } else if (typeof v === 'object') {
      out += `${pad}${k}:\n${formatToonObject(v as Record<string, unknown>, config, indent + 2)}\n`;
    } else {
      out += `${pad}${k}: ${truncate(String(v), config.truncateStringsAt)}\n`;
    }
  }
  return out.trimEnd();
}

function formatScalar(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function truncate(str: string, max?: number): string {
  if (!max || str.length <= max) return str;
  return `${str.slice(0, max)}... (truncated, ${str.length} chars total — use --full)`;
}
