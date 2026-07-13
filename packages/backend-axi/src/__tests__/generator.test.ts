/**
 * generator.test.ts
 *
 * Validates that the AXI generator produces the correct CLI structure
 * from a SIR, respecting AXI principles (TOON, interaction routing, etc).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { parsePostmanCollection } from '@asc/frontend-postman';
import { compilePipeline } from '@asc/pipeline';
import { generateAXI } from '../generator.js';

const COLLECTION_PATH = path.join(
  process.cwd(),
  'fixtures',
  'postman',
  'synthetic_test_collection.postman_collection.json',
);
const OUT_DIR = path.join(__dirname, 'test-output-cli');

describe('AXI Generator (Phase 4 Gate)', () => {
  beforeAll(() => {
    // 1. Get real SIR
    const rawCollection = JSON.parse(fs.readFileSync(COLLECTION_PATH, 'utf8'));
    const { ast } = parsePostmanCollection(rawCollection, { URL: 'api.tdspl.com' });
    const { sir } = compilePipeline(ast);

    // 2. Generate AXI CLI
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true, force: true });
    }
    generateAXI(sir, { outDir: OUT_DIR });
  });

  it('(a) generates a valid package.json with the correct bin name', () => {
    const pkgStr = fs.readFileSync(path.join(OUT_DIR, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgStr);
    expect(pkg.name).toBe('tdspl-categorized-cli');
    expect(pkg.bin['tdsplcategorized']).toBe('./dist/index.js');
  });

  it('(b) implements TOON default formatting in utils', () => {
    const utilsCode = fs.readFileSync(path.join(OUT_DIR, 'src', 'utils.ts'), 'utf8');
    expect(utilsCode).toContain('export function formatToon');
  });

  it('(c) generates subcommand groups for each resource', () => {
    const authFile = path.join(OUT_DIR, 'src', 'commands', 'authentication---user-managements.ts');
    expect(fs.existsSync(authFile)).toBe(true);
    const authCode = fs.readFileSync(authFile, 'utf8');
    expect(authCode).toContain("program.command('authentication---user-managements')");
  });

  it('(d) routes complex interactions to auto-YAML or Wizard based on complexity scorer', () => {
    // AddEdit operations with many fields should get marked complex or medium
    const deckFile = path.join(OUT_DIR, 'src', 'commands', 'deck---dashboard-managements.ts');
    expect(fs.existsSync(deckFile)).toBe(true);
    const deckCode = fs.readFileSync(deckFile, 'utf8');
    
    // We expect handleComplexInteraction for things with objects/arrays
    expect(deckCode).toContain("handleComplexInteraction");
    expect(deckCode).toContain(".option('--file <path>', 'Provide arguments via JSON/YAML file')");
  });

  it('(e) implements Principle 6 two-phase confirm for destructive commands', () => {
    const deckFile = path.join(OUT_DIR, 'src', 'commands', 'deck---dashboard-managements.ts');
    const deckCode = fs.readFileSync(deckFile, 'utf8');
    
    // Delete commands should have checkTwoPhaseConfirm and --force flag
    expect(deckCode).toContain("checkTwoPhaseConfirm");
    expect(deckCode).toContain(".option('--force', 'Bypass two-phase confirmation')");
  });

  it('(f) implements Principle 8 live data on empty args and Principle 9 contextual help', () => {
    const authFile = path.join(OUT_DIR, 'src', 'commands', 'authentication---user-managements.ts');
    const authCode = fs.readFileSync(authFile, 'utf8');
    
    // Principle 8: action on the group itself
    expect(authCode).toContain("group.action(() => {");
    expect(authCode).toContain("Run `<cli> authentication---user-managements --help`");
  });
});
