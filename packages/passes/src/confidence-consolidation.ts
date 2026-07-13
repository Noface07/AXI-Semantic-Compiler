/**
 * Pass 7: confidence-consolidation.ts
 *
 * Must run LAST — reconciles any conflicting provenance/confidence fields.
 *
 * In v1 (heuristic-only):
 *  - All inferred fields get provenance: 'heuristic', confidence: 1.0
 *  - Produces review diagnostics for any operation left as 'action' kind
 *    (action = couldn't determine a more specific kind — needs human review in Phase 6+)
 *
 * In Phase 6+, this pass will also:
 *  - Compare heuristic vs ai-inferred fields and resolve conflicts
 *  - Write low-confidence fields to review.json
 *  - Apply overrides from asc-overrides.json
 */
import type { SIR, Resource, Operation, Argument, Diagnostic } from '@asc/core-sir';
import type { PassConfig } from './types.js';
import { HEURISTIC } from './utils.js';

export function confidenceConsolidationPass(sir: SIR, config: PassConfig): SIR {
  const reviewDiagnostics: Diagnostic[] = [];

  const resources = sir.resources.map((r) => consolidateResource(r, reviewDiagnostics, config));

  return {
    ...sir,
    resources,
    diagnostics: [...sir.diagnostics, ...reviewDiagnostics],
  };
}

function consolidateResource(
  resource: Resource,
  diagnostics: Diagnostic[],
  config: PassConfig,
): Resource {
  const operations = resource.operations.map((op) =>
    consolidateOperation(op, resource.name, diagnostics, config),
  );

  return {
    ...resource,
    inference: HEURISTIC, // v1: all heuristic
    operations,
  };
}

function consolidateOperation(
  op: Operation,
  resourceName: string,
  diagnostics: Diagnostic[],
  _config: PassConfig,
): Operation {
  // Flag 'action' kind operations for review (couldn't determine a specific kind)
  if (op.kind === 'action') {
    diagnostics.push({
      level: 'review',
      message: `Operation '${op.id}' could not be classified beyond 'action' — consider adding an x-asc-kind vendor extension`,
      subject: `${resourceName}.${op.id}`,
      fieldPath: `resources[name=${resourceName}].operations[id=${op.id}].kind`,
      inference: { provenance: 'heuristic', confidence: 1.0 },
    });
  }

  // Consolidate all argument inference metadata
  const args = op.arguments.map((arg) => ({
    ...arg,
    inference: HEURISTIC,
  }));

  return {
    ...op,
    inference: HEURISTIC,
    arguments: args,
    output: { ...op.output, inference: HEURISTIC },
  };
}
