/**
 * core-sir/types.ts
 *
 * The Semantic Intermediate Representation (SIR).
 *
 * Design rules:
 *  - SIR represents BEHAVIOR, not HTTP. No backend reads the source spec.
 *  - Every inferred field carries provenance + confidence.
 *  - All provenance values: 'explicit' > 'override' > 'heuristic' > 'ai-inferred'
 *  - v1 ships heuristic-only; 'ai-inferred' is reserved for Phase 6.
 */
import { SIR_SCHEMA_VERSION } from './version.js';

// ---------------------------------------------------------------------------
// Provenance & Confidence
// ---------------------------------------------------------------------------

/**
 * How a SIR field was decided — in descending trust order.
 *
 * | Source       | Meaning                                                        |
 * |--------------|----------------------------------------------------------------|
 * | explicit     | Stated directly in the spec (x-asc-* vendor extension)        |
 * | override     | Corrected by a human via asc-overrides.json                   |
 * | heuristic    | Produced by a deterministic rule (naming, schema shape)       |
 * | ai-inferred  | Produced by the AI semantic layer (Phase 6+)                  |
 */
export type Provenance = 'explicit' | 'override' | 'heuristic' | 'ai-inferred';

/** 0–1 score. Explicit and override always 1.0. Heuristic 1.0 in v1. AI < 1.0. */
export type Confidence = number;

/** Attached to every inferred SIR field. */
export interface InferenceMetadata {
  provenance: Provenance;
  confidence: Confidence;
  /** One-line rationale — populated for ai-inferred; optional for heuristic. */
  rationale?: string;
}

// ---------------------------------------------------------------------------
// Entity & Relationships
// ---------------------------------------------------------------------------

/** Reference to a named data shape (schema/type) in the SIR. */
export interface EntityRef {
  /** The entity name, e.g. "Topic", "DeckInformation" */
  name: string;
  /** Inline schema properties (simplified for v1; full schema in Phase 6+). */
  properties: EntityProperty[];
}

export interface EntityProperty {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null' | 'unknown';
  required: boolean;
  nullable: boolean;
  description?: string;
  isIdentifier: boolean;  // is this property a primary key / ID field?
  isStatusField: boolean; // is this property an enum/status field (for aggregate summaries)?
}

export type RelationshipKind = 'parent' | 'child' | 'hasMany' | 'references';

export interface Relationship {
  kind: RelationshipKind;
  targetResource: string;  // name of the related resource
  inference: InferenceMetadata;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type AuthSchemeType = 'bearer' | 'apikey' | 'oauth2' | 'basic' | 'none' | 'unknown';

export interface AuthRequirement {
  scheme: AuthSchemeType;
  /** For apikey: where the key is sent. */
  location?: 'header' | 'query' | 'cookie';
  /** For apikey: the key name (e.g. "X-API-Key"). */
  keyName?: string;
  /** For oauth2: the scopes required. */
  scopes?: string[];
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

/**
 * Semantic role of an argument — produced by the inference passes.
 * 'none' means the pass didn't assign a role.
 */
export type ArgumentRole =
  | 'identifier'
  | 'search'
  | 'filter'
  | 'sort'
  | 'pagination-page'
  | 'pagination-limit'
  | 'pagination-cursor'
  | 'boolean-flag'
  | 'enum'
  | 'file'
  | 'none';

/** Where in the HTTP request the argument lives. */
export type ArgumentSource = 'path' | 'query' | 'header' | 'body' | 'cookie';

export interface Argument {
  name: string;
  /** Canonical name after semantic normalization (e.g. searchText → search). */
  canonicalName: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'file' | 'unknown';
  required: boolean;
  source: ArgumentSource;
  role: ArgumentRole;
  description?: string;
  /** Allowed enum values, if known. */
  enumValues?: (string | number | boolean)[];
  /** Default value, if declared in the spec. */
  defaultValue?: unknown;
  /** Original AST Schema for deep nested structure analysis */
  astSchema?: any;
  inference: InferenceMetadata;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** The shape of what the operation returns. */
export type OutputShape = 'single' | 'collection' | 'stream' | 'file' | 'none';

/**
 * How the AXI backend should render the output by default.
 * 'toon' is the default for agent consumers.
 * 'table'/'progress' are human-mode only (via --human flag).
 */
export type RenderHint = 'toon' | 'table' | 'detail' | 'raw' | 'progress';

export interface Output {
  shape: OutputShape;
  renderHint: RenderHint;
  /**
   * 3–4 field names to show by default in collection output (AXI Principle 2).
   * Chosen from the Entity's most-referenced / most-identifying properties.
   */
  defaultFields: string[];
  entity?: EntityRef;
  /** Whether the output includes a totalCount/count field. */
  hasTotalCount: boolean;
  inference: InferenceMetadata;
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Semantic kind of the operation.
 * This is the compiler's interpretation, not the HTTP method.
 */
export type OperationKind =
  | 'list'
  | 'get'
  | 'create'
  | 'update'
  | 'delete'
  | 'search'
  | 'action'
  | 'export'
  | 'import'
  | 'stream';

/**
 * Safety level of the operation.
 * 'destructive' triggers two-phase confirm in AXI (Principle 6).
 */
export type DangerLevel = 'safe' | 'mutating' | 'destructive';

/**
 * Interaction complexity hint for the AXI backend.
 * Computed from argument count, nesting depth, and type variety.
 * Drives interaction routing: simple→flags, medium→TUI, complex→auto-YAML.
 */
export type OperationComplexity = 'simple' | 'medium' | 'complex';

export interface DeprecationInfo {
  since?: string;
  note?: string;
  sunsetDate?: string;
}

export interface Operation {
  /** Stable identifier — operationId from source spec or synthesized. */
  id: string;
  kind: OperationKind;
  danger: DangerLevel;
  /**
   * Interaction complexity hint for AXI backend routing.
   * undefined = not yet scored (scored by AXI complexity sub-pass).
   */
  complexity?: OperationComplexity;
  /** Human-readable name for the operation (used in CLI command names). */
  name: string;
  description?: string;
  arguments: Argument[];
  output: Output;
  auth: AuthRequirement[];
  deprecated?: DeprecationInfo;
  /**
   * HTTP binding — kept for reference; backends must NOT use this to generate
   * HTTP calls directly (they must go through the SIR operation contract).
   */
  httpBinding: {
    method: string;
    path: string;
    rawPath: string;
    bodyType?: string;
  };
  inference: InferenceMetadata;
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export interface Resource {
  /** Canonical resource name, lowercase plural (e.g. "topics", "decks"). */
  name: string;
  /** Display name (e.g. "Topics", "Deck Information"). */
  displayName: string;
  /** One-line description for no-args CLI output and docs. */
  description: string;
  primaryEntity?: EntityRef;
  operations: Operation[];
  relationships: Relationship[];
  inference: InferenceMetadata;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export type DiagnosticLevel = 'error' | 'warning' | 'info' | 'review';

export interface Diagnostic {
  level: DiagnosticLevel;
  message: string;
  /** The operation id or resource name this applies to, if any. */
  subject?: string;
  /** The SIR field path that needs review (e.g. "resources[0].operations[1].kind"). */
  fieldPath?: string;
  inference?: InferenceMetadata;
}

// ---------------------------------------------------------------------------
// Top-level SIR
// ---------------------------------------------------------------------------

export interface SIR {
  /** SIR schema version — semver, matches SIR_SCHEMA_VERSION. */
  schemaVersion: typeof SIR_SCHEMA_VERSION;
  /** Content hash of the normalized AST — for incremental compilation. */
  sourceHash: string;
  /** Human-readable name of the source API. */
  apiName: string;
  resources: Resource[];
  /**
   * Parse/analysis diagnostics.
   * Includes low-confidence flags, quarantined operations, and review items.
   */
  diagnostics: Diagnostic[];
}
