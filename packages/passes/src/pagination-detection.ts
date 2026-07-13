/**
 * Pass 2: pagination-detection.ts
 *
 * Detects pagination arguments and marks them with the correct role.
 * Page-based and cursor-based pagination are DISTINCT roles — never conflated.
 * Also sets hasTotalCount on Output when a count field is detected.
 */
import type { SIR, Argument, Operation, Resource, Output } from '@asc/core-sir';
import type { PassConfig } from './types.js';
import { HEURISTIC } from './utils.js';

// ---------------------------------------------------------------------------
// Pattern sets
// ---------------------------------------------------------------------------

const PAGE_NAMES = new Set(['page', 'pagenumber', 'pageno', 'currentpage', 'pageindex']);
const LIMIT_NAMES = new Set(['limit', 'pagesize', 'size', 'perpage', 'count', 'take', 'top', 'maxresults', 'maxrecords']);
const CURSOR_NAMES = new Set(['cursor', 'after', 'before', 'nextcursor', 'nexttoken', 'continuationtoken', 'fromid', 'sinceid', 'offset']);
const COUNT_FIELDS = new Set(['totalcount', 'total', 'count', 'totalpages', 'totalrecords', 'totalitems', 'totalrows']);

// ---------------------------------------------------------------------------
// Pass entry point
// ---------------------------------------------------------------------------

export function paginationDetectionPass(sir: SIR, _config: PassConfig): SIR {
  return {
    ...sir,
    resources: sir.resources.map((r) => ({
      ...r,
      operations: r.operations.map((op) => applyPaginationDetection(op)),
    })),
  };
}

function applyPaginationDetection(op: Operation): Operation {
  const updatedArgs = op.arguments.map((arg) => detectPaginationRole(arg));

  // Check if any argument is a pagination arg → this is a paginatable operation
  const hasPagination = updatedArgs.some(
    (a) => a.role === 'pagination-page' || a.role === 'pagination-limit' || a.role === 'pagination-cursor',
  );

  // Check body schema for totalCount-like fields
  // (we look for known count field names in the arg list too, since body fields are flattened)
  const hasTotalCount =
    op.output.hasTotalCount ||
    updatedArgs.some((a) => COUNT_FIELDS.has(a.name.toLowerCase()));

  const updatedOutput: Output = hasTotalCount
    ? { ...op.output, hasTotalCount: true, inference: HEURISTIC }
    : op.output;

  return {
    ...op,
    arguments: updatedArgs,
    output: updatedOutput,
  };
}

function detectPaginationRole(arg: Argument): Argument {
  // Don't overwrite an already-assigned role
  if (arg.role !== 'none') return arg;

  const normalized = arg.name.toLowerCase().replace(/[_-]/g, '');

  if (CURSOR_NAMES.has(normalized)) {
    return { ...arg, canonicalName: 'cursor', role: 'pagination-cursor', inference: HEURISTIC };
  }
  if (PAGE_NAMES.has(normalized)) {
    return { ...arg, canonicalName: 'page', role: 'pagination-page', inference: HEURISTIC };
  }
  if (LIMIT_NAMES.has(normalized)) {
    return { ...arg, canonicalName: 'limit', role: 'pagination-limit', inference: HEURISTIC };
  }

  return arg;
}
