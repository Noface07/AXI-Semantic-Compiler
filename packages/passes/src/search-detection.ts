/**
 * Pass 3: search-detection.ts
 *
 * Detects search/filter arguments and upgrades tentative 'list' operations
 * to 'search' when a primary search argument is present.
 */
import type { SIR, Argument, Operation } from '@asc/core-sir';
import type { PassConfig } from './types.js';
import { HEURISTIC } from './utils.js';

const SEARCH_NAMES = new Set([
  'search', 'searchtext', 'searchterm', 'searchquery', 'query', 'q',
  'keyword', 'keywords', 'term', 'filter', 'filters', 'searchvalue',
  'searchkeyword', 'find',
]);

const FILTER_NAMES = new Set([
  'filter', 'filters', 'where', 'condition', 'criteria',
  'filtermodel', 'filterparams', 'filterby',
]);

export function searchDetectionPass(sir: SIR, _config: PassConfig): SIR {
  return {
    ...sir,
    resources: sir.resources.map((r) => ({
      ...r,
      operations: r.operations.map((op) => applySearchDetection(op)),
    })),
  };
}

function applySearchDetection(op: Operation): Operation {
  const updatedArgs = op.arguments.map((arg) => detectSearchRole(arg));

  // Upgrade 'list' to 'search' if there's a primary search argument
  const hasSearchArg = updatedArgs.some((a) => a.role === 'search');
  const kind =
    op.kind === 'list' && hasSearchArg ? 'search' : op.kind;

  return {
    ...op,
    kind,
    arguments: updatedArgs,
  };
}

function detectSearchRole(arg: Argument): Argument {
  if (arg.role !== 'none') return arg;

  const normalized = arg.name.toLowerCase().replace(/[_-]/g, '');

  if (SEARCH_NAMES.has(normalized)) {
    return { ...arg, canonicalName: 'search', role: 'search', inference: HEURISTIC };
  }
  if (FILTER_NAMES.has(normalized)) {
    return { ...arg, canonicalName: 'filter', role: 'filter', inference: HEURISTIC };
  }

  return arg;
}
