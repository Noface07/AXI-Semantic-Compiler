/**
 * frontend-postman/variable-resolver.ts
 *
 * Resolves Postman {{variable}} placeholders in strings.
 *
 * Rules:
 *  - Resolution order: supplied env > collection-level variables
 *  - Unresolvable variables are left as {{VAR_NAME}} and a warning diagnostic is added
 *  - localhost:PORT URLs are preserved as-is (no special treatment; they're valid)
 *  - Never throws — all failures become diagnostics
 */

import type { ASTDiagnostic } from '@asc/core-ast';

/** Pattern that matches {{VARIABLE_NAME}} placeholders. */
const VAR_PATTERN = /\{\{([^}]+)\}\}/g;

export type VariableMap = Record<string, string>;

/**
 * Resolve all {{VAR}} placeholders in a string.
 * Returns the resolved string and any warnings for unresolvable vars.
 */
export function resolveVariables(
  input: string,
  env: VariableMap,
  source?: string,
): { resolved: string; diagnostics: ASTDiagnostic[] } {
  const diagnostics: ASTDiagnostic[] = [];
  const unresolved = new Set<string>();

  const resolved = input.replace(VAR_PATTERN, (match, varName: string) => {
    const trimmed = varName.trim();
    if (trimmed in env) {
      return env[trimmed] ?? match;
    }
    unresolved.add(trimmed);
    return match; // leave {{VAR}} as literal
  });

  for (const varName of unresolved) {
    diagnostics.push({
      level: 'warning',
      message: `Could not resolve variable '{{${varName}}}' — not found in environment or collection variables`,
      source,
      path: input,
    });
  }

  return { resolved, diagnostics };
}

/**
 * Build a merged variable map from:
 *  1. Collection-level variables (lowest priority)
 *  2. Supplied environment file (highest priority)
 */
export function buildVariableMap(
  collectionVars: Array<{ key: string; value: string; disabled?: boolean }> | undefined,
  envVars: VariableMap,
): VariableMap {
  const result: VariableMap = {};

  // Collection variables first (lower priority)
  for (const v of collectionVars ?? []) {
    if (!v.disabled && v.key) {
      result[v.key] = v.value;
    }
  }

  // Env vars override collection vars
  for (const [k, v] of Object.entries(envVars)) {
    result[k] = v;
  }

  return result;
}
