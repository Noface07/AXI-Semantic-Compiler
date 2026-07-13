/**
 * Pass 4: boolean-detection.ts
 *
 * Detects boolean arguments and marks them as 'boolean-flag' role.
 * AXI will render these as --enable-X / --no-X flag pairs.
 */
import type { SIR, Argument } from '@asc/core-sir';
import type { PassConfig } from './types.js';
import { HEURISTIC } from './utils.js';

export function booleanDetectionPass(sir: SIR, _config: PassConfig): SIR {
  return {
    ...sir,
    resources: sir.resources.map((r) => ({
      ...r,
      operations: r.operations.map((op) => ({
        ...op,
        arguments: op.arguments.map(detectBooleanFlag),
      })),
    })),
  };
}

function detectBooleanFlag(arg: Argument): Argument {
  if (arg.role !== 'none') return arg;

  const isBoolean =
    arg.type === 'boolean' ||
    /^(is|has|enable|disable|show|hide|include|exclude|with|without|active|inactive)[A-Z_]/.test(arg.name) ||
    /^(isEnabled|isActive|isVisible|isRequired|isDeleted|isArchived)$/i.test(arg.name);

  if (isBoolean) {
    return { ...arg, type: 'boolean', role: 'boolean-flag', inference: HEURISTIC };
  }

  return arg;
}
