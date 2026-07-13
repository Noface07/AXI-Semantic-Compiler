/**
 * Pass 6: dangerous-command-detection.ts
 *
 * Classifies operations by danger level:
 *  'safe'        → read-only operations
 *  'mutating'    → write operations that are reversible
 *  'destructive' → delete/reset/purge operations (irreversible)
 *
 * AXI Principle 6: 'destructive' operations use non-interactive two-phase confirm.
 * Never a TTY blocking prompt — structured confirmation_required response + --force flag.
 *
 * Must run after resource-merge (needs Operation.kind and HTTP binding).
 */
import type { SIR, Operation, DangerLevel } from '@asc/core-sir';
import type { PassConfig } from './types.js';

const DESTRUCTIVE_METHODS = new Set(['DELETE']);
const DESTRUCTIVE_NAME_PATTERNS = /delete|remove|destroy|purge|wipe|clear|reset|archive|terminate|cancel/i;
const DESTRUCTIVE_PATH_PATTERNS = /delete|remove|destroy|purge|reset/i;

const MUTATING_METHODS = new Set(['PUT', 'PATCH']);

export function dangerousCommandDetectionPass(sir: SIR, _config: PassConfig): SIR {
  return {
    ...sir,
    resources: sir.resources.map((r) => ({
      ...r,
      operations: r.operations.map((op) => classifyDanger(op)),
    })),
  };
}

function classifyDanger(op: Operation): Operation {
  const method = op.httpBinding.method.toUpperCase();
  const name = op.name.toLowerCase();
  const path = op.httpBinding.rawPath.toLowerCase();
  const kind = op.kind;

  let danger: DangerLevel = 'safe';

  if (
    DESTRUCTIVE_METHODS.has(method) ||
    kind === 'delete' ||
    DESTRUCTIVE_NAME_PATTERNS.test(name) ||
    DESTRUCTIVE_PATH_PATTERNS.test(path)
  ) {
    danger = 'destructive';
  } else if (
    MUTATING_METHODS.has(method) ||
    kind === 'update' ||
    kind === 'create'
  ) {
    danger = 'mutating';
  }

  return { ...op, danger };
}
