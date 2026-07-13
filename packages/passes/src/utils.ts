/**
 * passes/utils.ts
 *
 * Shared utilities used across passes.
 * All functions are pure — no side effects, no global state.
 */
import type { UnifiedAST, ASTEndpoint } from '@asc/core-ast';
import type { InferenceMetadata, Operation, Resource, SIR } from '@asc/core-sir';

// ---------------------------------------------------------------------------
// Heuristic provenance helper (v1 default)
// ---------------------------------------------------------------------------

export const HEURISTIC: InferenceMetadata = {
  provenance: 'heuristic',
  confidence: 1.0,
};

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a string to a canonical resource name:
 * camelCase or PascalCase → lowercase-kebab → pluralized
 * "GetTopicList" → "topics"
 * "GetUserProfile" → "user-profiles"
 * "AddEditDeckInformation" → "deck-information"
 */
export function toResourceName(raw: string): string {
  // Remove common verb prefixes
  const stripped = raw
    .replace(/^(Get|List|Add|Edit|AddEdit|Update|Delete|Remove|Create|Set|Post|Search|Find|Fetch)/i, '')
    .trim();

  const base = stripped || raw;

  // CamelCase / PascalCase → space-separated
  const spaced = base
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();

  // Remove "list" suffix (e.g. "topic list" → "topics")
  const withoutList = spaced.replace(/\s+list$/i, '');

  // Convert spaces to hyphens
  const kebab = withoutList.replace(/\s+/g, '-');

  // Simple pluralization
  return pluralize(kebab);
}

function pluralize(word: string): string {
  if (!word) return word;
  // Already plural patterns
  if (word.endsWith('s') || word.endsWith('information') || word.endsWith('data') || word.endsWith('history')) {
    return word;
  }
  if (word.endsWith('y') && !word.endsWith('ay') && !word.endsWith('ey')) {
    return word.slice(0, -1) + 'ies';
  }
  if (word.endsWith('x') || word.endsWith('z') || word.endsWith('ch') || word.endsWith('sh')) {
    return word + 'es';
  }
  return word + 's';
}

/**
 * Convert a resource name to a display name.
 * "deck-information" → "Deck Information"
 * "topics" → "Topics"
 */
export function toDisplayName(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Extract the primary "concept" from an endpoint name.
 * "GetTopicList" → "Topic"
 * "GetUserProfile" → "UserProfile"
 * "AddEditDeckInformation" → "DeckInformation"
 */
export function extractConcept(name: string): string {
  const stripped = name
    .replace(/^(Get|List|Add|Edit|AddEdit|Update|Delete|Remove|Create|Set|Post|Search|Find|Fetch)/i, '')
    .replace(/(List|All|ById|ByID|ById)$/i, '')
    .trim();
  return stripped || name;
}

// ---------------------------------------------------------------------------
// Path analysis
// ---------------------------------------------------------------------------

/**
 * Extract path segments from a URL path.
 * "/api/GetTopicList" → ["api", "GetTopicList"]
 */
export function getPathSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/**
 * Check if a path segment looks like an ID placeholder.
 * "{id}", ":id", "{{id}}" → true
 */
export function isIdSegment(segment: string): boolean {
  return /^\{.+\}$/.test(segment) ||
    /^:[a-zA-Z]/i.test(segment) ||
    /^\{\{.+\}\}$/.test(segment);
}

// ---------------------------------------------------------------------------
// SIR mutation helpers (produce new SIR, never mutate in place)
// ---------------------------------------------------------------------------

export function withResources(sir: SIR, resources: Resource[]): SIR {
  return { ...sir, resources };
}

export function withDiagnostic(
  sir: SIR,
  level: 'error' | 'warning' | 'info' | 'review',
  message: string,
  subject?: string,
): SIR {
  return {
    ...sir,
    diagnostics: [...sir.diagnostics, { level, message, subject }],
  };
}

// ---------------------------------------------------------------------------
// Endpoint grouping utilities (used by resource-merge pass)
// ---------------------------------------------------------------------------

/**
 * Compute a grouping key for an endpoint.
 * Strategy: use the folder hint (resourceHints[0]) if present,
 * otherwise fall back to the concept extracted from the endpoint name.
 */
export function computeGroupKey(endpoint: ASTEndpoint): string {
  if (endpoint.resourceHints.length > 0) {
    // Use the innermost folder (most specific)
    return endpoint.resourceHints[endpoint.resourceHints.length - 1] ?? endpoint.resourceHints[0] ?? endpoint.name;
  }
  return extractConcept(endpoint.name);
}

/**
 * Infer operation kind from HTTP method and endpoint name.
 * Schema shape beats naming — this is just a first-pass heuristic.
 * The collection-detection pass may upgrade/downgrade this later.
 */
export function inferOperationKind(
  method: string,
  endpointName: string,
  path: string,
  hasIdParam: boolean,
): 'list' | 'get' | 'create' | 'update' | 'delete' | 'search' | 'action' {
  const name = endpointName.toLowerCase();
  const methodUpper = method.toUpperCase();

  // Explicit delete signals
  if (
    methodUpper === 'DELETE' ||
    /delete|remove|destroy/.test(name) ||
    /delete|remove|destroy/.test(path.toLowerCase())
  ) {
    return 'delete';
  }

  // PUT / PATCH → update
  if (methodUpper === 'PUT' || methodUpper === 'PATCH') {
    return 'update';
  }

  // GET
  if (methodUpper === 'GET') {
    return hasIdParam ? 'get' : 'list';
  }

  // POST — infer from name
  if (/^(get|fetch|list|getall|getlist|getall)/.test(name) || /list$/.test(name)) {
    return hasIdParam ? 'get' : 'list';
  }
  if (/^(search|find|filter|query)/.test(name)) {
    return 'search';
  }
  if (/^(create|add|new|insert|post)/.test(name)) {
    return 'create';
  }
  if (/^(update|edit|addedit|modify|patch|save|set)/.test(name)) {
    return 'update';
  }
  if (/^(delete|remove|destroy|purge|reset)/.test(name)) {
    return 'delete';
  }

  // Default for POST
  return 'action';
}
