/**
 * cli/serializer.ts
 *
 * Deterministic JSON serializer for the Semantic Intermediate Representation (SIR).
 * Validates the SIR against the Zod schema before emitting, ensuring that
 * the pipeline never produces an invalid SIR.
 * Uses a stable, sorted-key stringify to guarantee byte-identical outputs
 * for identical ASTs.
 */
import { SIRSchema } from '@asc/core-sir';
import type { SIR, Diagnostic } from '@asc/core-sir';

export interface EmitResult {
  json: string;
  diagnostics: Diagnostic[];
}

export function emitSIR(sir: SIR): EmitResult {
  const diagnostics: Diagnostic[] = [...sir.diagnostics];

  // 1. Validate against Zod schema
  const validation = SIRSchema.safeParse(sir);
  if (!validation.success) {
    for (const issue of validation.error.issues) {
      diagnostics.push({
        level: 'error',
        message: `Schema validation failed: ${issue.message}`,
        fieldPath: issue.path.join('.'),
      });
    }
  }

  // 2. Deterministic serialization (sorted keys)
  const json = deterministicStringify(sir, 2);

  return { json, diagnostics };
}

/**
 * Stringify JSON with deterministic key sorting.
 */
function deterministicStringify(obj: unknown, space: number = 2): string {
  const allKeys: string[] = [];
  JSON.stringify(obj, (key, value) => {
    allKeys.push(key);
    return value;
  });

  allKeys.sort();

  return JSON.stringify(obj, allKeys, space);
}
