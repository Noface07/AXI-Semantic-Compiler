/**
 * Pass 1: resource-merge.ts
 *
 * Groups AST endpoints into SIR Resources and assigns initial Operation kinds.
 *
 * Rules (from §6 Stage 4):
 *  - Schema shape beats naming: POST /SearchTopics with single id body field → 'get', not 'search'
 *  - Grouping: shared folder hint (resourceHints) → same resource
 *  - If no folder hints: group by extracted concept from endpoint name
 *  - Must run FIRST — all other passes operate per-resource
 */
import type { UnifiedAST, ASTEndpoint, ASTSchema } from '@asc/core-ast';
import type {
  SIR, Resource, Operation, Argument, Output, AuthRequirement, EntityRef, EntityProperty,
} from '@asc/core-sir';
import type { PassConfig } from './types.js';
import {
  HEURISTIC,
  toResourceName,
  toDisplayName,
  extractConcept,
  computeGroupKey,
  inferOperationKind,
  isIdSegment,
  getPathSegments,
} from './utils.js';

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Resource-merge pass.
 * Takes a SIR with no resources (produced from an initial bootstrap of the AST)
 * and populates SIR.resources[] by grouping AST endpoints.
 *
 * Note: This pass receives a SIR that has already been bootstrapped from the AST
 * (the pipeline does the AST→SIR bootstrap before running passes).
 * The ast is passed separately because the SIR alone doesn't carry all AST data yet.
 */
export function resourceMergePass(ast: UnifiedAST, _sir: SIR, config: PassConfig): SIR {
  // Group endpoints by their folder/concept key
  const groups = new Map<string, ASTEndpoint[]>();

  for (const endpoint of ast.endpoints) {
    const key = computeGroupKey(endpoint);
    const existing = groups.get(key);
    if (existing) {
      existing.push(endpoint);
    } else {
      groups.set(key, [endpoint]);
    }
  }

  // Convert each group into a Resource
  const resources: Resource[] = [];

  for (const [groupKey, endpoints] of groups) {
    const resource = buildResource(groupKey, endpoints);
    resources.push(resource);
  }

  // Sort resources deterministically by name
  resources.sort((a, b) => a.name.localeCompare(b.name));

  return {
    ..._sir,
    resources,
  };
}

// ---------------------------------------------------------------------------
// Resource builder
// ---------------------------------------------------------------------------

function buildResource(groupKey: string, endpoints: ASTEndpoint[]): Resource {
  const resourceName = toResourceName(groupKey);
  const displayName = toDisplayName(resourceName);

  // Try to derive a description from the folder name or first endpoint summary
  const description =
    endpoints[0]?.description ??
    `Operations on ${displayName}`;

  const operations: Operation[] = endpoints.map((ep) => buildOperation(ep));

  // Sort operations deterministically
  operations.sort((a, b) => a.id.localeCompare(b.id));

  return {
    name: resourceName,
    displayName,
    description,
    operations,
    relationships: [],
    inference: HEURISTIC,
  };
}

// ---------------------------------------------------------------------------
// Operation builder
// ---------------------------------------------------------------------------

function buildOperation(endpoint: ASTEndpoint): Operation {
  const pathSegments = getPathSegments(endpoint.rawPath);
  const hasIdParam =
    endpoint.parameters.some((p) => p.location === 'path') ||
    pathSegments.some(isIdSegment);

  // Schema-shape-beats-naming: check body for single required id field
  const schemaOverridesKind = detectSchemaOverride(endpoint);

  const kind = schemaOverridesKind ?? inferOperationKind(
    endpoint.method,
    endpoint.name,
    endpoint.rawPath,
    hasIdParam,
  );

  // Build arguments from parameters + body fields
  const args = buildArguments(endpoint);

  // Build output
  const output = buildOutput(endpoint);

  // Build auth requirements
  const auth = buildAuth(endpoint);

  // Operation name: camelCase from endpoint name, stripping verb prefixes
  const opName = toOperationCommandName(endpoint.name);

  return {
    id: endpoint.id,
    kind,
    danger: 'safe', // Dangerous-command pass will override this
    name: opName,
    description: endpoint.description,
    arguments: args,
    output,
    auth,
    httpBinding: {
      method: endpoint.method,
      path: endpoint.path,
      rawPath: endpoint.rawPath,
      bodyType: endpoint.requestBody?.mode,
    },
    inference: HEURISTIC,
  };
}

// ---------------------------------------------------------------------------
// Schema-shape override
// ---------------------------------------------------------------------------

/**
 * Determines if the body schema overrides the name-based kind inference.
 * Rule from §4: "naming loses when it disagrees with schema shape"
 *
 * If the name suggests 'search' but the body has exactly one required field
 * that looks like an identifier AND the response is singular → classify as 'get'.
 */
function detectSchemaOverride(
  endpoint: ASTEndpoint,
): 'get' | 'list' | null {
  const bodySchema = endpoint.requestBody?.schema;
  if (!bodySchema) return null;

  if (bodySchema.kind === 'object') {
    const requiredFields = bodySchema.required ?? [];
    const allFields = Object.keys(bodySchema.properties ?? {});

    // Single required field with an id-like name → likely a 'get' masquerading as 'search'
    if (
      requiredFields.length === 1 &&
      allFields.length <= 2 &&
      isIdLikeName(requiredFields[0] ?? '')
    ) {
      return 'get';
    }
  }

  return null;
}

function isIdLikeName(name: string): boolean {
  return /^(id|key|code|uid|uuid|guid|token|reference|ref|no)$/i.test(name);
}

// ---------------------------------------------------------------------------
// Argument builder
// ---------------------------------------------------------------------------

function buildArguments(endpoint: ASTEndpoint): Argument[] {
  const args: Argument[] = [];

  // Path + query parameters
  for (const param of endpoint.parameters) {
    args.push({
      name: param.name,
      canonicalName: param.name,
      type: mapSchemaType(param.schema),
      required: param.required,
      source: param.location === 'cookie' ? 'query' : param.location,
      role: 'none',
      description: param.description,
      astSchema: param.schema,
      inference: HEURISTIC,
    });
  }

  // Body fields (only for object schemas — flatten top-level fields into arguments)
  if (endpoint.requestBody?.schema?.kind === 'object') {
    const schema = endpoint.requestBody.schema;
    const required = new Set(schema.required);

    for (const [fieldName, fieldSchema] of Object.entries(schema.properties ?? {})) {
      // Skip if we already have a param with this name
      if (args.some((a) => a.name === fieldName)) continue;

      args.push({
        name: fieldName,
        canonicalName: fieldName,
        type: mapSchemaType(fieldSchema),
        required: required.has(fieldName),
        source: 'body',
        role: 'none',
        astSchema: fieldSchema,
        inference: HEURISTIC,
      });
    }
  }

  // Sort deterministically: required first, then alphabetically
  args.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return args;
}

function mapSchemaType(
  schema: ASTSchema | undefined,
): Argument['type'] {
  if (!schema) return 'unknown';
  switch (schema.kind) {
    case 'primitive':
      if (schema.type === 'string') return schema.format === 'binary' ? 'file' : 'string';
      if (schema.type === 'number') return 'number';
      if (schema.type === 'integer') return 'integer';
      if (schema.type === 'boolean') return 'boolean';
      return 'string';
    case 'array': return 'array';
    case 'object': return 'object';
    default: return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Output builder
// ---------------------------------------------------------------------------

function buildOutput(endpoint: ASTEndpoint): Output {
  // Check response schema for collection shape
  const firstResponse = endpoint.responses[0];
  const responseSchema = firstResponse?.schema;

  let shape: Output['shape'] = 'single';
  let renderHint: Output['renderHint'] = 'detail';

  if (responseSchema?.kind === 'array') {
    shape = 'collection';
    renderHint = 'toon';
  } else if (!responseSchema) {
    // No response info — infer from operation name
    const name = endpoint.name.toLowerCase();
    if (/list|all|search|filter|query|find/.test(name)) {
      shape = 'collection';
      renderHint = 'toon';
    }
  }

  // Try to extract entity ref from response schema
  const entity = tryExtractEntity(responseSchema);

  return {
    shape,
    renderHint,
    defaultFields: entity ? entity.properties.slice(0, 4).map((p) => p.name) : [],
    entity: entity ?? undefined,
    hasTotalCount: false, // Pagination pass will set this
    inference: HEURISTIC,
  };
}

function tryExtractEntity(schema: ASTSchema | undefined): EntityRef | null {
  if (!schema) return null;

  if (schema.kind === 'object') {
    const properties: EntityProperty[] = Object.entries(schema.properties ?? {}).map(
      ([name, propSchema]) => ({
        name,
        type: schemaToEntityType(propSchema),
        required: (schema.required ?? []).includes(name),
        nullable: false,
        isIdentifier: isIdLikeName(name),
        isStatusField: /status|state|type|kind|category/.test(name.toLowerCase()),
      }),
    );
    return { name: 'Entity', properties };
  }

  if (schema.kind === 'array' && schema.items.kind === 'object') {
    const itemSchema = schema.items;
    const properties: EntityProperty[] = Object.entries(itemSchema.properties ?? {}).map(
      ([name, propSchema]) => ({
        name,
        type: schemaToEntityType(propSchema),
        required: (itemSchema.required ?? []).includes(name),
        nullable: false,
        isIdentifier: isIdLikeName(name),
        isStatusField: /status|state|type|kind|category/.test(name.toLowerCase()),
      }),
    );
    return { name: 'Entity', properties };
  }

  return null;
}

function schemaToEntityType(schema: ASTSchema): EntityProperty['type'] {
  switch (schema.kind) {
    case 'primitive':
      if (schema.type === 'integer') return 'integer';
      if (schema.type === 'number') return 'number';
      if (schema.type === 'boolean') return 'boolean';
      if (schema.type === 'null') return 'null';
      return 'string';
    case 'array': return 'array';
    case 'object': return 'object';
    default: return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Auth builder
// ---------------------------------------------------------------------------

function buildAuth(endpoint: ASTEndpoint): AuthRequirement[] {
  if (!endpoint.auth) return [];

  const { type } = endpoint.auth;
  switch (type) {
    case 'bearer':
      return [{ scheme: 'bearer' }];
    case 'apikey':
      return [{ scheme: 'apikey', location: 'header', keyName: 'X-API-Key' }];
    case 'basic':
      return [{ scheme: 'basic' }];
    case 'oauth2':
      return [{ scheme: 'oauth2' }];
    case 'noauth':
      return [{ scheme: 'none' }];
    default:
      return [{ scheme: 'unknown' }];
  }
}

// ---------------------------------------------------------------------------
// Command name
// ---------------------------------------------------------------------------

function toOperationCommandName(endpointName: string): string {
  const concept = extractConcept(endpointName);
  return concept
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase();
}
