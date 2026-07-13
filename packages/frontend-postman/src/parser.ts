/**
 * frontend-postman/parser.ts
 *
 * Main entry point for the Postman frontend.
 * Parses a Postman v2.1 collection JSON into the Unified AST.
 *
 * Contract:
 *  - Never throws on malformed input
 *  - Malformed/unresolvable items → diagnostics[], not a hard failure
 *  - Folder structure → resourceHints[] on ASTEndpoint
 *  - Auth precedence: request > folder > collection (most specific wins)
 *  - Returns { ast: UnifiedAST, diagnostics: ASTDiagnostic[] }
 */

import * as crypto from 'crypto';
import type {
  ASTAuth,
  ASTDiagnostic,
  ASTEndpoint,
  UnifiedAST,
} from '@asc/core-ast';

import type {
  PostmanAuth,
  PostmanCollection,
  PostmanFolderItem,
  PostmanItem,
  PostmanRequestItem,
} from './postman-types.js';

import { isFolder, isRequest } from './postman-types.js';
import { buildVariableMap, type VariableMap } from './variable-resolver.js';
import { normalizeAuth, normalizeRequest } from './normalizer.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ASTParseResult {
  ast: UnifiedAST;
  diagnostics: ASTDiagnostic[];
}

/**
 * Parse a Postman v2.1 collection into the Unified AST.
 *
 * @param rawJson - The raw parsed JSON of the Postman collection
 * @param env - Optional environment variables (key → value) to resolve {{VAR}} placeholders
 */
export function parsePostmanCollection(
  rawJson: unknown,
  env: VariableMap = {},
): ASTParseResult {
  const allDiagnostics: ASTDiagnostic[] = [];
  const endpoints: ASTEndpoint[] = [];

  // ---------------------------------------------------------------------------
  // 1. Validate top-level structure
  // ---------------------------------------------------------------------------
  if (!isPostmanCollection(rawJson)) {
    return {
      ast: emptyAST('Unknown', ''),
      diagnostics: [
        {
          level: 'error',
          message: 'Input is not a valid Postman Collection v2.1 — missing info.name or item array',
        },
      ],
    };
  }

  const collection = rawJson as PostmanCollection;

  // ---------------------------------------------------------------------------
  // 2. Build variable map
  // ---------------------------------------------------------------------------
  const varMap = buildVariableMap(collection.variable, env);

  // ---------------------------------------------------------------------------
  // 3. Extract global auth (collection-level)
  // ---------------------------------------------------------------------------
  const { astAuth: globalAuth, diagnostics: globalAuthDiag } = normalizeAuth(
    collection.auth,
    'collection',
  );
  allDiagnostics.push(...globalAuthDiag);

  // ---------------------------------------------------------------------------
  // 4. Compute source hash (for incremental builds)
  // ---------------------------------------------------------------------------
  const sourceHash = computeHash(JSON.stringify(rawJson));

  // ---------------------------------------------------------------------------
  // 5. Traverse items recursively
  // ---------------------------------------------------------------------------
  traverseItems(
    collection.item,
    [],          // folder path (resource hints)
    globalAuth,  // inherited auth from collection level
    varMap,
    endpoints,
    allDiagnostics,
  );

  // ---------------------------------------------------------------------------
  // 6. Assemble the Unified AST
  // ---------------------------------------------------------------------------
  const ast: UnifiedAST = {
    apiName: collection.info.name,
    baseUrls: [],          // Postman has no global base URL
    globalAuth: globalAuth ?? undefined,
    endpoints,
    sharedSchemas: {},     // Postman has no shared schemas
    diagnostics: allDiagnostics,
    sourceHash,
  };

  return { ast, diagnostics: allDiagnostics };
}

// ---------------------------------------------------------------------------
// Recursive item traversal
// ---------------------------------------------------------------------------

function traverseItems(
  items: PostmanItem[],
  folderPath: string[],
  inheritedAuth: ASTAuth | undefined,
  varMap: VariableMap,
  endpoints: ASTEndpoint[],
  diagnostics: ASTDiagnostic[],
): void {
  for (const item of items) {
    try {
      if (isFolder(item)) {
        handleFolder(item, folderPath, inheritedAuth, varMap, endpoints, diagnostics);
      } else if (isRequest(item)) {
        handleRequest(item, folderPath, inheritedAuth, varMap, endpoints, diagnostics);
      } else {
        diagnostics.push({
          level: 'warning',
          message: `Item '${(item as { name?: string }).name ?? '(unnamed)'}' is neither a folder nor a request — skipping`,
        });
      }
    } catch (err) {
      // Partial-failure tolerance: quarantine this item, continue with the rest
      diagnostics.push({
        level: 'error',
        message: `Unexpected error processing item '${(item as { name?: string }).name ?? '(unnamed)'}': ${String(err)}`,
        source: (item as { name?: string }).name,
      });
    }
  }
}

function handleFolder(
  folder: PostmanFolderItem,
  parentPath: string[],
  inheritedAuth: ASTAuth | undefined,
  varMap: VariableMap,
  endpoints: ASTEndpoint[],
  diagnostics: ASTDiagnostic[],
): void {
  const currentPath = [...parentPath, folder.name];

  // Folder-level auth overrides collection-level auth
  const { astAuth: folderAuth, diagnostics: authDiag } = normalizeAuth(folder.auth, folder.name);
  diagnostics.push(...authDiag);

  const effectiveAuth = folderAuth ?? inheritedAuth;

  traverseItems(folder.item, currentPath, effectiveAuth, varMap, endpoints, diagnostics);
}

function handleRequest(
  item: PostmanRequestItem,
  folderPath: string[],
  inheritedAuth: ASTAuth | undefined,
  varMap: VariableMap,
  endpoints: ASTEndpoint[],
  diagnostics: ASTDiagnostic[],
): void {
  const { endpoint, diagnostics: reqDiag } = normalizeRequest(
    item.name,
    item.request,
    folderPath,
    varMap,
  );
  diagnostics.push(...reqDiag);

  // Request-level auth overrides inherited auth
  if (!endpoint.auth && inheritedAuth) {
    endpoint.auth = inheritedAuth;
  }

  endpoints.push(endpoint);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeHash(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 16);
}

function emptyAST(apiName: string, sourceHash: string): UnifiedAST {
  return {
    apiName,
    baseUrls: [],
    endpoints: [],
    sharedSchemas: {},
    diagnostics: [],
    sourceHash,
  };
}

function isPostmanCollection(raw: unknown): raw is PostmanCollection {
  if (typeof raw !== 'object' || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  const info = obj['info'];
  if (typeof info !== 'object' || info === null) return false;
  const infoObj = info as Record<string, unknown>;
  return typeof infoObj['name'] === 'string' && Array.isArray(obj['item']);
}
