/**
 * evaluator.test.ts
 *
 * Phase 5 Gate Test
 * Uses the eval harness to run the generated AXI CLI in a child process
 * and verify it executes without TypeScript/parsing errors.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parsePostmanCollection } from '@asc/frontend-postman';
import { compilePipeline } from '@asc/pipeline';
import { generateAXI } from '@asc/backend-axi';
import { evaluateAXI } from '../evaluator.js';

const COLLECTION_PATH = path.join(
  process.cwd(),
  'fixtures',
  'postman',
  'synthetic_test_collection.postman_collection.json',
);
const OUT_DIR = path.join(__dirname, 'test-eval-cli');

describe('Eval Harness (Phase 5 Gate)', () => {
  let sir: any;

  beforeAll(() => {
    // 1. Get real SIR
    const rawCollection = JSON.parse(fs.readFileSync(COLLECTION_PATH, 'utf8'));
    const { ast } = parsePostmanCollection(rawCollection, { URL: 'api.tdspl.com' });
    const pipelineResult = compilePipeline(ast);
    sir = pipelineResult.sir;

    // 2. Generate AXI CLI
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true, force: true });
    }
    generateAXI(sir, { outDir: OUT_DIR });
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true, force: true });
    }
  });

  it('evaluates the generated CLI successfully (runs without parsing errors)', async () => {
    // This takes a bit longer since it spawns ts-node for each resource
    const result = await evaluateAXI(OUT_DIR, sir);
    
    if (!result.success) {
      console.error('Eval failures:', result.errors);
    }
    
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  }, 300000); // 300s timeout for spawning processes
});
