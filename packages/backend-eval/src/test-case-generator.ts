/**
 * backend-eval/test-case-generator.ts
 *
 * Generates test payloads for operations defined in the SIR.
 */
import type { Operation } from '@asc/core-sir';

export interface TestCase {
  opId: string;
  cliArgs: string[];
  expectedRequest: {
    method: string;
    path: string; // The URL path with interpolated params (e.g. /users/123)
    query?: Record<string, string>;
    body?: any;
  };
}

export function generateTestCases(op: Operation): TestCase {
  const cliArgs: string[] = [];
  const query: Record<string, string> = {};
  const body: any = {};
  
  let interpolatedPath = op.httpBinding.path;

  // For complex operations, we might generate a JSON file to use with --file,
  // but for the eval harness we can just pass flags if they aren't deeply nested objects
  // (which our schema doesn't fully represent deeply nested CLI flags anyway, it relies on --file)
  
  // To avoid complexity, we'll generate simple scalar flags for all required arguments.
  // For file inputs, we assume the AXI fallback --file mechanism handles the rest.
  // Wait, if an operation is complex, the CLI demands a file.
  const isComplex = op.complexity === 'complex';

  for (const arg of op.arguments) {
    if (!arg.required && op.arguments.length > 5) continue; // Keep it brief
    
    // Generate a dummy value
    let val: any;
    if (arg.type === 'string') val = 'test-val-' + arg.name;
    else if (arg.type === 'number' || arg.type === 'integer') val = 42;
    else if (arg.type === 'boolean') val = true;
    else if (arg.type === 'array') val = 'item1,item2'; // The CLI currently doesn't parse arrays nicely without file
    else val = 'test';

    // If it's a boolean flag, Commander uses --flag (no value)
    if (arg.type === 'boolean') {
       cliArgs.push(`--${arg.name}`);
    } else {
       cliArgs.push(`--${arg.name}`, String(val));
    }

    if (arg.source === 'path') {
      interpolatedPath = interpolatedPath.replace(new RegExp(`:${arg.canonicalName}\\b|{${arg.canonicalName}}`, 'g'), String(val));
    } else if (arg.source === 'query') {
      query[arg.canonicalName] = String(val);
    } else if (arg.source === 'body') {
      body[arg.canonicalName] = val;
    }
  }

  // If destructive, add --force
  if (op.danger === 'destructive') {
    cliArgs.push('--force');
  }
  
  // Always add --json to make parsing stdout easier in tests
  cliArgs.push('--json');

  return {
    opId: op.id,
    cliArgs,
    expectedRequest: {
      method: op.httpBinding.method,
      path: interpolatedPath,
      query: Object.keys(query).length > 0 ? query : undefined,
      body: Object.keys(body).length > 0 ? body : undefined,
    }
  };
}
