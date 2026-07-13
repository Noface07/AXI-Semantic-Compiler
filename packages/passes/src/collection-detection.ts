/**
 * Pass 5: collection-detection.ts
 *
 * Refines Output.shape based on response schema analysis.
 * Also selects defaultFields (3-4 fields for minimal default output per AXI Principle 2).
 */
import type { SIR, Operation, Output, EntityRef } from '@asc/core-sir';
import type { PassConfig } from './types.js';
import { HEURISTIC } from './utils.js';

// Field names that are good candidates for default display
const ID_FIELD_PATTERNS = /^(id|_id|uuid|guid|key|code|no|number|ref)$/i;
const NAME_FIELD_PATTERNS = /^(name|title|label|description|subject|text)$/i;
const STATUS_FIELD_PATTERNS = /^(status|state|type|kind|category|flag)$/i;
const DATE_FIELD_PATTERNS = /^(createdat|updatedat|date|timestamp|time|createdon|modifiedon)$/i;

export function collectionDetectionPass(sir: SIR, _config: PassConfig): SIR {
  return {
    ...sir,
    resources: sir.resources.map((r) => ({
      ...r,
      operations: r.operations.map((op) => refineOutput(op)),
    })),
  };
}

function refineOutput(op: Operation): Operation {
  const output = op.output;
  const entity = output.entity;

  if (!entity) return op;

  // Select 3-4 best default fields from the entity
  const defaultFields = selectDefaultFields(entity);

  // Refine renderHint: collections default to 'toon', singles to 'detail'
  const renderHint: Output['renderHint'] =
    output.shape === 'collection' ? 'toon' : 'detail';

  return {
    ...op,
    output: {
      ...output,
      renderHint,
      defaultFields,
      inference: HEURISTIC,
    },
  };
}

function selectDefaultFields(entity: EntityRef): string[] {
  const props = entity.properties;
  const selected: string[] = [];

  // Priority 1: identifier fields (id, uuid, etc.)
  const idFields = props.filter((p) => ID_FIELD_PATTERNS.test(p.name)).slice(0, 1);
  selected.push(...idFields.map((p) => p.name));

  // Priority 2: name/title fields
  if (selected.length < 3) {
    const nameFields = props
      .filter((p) => NAME_FIELD_PATTERNS.test(p.name) && !selected.includes(p.name))
      .slice(0, 1);
    selected.push(...nameFields.map((p) => p.name));
  }

  // Priority 3: status fields
  if (selected.length < 3) {
    const statusFields = props
      .filter((p) => STATUS_FIELD_PATTERNS.test(p.name) && !selected.includes(p.name))
      .slice(0, 1);
    selected.push(...statusFields.map((p) => p.name));
  }

  // Priority 4: date fields
  if (selected.length < 4) {
    const dateFields = props
      .filter((p) => DATE_FIELD_PATTERNS.test(p.name) && !selected.includes(p.name))
      .slice(0, 1);
    selected.push(...dateFields.map((p) => p.name));
  }

  // Fill up to 4 with remaining fields
  if (selected.length < 4) {
    const remaining = props
      .filter((p) => !selected.includes(p.name))
      .slice(0, 4 - selected.length);
    selected.push(...remaining.map((p) => p.name));
  }

  return selected.slice(0, 4);
}
