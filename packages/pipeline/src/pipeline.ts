/**
 * pipeline/pipeline.ts
 *
 * Orchestrates: AST → bootstrap SIR → passes (fixed order) → final SIR
 *
 * Pass order (from §6 Stage 4) — FIXED, not configurable:
 *   1. Resource Merge        (must be first — populates resources)
 *   2. Pagination Detection  (needs merged resources)
 *   3. Search Detection
 *   4. Boolean Detection
 *   5. Collection Detection
 *   6. Dangerous Command Detection
 *   7. Confidence Consolidation (must be last)
 *
 * Design guarantees:
 *  - Pure functional chain: each pass receives the previous pass's SIR output
 *  - No pass mutates shared state
 *  - Per-pass errors are caught and added to diagnostics; pipeline continues
 *  - Same AST + same config → byte-identical SIR output (determinism)
 */
import * as crypto from 'crypto';
import type { UnifiedAST } from '@asc/core-ast';
import { SIR_SCHEMA_VERSION } from '@asc/core-sir';
import type { SIR, Diagnostic } from '@asc/core-sir';
import {
  resourceMergePass,
  paginationDetectionPass,
  searchDetectionPass,
  booleanDetectionPass,
  collectionDetectionPass,
  dangerousCommandDetectionPass,
  complexityDetectionPass,
  confidenceConsolidationPass,
  DEFAULT_PASS_CONFIG,
} from '@asc/passes';
import type { PassConfig } from '@asc/passes';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PipelineConfig {
  passConfig?: Partial<PassConfig>;
}

export interface PipelineResult {
  sir: SIR;
  diagnostics: Diagnostic[];
}

export function compilePipeline(ast: UnifiedAST, config: PipelineConfig = {}): PipelineResult {
  const passConfig: PassConfig = {
    ...DEFAULT_PASS_CONFIG,
    ...config.passConfig,
    passThresholds: {
      ...DEFAULT_PASS_CONFIG.passThresholds,
      ...(config.passConfig?.passThresholds ?? {}),
    },
  };

  // Bootstrap an empty SIR from the AST
  let sir = bootstrapSIR(ast);

  // Pass 1: Resource Merge — takes ast directly (needs raw endpoint data)
  sir = runPass('resource-merge', () => resourceMergePass(ast, sir, passConfig), sir);

  // Passes 2-6: operate on sir only
  sir = runPass('pagination-detection', () => paginationDetectionPass(sir, passConfig), sir);
  sir = runPass('search-detection',     () => searchDetectionPass(sir, passConfig), sir);
  sir = runPass('boolean-detection',    () => booleanDetectionPass(sir, passConfig), sir);
  sir = runPass('collection-detection', () => collectionDetectionPass(sir, passConfig), sir);
  sir = runPass('dangerous-command-detection', () => dangerousCommandDetectionPass(sir, passConfig), sir);
  sir = runPass('complexity-detection', () => complexityDetectionPass(sir, passConfig), sir);

  // Pass 7: Confidence Consolidation — must be last
  sir = runPass('confidence-consolidation', () => confidenceConsolidationPass(sir, passConfig), sir);

  return { sir, diagnostics: sir.diagnostics };
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function bootstrapSIR(ast: UnifiedAST): SIR {
  return {
    schemaVersion: SIR_SCHEMA_VERSION,
    sourceHash: ast.sourceHash,
    apiName: ast.apiName,
    resources: [],       // populated by resource-merge pass
    diagnostics: (ast.diagnostics ?? []).map((d) => ({
      level: d.level,
      message: d.message,
      subject: d.source,
    })),
  };
}

// ---------------------------------------------------------------------------
// Safe pass runner — catches per-pass errors, appends diagnostic, continues
// ---------------------------------------------------------------------------

function runPass(name: string, fn: () => SIR, fallback: SIR): SIR {
  try {
    return fn();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      ...fallback,
      diagnostics: [
        ...fallback.diagnostics,
        {
          level: 'error' as const,
          message: `Pass '${name}' threw an unexpected error: ${errorMessage}`,
          subject: `pass:${name}`,
        },
      ],
    };
  }
}
