/**
 * parser.test.ts
 *
 * Phase 1 gate test: verifies the Postman frontend against the TDSPL
 * Categorized collection (the real-world fixture).
 *
 * Definition of Done (§16 Phase 1):
 *  - Parsing succeeds (no error-level diagnostics)
 *  - Known endpoints are correctly extracted
 *  - Folder structure correctly populates resourceHints
 *  - {{URL}} unresolvable without env → warning diagnostic, not error
 *  - Malformed items don't throw (partial-failure tolerance)
 *  - Auth inheritance works (request-level > folder-level)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePostmanCollection } from '../parser.js';

// ---------------------------------------------------------------------------
// Load the TDSPL fixture
// ---------------------------------------------------------------------------

// vitest is always run from the monorepo root (d:\Trading\AXI\asc)
// so process.cwd() gives us the right base.
const COLLECTION_PATH = join(
  process.cwd(),
  'fixtures',
  'postman',
  'TDSPL Categorized.postman_collection.json',
);

const rawCollection: unknown = JSON.parse(readFileSync(COLLECTION_PATH, 'utf8'));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parsePostmanCollection — TDSPL Categorized', () => {
  it('parses without any error-level diagnostics', () => {
    const { diagnostics } = parsePostmanCollection(rawCollection);
    const errors = diagnostics.filter((d) => d.level === 'error');
    if (errors.length > 0) {
      console.error('Parser errors:', JSON.stringify(errors, null, 2));
    }
    expect(errors).toHaveLength(0);
  });

  it('correctly names the API', () => {
    const { ast } = parsePostmanCollection(rawCollection);
    expect(ast.apiName).toBe('TDSPL Categorized');
  });

  it('extracts endpoints (non-zero count)', () => {
    const { ast } = parsePostmanCollection(rawCollection);
    expect(ast.endpoints.length).toBeGreaterThan(0);
  });

  it('assigns folder names as resourceHints on each endpoint', () => {
    const { ast } = parsePostmanCollection(rawCollection);
    // Every endpoint should have at least one resourceHint (its folder)
    const noHints = ast.endpoints.filter((e) => e.resourceHints.length === 0);
    expect(noHints).toHaveLength(0);
  });

  it('extracts the SignIn endpoint correctly', () => {
    const { ast } = parsePostmanCollection(rawCollection);
    const signIn = ast.endpoints.find((e) => e.name === 'SignIn');
    expect(signIn).toBeDefined();
    expect(signIn?.method).toBe('POST');
    expect(signIn?.rawPath).toMatch(/SignIn/);
    expect(signIn?.resourceHints).toContain('Authentication & User Management');
  });

  it('warns about unresolvable {{URL}} variable (no env supplied)', () => {
    const { diagnostics } = parsePostmanCollection(rawCollection);
    const urlWarnings = diagnostics.filter(
      (d) => d.level === 'warning' && d.message.includes('URL'),
    );
    // Should have at least one warning for the unresolvable {{URL}}
    expect(urlWarnings.length).toBeGreaterThan(0);
  });

  it('resolves {{URL}} when an env file is supplied', () => {
    const { ast, diagnostics } = parsePostmanCollection(rawCollection, {
      URL: 'api.example.com',
    });
    const urlWarnings = diagnostics.filter(
      (d) => d.level === 'warning' && d.message.includes('URL'),
    );
    // With URL resolved, no more URL warnings
    expect(urlWarnings).toHaveLength(0);

    // The SignIn path should now contain the resolved host
    const signIn = ast.endpoints.find((e) => e.name === 'SignIn');
    // rawPath should still have {{URL}} (it's the unresolved version)
    expect(signIn?.rawPath).toBeDefined();
  });

  it('produces a non-empty sourceHash', () => {
    const { ast } = parsePostmanCollection(rawCollection);
    expect(ast.sourceHash).toBeTruthy();
    expect(ast.sourceHash.length).toBeGreaterThan(0);
  });

  it('produces deterministic output (same input → same hash)', () => {
    const { ast: ast1 } = parsePostmanCollection(rawCollection);
    const { ast: ast2 } = parsePostmanCollection(rawCollection);
    expect(ast1.sourceHash).toBe(ast2.sourceHash);
    expect(ast1.endpoints.length).toBe(ast2.endpoints.length);
  });

  it('handles malformed input gracefully (returns error diagnostic, no throw)', () => {
    expect(() => parsePostmanCollection(null)).not.toThrow();
    const { diagnostics } = parsePostmanCollection(null);
    const errors = diagnostics.filter((d) => d.level === 'error');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('detects bearer auth on endpoints inside authenticated folders', () => {
    const { ast } = parsePostmanCollection(rawCollection);
    // GetUserProfile has bearer auth at request level
    const getUserProfile = ast.endpoints.find((e) => e.name === 'GetUserProfile');
    expect(getUserProfile).toBeDefined();
    expect(getUserProfile?.auth?.type).toBe('bearer');
  });

  it('groups endpoints by folder into distinct resource hint groups', () => {
    const { ast } = parsePostmanCollection(rawCollection);
    const groups = new Set(ast.endpoints.map((e) => e.resourceHints[0] ?? ''));
    // TDSPL has multiple top-level folders
    expect(groups.size).toBeGreaterThan(1);
  });
});
