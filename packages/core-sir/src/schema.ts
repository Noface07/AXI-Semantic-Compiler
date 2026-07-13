/**
 * core-sir/schema.ts
 *
 * Zod schemas mirroring every type in types.ts.
 * SIRSchema is the runtime validation gate — every SIR emission is
 * validated through this before being written to disk.
 *
 * The schema is the versioned public contract for backends.
 */
import { z } from 'zod';
import { SIR_SCHEMA_VERSION } from './version.js';

// ---------------------------------------------------------------------------
// Provenance & Confidence
// ---------------------------------------------------------------------------

export const ProvenanceSchema = z.enum(['explicit', 'override', 'heuristic', 'ai-inferred']);

export const ConfidenceSchema = z.number().min(0).max(1);

export const InferenceMetadataSchema = z.object({
  provenance: ProvenanceSchema,
  confidence: ConfidenceSchema,
  rationale: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Entity & Relationships
// ---------------------------------------------------------------------------

export const EntityPropertySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null', 'unknown']),
  required: z.boolean(),
  nullable: z.boolean(),
  description: z.string().optional(),
  isIdentifier: z.boolean(),
  isStatusField: z.boolean(),
});

export const EntityRefSchema = z.object({
  name: z.string().min(1),
  properties: z.array(EntityPropertySchema),
});

export const RelationshipKindSchema = z.enum(['parent', 'child', 'hasMany', 'references']);

export const RelationshipSchema = z.object({
  kind: RelationshipKindSchema,
  targetResource: z.string().min(1),
  inference: InferenceMetadataSchema,
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const AuthSchemeTypeSchema = z.enum(['bearer', 'apikey', 'oauth2', 'basic', 'none', 'unknown']);

export const AuthRequirementSchema = z.object({
  scheme: AuthSchemeTypeSchema,
  location: z.enum(['header', 'query', 'cookie']).optional(),
  keyName: z.string().optional(),
  scopes: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

export const ArgumentRoleSchema = z.enum([
  'identifier',
  'search',
  'filter',
  'sort',
  'pagination-page',
  'pagination-limit',
  'pagination-cursor',
  'boolean-flag',
  'enum',
  'file',
  'none',
]);

export const ArgumentSourceSchema = z.enum(['path', 'query', 'header', 'body', 'cookie']);

export const ArgumentSchema = z.object({
  name: z.string().min(1),
  canonicalName: z.string().min(1),
  type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object', 'file', 'unknown']),
  required: z.boolean(),
  source: ArgumentSourceSchema,
  role: ArgumentRoleSchema,
  description: z.string().optional(),
  enumValues: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
  defaultValue: z.unknown().optional(),
  astSchema: z.any().optional(),
  inference: InferenceMetadataSchema,
});

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export const OutputShapeSchema = z.enum(['single', 'collection', 'stream', 'file', 'none']);

export const RenderHintSchema = z.enum(['toon', 'table', 'detail', 'raw', 'progress']);

export const OutputSchema = z.object({
  shape: OutputShapeSchema,
  renderHint: RenderHintSchema,
  defaultFields: z.array(z.string()),
  entity: EntityRefSchema.optional(),
  hasTotalCount: z.boolean(),
  inference: InferenceMetadataSchema,
});

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export const OperationKindSchema = z.enum([
  'list', 'get', 'create', 'update', 'delete',
  'search', 'action', 'export', 'import', 'stream',
]);

export const DangerLevelSchema = z.enum(['safe', 'mutating', 'destructive']);

export const ComplexitySchema = z.enum(['simple', 'medium', 'complex']);

export const DeprecationInfoSchema = z.object({
  since: z.string().optional(),
  note: z.string().optional(),
  sunsetDate: z.string().optional(),
});

export const OperationSchema = z.object({
  id: z.string().min(1),
  kind: OperationKindSchema,
  danger: DangerLevelSchema,
  complexity: ComplexitySchema.optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  arguments: z.array(ArgumentSchema),
  output: OutputSchema,
  auth: z.array(AuthRequirementSchema),
  deprecated: DeprecationInfoSchema.optional(),
  httpBinding: z.object({
    method: z.string().min(1),
    path: z.string().min(1),
    rawPath: z.string().min(1),
    bodyType: z.string().optional(),
  }),
  inference: InferenceMetadataSchema,
});

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export const ResourceSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string(),
  primaryEntity: EntityRefSchema.optional(),
  operations: z.array(OperationSchema),
  relationships: z.array(RelationshipSchema),
  inference: InferenceMetadataSchema,
});

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export const DiagnosticLevelSchema = z.enum(['error', 'warning', 'info', 'review']);

export const DiagnosticSchema = z.object({
  level: DiagnosticLevelSchema,
  message: z.string().min(1),
  subject: z.string().optional(),
  fieldPath: z.string().optional(),
  inference: InferenceMetadataSchema.optional(),
});

// ---------------------------------------------------------------------------
// Top-level SIR schema — the versioned public contract
// ---------------------------------------------------------------------------

export const SIRSchema = z.object({
  schemaVersion: z.literal(SIR_SCHEMA_VERSION),
  sourceHash: z.string().min(1),
  apiName: z.string().min(1),
  resources: z.array(ResourceSchema),
  diagnostics: z.array(DiagnosticSchema),
});

// Infer TypeScript type from Zod schema (should match types.ts — tests verify this)
export type SIRFromSchema = z.infer<typeof SIRSchema>;
