/**
 * frontend-postman/normalizer.ts
 *
 * Converts Postman-specific shapes into the Unified AST types from @asc/core-ast.
 *
 * This is a pure transformation layer — no semantics inferred here.
 * All decisions about "what does this endpoint mean" happen in the passes.
 */

import type {
  ASTAuth,
  ASTAuthType,
  ASTDiagnostic,
  ASTEndpoint,
  ASTExample,
  ASTParameter,
  ASTRequestBody,
  ASTResponse,
  ASTSchema,
  ASTSchemaPrimitive,
  ASTSchemaObject,
  BodyMode,
  HttpMethod,
} from '@asc/core-ast';

import type {
  PostmanAuth,
  PostmanBody,
  PostmanHeader,
  PostmanRequest,
  PostmanResponse,
  PostmanUrl,
} from './postman-types.js';

import { resolveVariables, type VariableMap } from './variable-resolver.js';

// ---------------------------------------------------------------------------
// Auth normalization
// ---------------------------------------------------------------------------

export function normalizeAuth(
  auth: PostmanAuth | undefined,
  source?: string,
): { astAuth: ASTAuth | undefined; diagnostics: ASTDiagnostic[] } {
  if (!auth) return { astAuth: undefined, diagnostics: [] };

  const type = auth.type as ASTAuthType;
  const params: Record<string, string> = {};

  // Extract auth parameters by type
  const paramList =
    auth.bearer ?? auth.apikey ?? auth.oauth2 ?? auth.basic ?? [];
  for (const p of paramList) {
    params[p.key] = p.value;
  }

  const knownTypes: ASTAuthType[] = ['bearer', 'apikey', 'oauth2', 'basic', 'noauth'];
  const resolvedType: ASTAuthType = knownTypes.includes(type as ASTAuthType)
    ? (type as ASTAuthType)
    : 'unknown';

  return {
    astAuth: { type: resolvedType, params },
    diagnostics:
      resolvedType === 'unknown'
        ? [{ level: 'warning', message: `Unknown auth type '${auth.type}'`, source }]
        : [],
  };
}

// ---------------------------------------------------------------------------
// URL normalization
// ---------------------------------------------------------------------------

export function normalizePath(
  url: PostmanUrl | string | undefined,
  varMap: VariableMap,
  source?: string,
): { path: string; rawPath: string; diagnostics: ASTDiagnostic[] } {
  const allDiagnostics: ASTDiagnostic[] = [];

  if (!url) {
    return { path: '/', rawPath: '/', diagnostics: [] };
  }

  if (typeof url === 'string') {
    const { resolved, diagnostics } = resolveVariables(url, varMap, source);
    allDiagnostics.push(...diagnostics);
    return { path: resolved, rawPath: url, diagnostics: allDiagnostics };
  }

  // Always resolve the full raw URL for variable warnings ({{URL}} lives in the host)
  const { diagnostics: rawDiag } = resolveVariables(url.raw, varMap, source);
  allDiagnostics.push(...rawDiag);

  // Build path from parts if available
  let rawPath = '';
  if (url.path) {
    const parts = Array.isArray(url.path) ? url.path : [url.path];
    rawPath = '/' + parts.join('/');
  } else {
    // Strip protocol/host from raw URL to get just the path
    rawPath = url.raw;
    try {
      const parsed = new URL(url.raw.replace(/\{\{[^}]+\}\}/g, 'PLACEHOLDER'));
      rawPath = parsed.pathname;
    } catch {
      rawPath = url.raw.replace(/^https?:\/\/[^/]+/, '');
    }
  }

  // Resolve variables in the path segment itself (path vars like /{id})
  const { resolved, diagnostics: pathDiag } = resolveVariables(rawPath, varMap, source);
  // Don't double-add diagnostics for variables already caught in the raw URL check
  const newPathDiag = pathDiag.filter(
    (d) => !allDiagnostics.some((existing) => existing.message === d.message),
  );
  allDiagnostics.push(...newPathDiag);

  return { path: resolved, rawPath, diagnostics: allDiagnostics };
}

// ---------------------------------------------------------------------------
// Body normalization
// ---------------------------------------------------------------------------

/**
 * Best-effort schema extraction from a Postman body.
 * For raw JSON bodies, we parse and infer an object schema.
 * For urlencoded/formdata, we produce a flat object schema from fields.
 */
function inferSchemaFromBody(
  body: PostmanBody,
  source?: string,
): { schema: ASTSchema | undefined; diagnostics: ASTDiagnostic[] } {
  const diagnostics: ASTDiagnostic[] = [];

  if (body.mode === 'raw' && body.raw) {
    try {
      const parsed: unknown = JSON.parse(body.raw);
      return { schema: inferSchemaFromValue(parsed), diagnostics };
    } catch {
      // Not valid JSON — return raw body, no schema
      return { schema: undefined, diagnostics };
    }
  }

  if (body.mode === 'urlencoded' && body.urlencoded) {
    const properties: Record<string, ASTSchema> = {};
    const required: string[] = [];
    for (const field of body.urlencoded) {
      if (field.disabled) continue;
      properties[field.key] = { kind: 'primitive', type: 'string' };
      // All urlencoded fields treated as required (no optional signal in Postman)
      required.push(field.key);
    }
    return {
      schema: { kind: 'object', properties, required },
      diagnostics,
    };
  }

  if (body.mode === 'formdata' && body.formdata) {
    const properties: Record<string, ASTSchema> = {};
    const required: string[] = [];
    for (const field of body.formdata) {
      if (field.disabled) continue;
      const fieldSchema: ASTSchema =
        field.type === 'file'
          ? { kind: 'primitive', type: 'string', format: 'binary' }
          : { kind: 'primitive', type: 'string' };
      properties[field.key] = fieldSchema;
      required.push(field.key);
    }
    return {
      schema: { kind: 'object', properties, required },
      diagnostics,
    };
  }

  diagnostics.push({
    level: 'info',
    message: `Body mode '${body.mode}' has no schema extraction support — stored as raw`,
    source,
  });
  return { schema: undefined, diagnostics };
}

/**
 * Infer a best-effort ASTSchema from a parsed JSON value.
 * This is intentionally shallow — deep nested objects become 'object' without
 * recursing into all properties (keeps the AST from exploding for large bodies).
 */
function inferSchemaFromValue(value: unknown, depth = 0): ASTSchema {
  if (value === null) return { kind: 'primitive', type: 'null' };
  if (typeof value === 'boolean') return { kind: 'primitive', type: 'boolean' };
  if (typeof value === 'number') {
    return {
      kind: 'primitive',
      type: Number.isInteger(value) ? 'integer' : 'number',
    };
  }
  if (typeof value === 'string') return { kind: 'primitive', type: 'string' };
  if (Array.isArray(value)) {
    const itemSchema =
      value.length > 0 && depth < 3
        ? inferSchemaFromValue(value[0], depth + 1)
        : ({ kind: 'primitive', type: 'string' } as ASTSchemaPrimitive);
    return { kind: 'array', items: itemSchema };
  }
  if (typeof value === 'object' && depth < 3) {
    const properties: Record<string, ASTSchema> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      properties[k] = inferSchemaFromValue(v, depth + 1);
      if (v !== null && v !== undefined) required.push(k);
    }
    return { kind: 'object', properties, required } as ASTSchemaObject;
  }
  // Too deep or unknown shape
  return { kind: 'primitive', type: 'string' };
}

export function normalizeBody(
  body: PostmanBody | undefined,
  varMap: VariableMap,
  source?: string,
): { requestBody: ASTRequestBody | undefined; diagnostics: ASTDiagnostic[] } {
  if (!body || body.mode === 'none') return { requestBody: undefined, diagnostics: [] };

  const modeMap: Record<string, BodyMode> = {
    raw: 'json',
    urlencoded: 'urlencoded',
    formdata: 'formdata',
    file: 'binary',
    graphql: 'graphql',
    none: 'none',
  };

  // Refine 'raw' mode by content type hint
  let mode: BodyMode = modeMap[body.mode] ?? 'raw';
  if (body.mode === 'raw' && body.options?.raw?.language) {
    const lang = body.options.raw.language.toLowerCase();
    if (lang === 'json') mode = 'json';
    else if (lang === 'xml') mode = 'raw';
  }

  // Resolve variable in raw body string (informational only)
  const rawBody = body.raw
    ? resolveVariables(body.raw, varMap, source).resolved
    : undefined;

  const { schema, diagnostics } = inferSchemaFromBody(body, source);

  return {
    requestBody: {
      mode,
      schema,
      rawBody,
      required: true,
    },
    diagnostics,
  };
}

// ---------------------------------------------------------------------------
// Parameters (query string)
// ---------------------------------------------------------------------------

export function normalizeQueryParams(
  url: PostmanUrl | string | undefined,
  varMap: VariableMap,
  source?: string,
): { parameters: ASTParameter[]; diagnostics: ASTDiagnostic[] } {
  if (!url || typeof url === 'string') return { parameters: [], diagnostics: [] };

  const parameters: ASTParameter[] = [];
  const diagnostics: ASTDiagnostic[] = [];

  for (const q of url.query ?? []) {
    if (q.disabled) continue;
    const { resolved: value } = resolveVariables(q.value, varMap, source);
    parameters.push({
      name: q.key,
      location: 'query',
      required: false, // query params are optional by default in Postman
      schema: { kind: 'primitive', type: 'string' },
      description: q.description,
      example: value !== q.value ? undefined : value,
    });
  }

  // Path variables from URL template
  for (const v of url.variable ?? []) {
    parameters.push({
      name: v.key,
      location: 'path',
      required: true,
      schema: { kind: 'primitive', type: 'string' },
      description: v.description,
    });
  }

  return { parameters, diagnostics };
}

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

export function normalizeHeaders(
  headers: PostmanHeader[] | string | undefined,
  _source?: string,
): ASTParameter[] {
  if (!headers) return [];
  if (typeof headers === 'string') return [];

  return headers
    .filter((h) => !h.disabled && h.key.toLowerCase() !== 'content-type') // Content-Type captured via body.mode
    .map((h) => ({
      name: h.key,
      location: 'header' as const,
      required: false,
      schema: { kind: 'primitive', type: 'string' } as ASTSchemaPrimitive,
      description: h.description,
      example: h.value,
    }));
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export function normalizeResponses(
  responses: PostmanResponse[] | undefined,
  _source?: string,
): ASTResponse[] {
  if (!responses || responses.length === 0) return [];

  return responses.map((r) => {
    const statusCode = r.code ?? 200;
    let schema: ASTSchema | undefined;
    const examples: ASTExample[] = [];

    if (r.body) {
      try {
        const parsed: unknown = JSON.parse(r.body);
        schema = inferSchemaFromValue(parsed);
        examples.push({ name: r.name, contentType: 'application/json', value: parsed });
      } catch {
        // Non-JSON body — skip schema extraction
      }
    }

    return {
      statusCode,
      description: r.status,
      schema,
      examples,
    };
  });
}

// ---------------------------------------------------------------------------
// ID synthesis
// ---------------------------------------------------------------------------

/**
 * Synthesize a stable endpoint ID.
 * Uses the Postman request name as the primary identifier (acts as operationId).
 * Falls back to method+path if name is empty.
 */
export function synthesizeId(name: string, method: string, path: string): string {
  if (name && name.trim().length > 0) {
    // Sanitize: remove special chars, camelCase the name
    return name
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+(.)/g, (_, c: string) => c.toUpperCase())
      .replace(/^\s/, '')
      .replace(/^(.)/, (_, c: string) => c.toLowerCase());
  }
  // Fallback: method + sanitized path
  const sanitizedPath = path.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+/, '');
  return `${method.toLowerCase()}_${sanitizedPath}`;
}

// ---------------------------------------------------------------------------
// Method normalization
// ---------------------------------------------------------------------------

const VALID_METHODS: HttpMethod[] = [
  'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE',
];

export function normalizeMethod(method: string | undefined): {
  method: HttpMethod;
  diagnostics: ASTDiagnostic[];
} {
  const upper = (method ?? 'POST').toUpperCase() as HttpMethod;
  if (VALID_METHODS.includes(upper)) return { method: upper, diagnostics: [] };
  return {
    method: 'POST',
    diagnostics: [
      {
        level: 'warning',
        message: `Unknown HTTP method '${method}' — defaulting to POST`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Request normalization (ties it all together)
// ---------------------------------------------------------------------------

export interface NormalizedRequest {
  endpoint: ASTEndpoint;
  diagnostics: ASTDiagnostic[];
}

export function normalizeRequest(
  name: string,
  request: PostmanRequest,
  resourceHints: string[],
  varMap: VariableMap,
): NormalizedRequest {
  const allDiagnostics: ASTDiagnostic[] = [];

  // Method
  const { method, diagnostics: methodDiag } = normalizeMethod(request.method);
  allDiagnostics.push(...methodDiag);

  // Path
  const { path, rawPath, diagnostics: pathDiag } = normalizePath(request.url, varMap, name);
  allDiagnostics.push(...pathDiag);

  // Endpoint ID
  const id = synthesizeId(name, method, rawPath);

  // Auth — request-level wins over folder/collection (handled upstream)
  const { astAuth: auth, diagnostics: authDiag } = normalizeAuth(request.auth, name);
  allDiagnostics.push(...authDiag);

  // Parameters
  const { parameters: queryParams, diagnostics: queryDiag } = normalizeQueryParams(
    request.url,
    varMap,
    name,
  );
  allDiagnostics.push(...queryDiag);

  const headerParams = normalizeHeaders(request.header, name);
  const parameters = [...queryParams, ...headerParams];

  // Body
  const { requestBody, diagnostics: bodyDiag } = normalizeBody(request.body, varMap, name);
  allDiagnostics.push(...bodyDiag);

  // Responses (none in TDSPL collection — but we handle them correctly)
  const responses = normalizeResponses([], name);

  const endpoint: ASTEndpoint = {
    id,
    name,
    method,
    path,
    rawPath,
    auth: auth ?? undefined,
    parameters,
    requestBody: requestBody ?? undefined,
    responses,
    description: typeof request.description === 'string' ? request.description : undefined,
    tags: [],
    deprecated: false,
    resourceHints,
    examples: [],
    extensions: {},
  };

  return { endpoint, diagnostics: allDiagnostics };
}
