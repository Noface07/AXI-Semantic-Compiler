/**
 * Pass: complexity-detection.ts
 *
 * Computes an interaction complexity hint ('simple', 'medium', 'complex')
 * for each operation. The AXI backend uses this to route to the appropriate
 * interaction model (flags vs. wizard vs. auto-YAML).
 *
 * Scoring heuristic:
 *  - simple: ≤ 3 scalar arguments (easy to pass as flags)
 *  - medium: 4-8 arguments, or shallow nested objects (good for wizard/TUI)
 *  - complex: > 8 arguments, deep nesting, or complex array shapes (requires YAML/JSON)
 */
import type { SIR, Operation, Argument, OperationComplexity } from '@asc/core-sir';
import type { PassConfig } from './types.js';

export function complexityDetectionPass(sir: SIR, _config: PassConfig): SIR {
  return {
    ...sir,
    resources: sir.resources.map((r) => ({
      ...r,
      operations: r.operations.map((op) => computeComplexity(op)),
    })),
  };
}

function computeComplexity(op: Operation): Operation {
  // Count only arguments that aren't path parameters (path params are usually positionals)
  // Wait, AXI usually passes path params as positional args or flags too.
  // We'll count all required and optional arguments that a user might need to provide.
  const args = op.arguments;

  // Simple heuristics:
  // 1. Are there any object/array arguments?
  const hasObjects = args.some((a) => a.type === 'object');
  const hasArrays = args.some((a) => a.type === 'array');

  let complexity: OperationComplexity = 'simple';

  if (hasObjects) {
    // If the body is a deep object, it's complex.
    // Since our v1 heuristic flattens the top-level object fields into distinct arguments,
    // a true 'object' type here means a nested object.
    complexity = 'complex';
  } else if (hasArrays) {
    // Arrays of scalars are medium, arrays of objects are complex.
    // For v1, let's treat arrays as 'medium' since they can be passed as repeatable flags.
    complexity = 'medium';
  } else {
    // All scalars
    if (args.length > 8) {
      complexity = 'complex';
    } else if (args.length > 3) {
      complexity = 'medium';
    } else {
      complexity = 'simple';
    }
  }

  // File uploads (binary) usually mean at least medium complexity because of the file picker/path logic
  if (args.some((a) => a.type === 'file')) {
    complexity = complexity === 'simple' ? 'medium' : complexity;
  }

  return { ...op, complexity };
}
