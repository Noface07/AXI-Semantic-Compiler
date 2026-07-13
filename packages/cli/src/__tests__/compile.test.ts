/**
 * compile.test.ts
 *
 * Phase 3 gate test: verifies that the CLI compiler produces a valid,
 * byte-identical sir.json on multiple runs.
 *
 * Definition of Done (§16 Phase 3):
 *  - Zod validation passes on the generated SIR
 *  - Determinism: running twice on the same input produces the EXACT same JSON string
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';
import { parsePostmanCollection } from '@asc/frontend-postman';
import { compilePipeline } from '@asc/pipeline';
import { emitSIR } from '../serializer.js';

const COLLECTION_PATH = join(
  process.cwd(),
  'fixtures',
  'postman',
  'synthetic_test_collection.postman_collection.json',
);

const rawCollection: unknown = JSON.parse(readFileSync(COLLECTION_PATH, 'utf8'));

// Helper to run the whole chain
function runChain() {
  const { ast } = parsePostmanCollection(rawCollection, { URL: 'api.tdspl.com' });
  const { sir } = compilePipeline(ast);
  return emitSIR(sir);
}

function hashString(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

describe('CLI Serializer (Phase 3 Gate)', () => {
  it('produces a valid sir.json (Zod validation passes, 0 error diagnostics)', () => {
    const { diagnostics } = runChain();
    const errors = diagnostics.filter((d) => d.level === 'error');
    if (errors.length > 0) {
      console.error('Validation errors:', JSON.stringify(errors, null, 2));
    }
    expect(errors).toHaveLength(0);
  });

  it('is byte-identically deterministic across runs', () => {
    const result1 = runChain();
    const result2 = runChain();

    // The raw JSON strings must be exactly equal
    expect(result1.json).toBe(result2.json);

    const hash1 = hashString(result1.json);
    const hash2 = hashString(result2.json);
    expect(hash1).toBe(hash2);
  });

  it('produces a non-empty JSON string with sorted keys', () => {
    const { json } = runChain();
    expect(json.length).toBeGreaterThan(100);

    // Basic spot check for sorted keys at top level
    const parsed = JSON.parse(json);
    const keys = Object.keys(parsed);
    const sortedKeys = [...keys].sort();
    expect(keys).toEqual(sortedKeys);
  });
});
