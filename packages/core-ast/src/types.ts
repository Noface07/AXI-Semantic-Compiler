/**
 * core-ast/types.ts
 *
 * Unified AST — a format-agnostic, lossless intermediate representation
 * produced by every frontend (Postman, OpenAPI, Swagger) before the
 * Semantic Analyzer runs.
 *
 * Rules:
 *  - No semantics are inferred here. This faithfully represents the *source*.
 *  - All frontends must produce this exact shape — no frontend-specific types
 *    may leak past the frontend boundary.
 *  - $ref cycles are represented explicitly (cyclic: true) rather than
 *    silently flattened.
 *  - allOf merges structurally; oneOf/anyOf become tagged unions (ASTUnion).
 */

// ---------------------------------------------------------------------------
// Primitive building blocks
// ---------------------------------------------------------------------------

/** HTTP methods supported in the AST. */
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | 'TRACE';

/** Where a parameter lives in the HTTP request. */
export type ParameterLocation = 'path' | 'query' | 'header' | 'body' | 'cookie';

/** Body encoding formats. */
export type BodyMode = 'json' | 'urlencoded' | 'formdata' | 'raw' | 'binary' | 'graphql' | 'none';

// ---------------------------------------------------------------------------
// Schema (type system)
// ---------------------------------------------------------------------------

/**
 * A resolved schema node. Cycles are broken with ASTSchemaRef { cyclic: true }.
 * allOf is merged (ASTSchemaObject with mergedFrom populated).
 * oneOf/anyOf become ASTUnion.
 */
export type ASTSchema =
  | ASTSchemaPrimitive
  | ASTSchemaObject
  | ASTSchemaArray
  | ASTSchemaUnion
  | ASTSchemaRef;

export interface ASTSchemaPrimitive {
  kind: 'primitive';
  type: 'string' | 'number' | 'integer' | 'boolean' | 'null';
  format?: string;          // e.g. "date-time", "email", "uuid"
  enum?: (string | number | boolean | null)[];
  description?: string;
  example?: unknown;
  nullable?: boolean;
}

export interface ASTSchemaObject {
  kind: 'object';
  properties: Record<string, ASTSchema>;
  required: string[];
  additionalProperties?: boolean | ASTSchema;
  description?: string;
  example?: unknown;
  nullable?: boolean;
  /** Populated when this object was produced by merging allOf sources. */
  mergedFrom?: string[];
}

export interface ASTSchemaArray {
  kind: 'array';
  items: ASTSchema;
  description?: string;
  example?: unknown;
  nullable?: boolean;
}

/**
 * oneOf / anyOf composition — becomes a tagged union in the AST.
 * The compiler preserves which keyword produced the union.
 */
export interface ASTSchemaUnion {
  kind: 'union';
  unionKind: 'oneOf' | 'anyOf';
  variants: ASTSchema[];
  description?: string;
  nullable?: boolean;
}

/**
 * An unresolved or cyclically-referencing $ref.
 * cyclic: true means the ref was detected as part of a cycle and was
 * intentionally left unresolved to avoid infinite recursion.
 */
export interface ASTSchemaRef {
  kind: 'ref';
  ref: string;    // the original $ref string, e.g. "#/components/schemas/Topic"
  cyclic: boolean;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type ASTAuthType = 'bearer' | 'apikey' | 'oauth2' | 'basic' | 'noauth' | 'unknown';

export interface ASTAuth {
  type: ASTAuthType;
  /** Raw auth parameters (token, key name, location, etc.) — frontend-extracted. */
  params: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Request & Response
// ---------------------------------------------------------------------------

export interface ASTParameter {
  name: string;
  location: ParameterLocation;
  required: boolean;
  schema?: ASTSchema;
  description?: string;
  example?: unknown;
}

export interface ASTRequestBody {
  mode: BodyMode;
  schema?: ASTSchema;
  /** Raw body string (for modes that don't parse to a schema, e.g. raw/binary). */
  rawBody?: string;
  required: boolean;
}

export interface ASTResponse {
  statusCode: number | 'default';
  description?: string;
  schema?: ASTSchema;
  headers?: Record<string, ASTSchema>;
  examples?: ASTExample[];
}

export interface ASTExample {
  name?: string;
  contentType?: string;
  value: unknown;
}

// ---------------------------------------------------------------------------
// Endpoint
// ---------------------------------------------------------------------------

export interface ASTEndpoint {
  /** Stable identifier — operationId if present, otherwise synthesized from method+path. */
  id: string;
  /** Human-readable name from the source spec (Postman request name, operationId, summary). */
  name: string;
  method: HttpMethod;
  /** Fully resolved path (variables substituted where possible). */
  path: string;
  /** Original raw path before variable substitution. */
  rawPath: string;
  auth?: ASTAuth;
  parameters: ASTParameter[];
  requestBody?: ASTRequestBody;
  responses: ASTResponse[];
  summary?: string;
  description?: string;
  tags: string[];
  deprecated: boolean;
  /**
   * Folder/group path from the source format (e.g. Postman folder hierarchy).
   * Used as a resource-grouping hint by the Semantic Analyzer.
   * e.g. ["Authentication & User Management"] or ["Topics", "Search"]
   */
  resourceHints: string[];
  examples: ASTExample[];
  /**
   * Vendor extensions (x-* fields) extracted from the source spec.
   * asc-specific extensions like x-asc-id live here.
   */
  extensions: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export type DiagnosticLevel = 'error' | 'warning' | 'info';

export interface ASTDiagnostic {
  level: DiagnosticLevel;
  /** Human-readable description of the problem. */
  message: string;
  /** Source location — file path, folder name, or endpoint id. */
  source?: string;
  /** The specific field or path that caused the diagnostic. */
  path?: string;
}

// ---------------------------------------------------------------------------
// Top-level AST
// ---------------------------------------------------------------------------

export interface UnifiedAST {
  /** Name of the API / collection (from source spec). */
  apiName: string;
  /** Base URL(s) if resolvable; may be empty if fully variable. */
  baseUrls: string[];
  /** Global auth if declared at collection/spec level. */
  globalAuth?: ASTAuth;
  endpoints: ASTEndpoint[];
  /**
   * Shared schema definitions (from OpenAPI #/components/schemas, etc.).
   * Postman has no shared schemas — this will be empty for Postman collections.
   */
  sharedSchemas: Record<string, ASTSchema>;
  /**
   * Parse diagnostics produced by the frontend.
   * Malformed endpoints are quarantined here, not thrown.
   */
  diagnostics: ASTDiagnostic[];
  /** Content hash of the normalized source input — used for incremental builds. */
  sourceHash: string;
}
