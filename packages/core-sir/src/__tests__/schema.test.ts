/**
 * schema.test.ts
 *
 * Phase 0 gate test: verifies that the SIR Zod schema correctly validates
 * a well-formed minimal SIR, and rejects malformed ones.
 *
 * Definition of Done (§16 Phase 0): this test must pass before Phase 1 begins.
 */
import { describe, it, expect } from 'vitest';
import { SIRSchema } from '../schema.js';
import { SIR_SCHEMA_VERSION } from '../version.js';
import type { SIR } from '../types.js';

// ---------------------------------------------------------------------------
// Minimal valid SIR fixture
// ---------------------------------------------------------------------------

const HEURISTIC = { provenance: 'heuristic' as const, confidence: 1.0 };

const minimalSIR: SIR = {
  schemaVersion: SIR_SCHEMA_VERSION,
  sourceHash: 'abc123def456',
  apiName: 'TDSPL API',
  resources: [
    {
      name: 'authentication',
      displayName: 'Authentication',
      description: 'User authentication and session management',
      operations: [
        {
          id: 'SignIn',
          kind: 'action',
          danger: 'safe',
          name: 'sign-in',
          description: 'Authenticate a user and return a bearer token',
          arguments: [
            {
              name: 'username',
              canonicalName: 'username',
              type: 'string',
              required: true,
              source: 'body',
              role: 'none',
              inference: HEURISTIC,
            },
            {
              name: 'password',
              canonicalName: 'password',
              type: 'string',
              required: true,
              source: 'body',
              role: 'none',
              inference: HEURISTIC,
            },
          ],
          output: {
            shape: 'single',
            renderHint: 'detail',
            defaultFields: ['access_token', 'expires_in'],
            hasTotalCount: false,
            inference: HEURISTIC,
          },
          auth: [{ scheme: 'none' }],
          httpBinding: {
            method: 'POST',
            path: '/api/SignIn',
            rawPath: '/api/SignIn',
          },
          inference: HEURISTIC,
        },
      ],
      relationships: [],
      inference: HEURISTIC,
    },
  ],
  diagnostics: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SIRSchema', () => {
  it('validates a minimal well-formed SIR', () => {
    const result = SIRSchema.safeParse(minimalSIR);
    if (!result.success) {
      // Surface the full validation errors for easier debugging
      console.error('SIR validation errors:', JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });

  it('rejects a SIR with wrong schemaVersion', () => {
    const bad = { ...minimalSIR, schemaVersion: '9.9.9' };
    const result = SIRSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects a SIR with invalid provenance value', () => {
    const bad = JSON.parse(JSON.stringify(minimalSIR)) as typeof minimalSIR;
    // @ts-expect-error intentionally invalid for test
    bad.resources[0]!.inference.provenance = 'magic';
    const result = SIRSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects a SIR with confidence out of range', () => {
    const bad = JSON.parse(JSON.stringify(minimalSIR)) as typeof minimalSIR;
    bad.resources[0]!.inference.confidence = 1.5;
    const result = SIRSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects a SIR with invalid operation kind', () => {
    const bad = JSON.parse(JSON.stringify(minimalSIR)) as typeof minimalSIR;
    // @ts-expect-error intentionally invalid for test
    bad.resources[0]!.operations[0]!.kind = 'fly';
    const result = SIRSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects a SIR missing required fields (sourceHash)', () => {
    const { sourceHash: _omitted, ...bad } = minimalSIR;
    const result = SIRSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('accepts a SIR with diagnostics', () => {
    const withDiag: SIR = {
      ...minimalSIR,
      diagnostics: [
        {
          level: 'warning',
          message: 'Could not resolve {{URL}} — no environment file supplied',
          subject: 'SignIn',
        },
      ],
    };
    const result = SIRSchema.safeParse(withDiag);
    expect(result.success).toBe(true);
  });

  it('exports SIR_SCHEMA_VERSION as a semver string', () => {
    expect(SIR_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
