/**
 * cli/commands/compile.ts
 *
 * Implements the 'asc compile' command.
 * Parses the Postman collection, runs the compiler pipeline,
 * and emits the serialized SIR to the output file.
 */
import * as fs from 'fs';
import * as path from 'path';
import { parsePostmanCollection } from '@asc/frontend-postman';
import { compilePipeline } from '@asc/pipeline';
import { emitSIR } from '../serializer.js';
import type { VariableMap } from '@asc/frontend-postman';

export interface CompileOptions {
  env?: string;
  out: string;
  updateGolden?: boolean;
}

export function runCompile(postmanFile: string, options: CompileOptions): void {
  // 1. Read input collection
  let rawJson: unknown;
  try {
    const content = fs.readFileSync(path.resolve(postmanFile), 'utf8');
    rawJson = JSON.parse(content);
  } catch (err) {
    console.error(`Error reading or parsing input file: ${err}`);
    process.exit(1);
  }

  // 2. Load env vars if provided
  let envMap: VariableMap = {};
  if (options.env) {
    try {
      const content = fs.readFileSync(path.resolve(options.env), 'utf8');
      const rawEnv = JSON.parse(content);
      if (rawEnv.values && Array.isArray(rawEnv.values)) {
        rawEnv.values.forEach((v: any) => {
          if (v.enabled !== false) envMap[v.key] = v.value;
        });
      } else {
        envMap = rawEnv;
      }
    } catch (err) {
      console.warn(`Warning: Could not read env file ${options.env} — proceeding without it`);
    }
  }

  // 3. Frontend parsing (Postman → AST)
  const { ast, diagnostics: parseDiag } = parsePostmanCollection(rawJson, envMap);
  if (parseDiag.some((d) => d.level === 'error')) {
    console.error('Frontend parsing failed with errors:');
    printDiagnostics(parseDiag.filter((d) => d.level === 'error'));
    // We don't exit; partial-failure means we still compile what we can
  }

  // 4. Compiler Pipeline (AST → passes → SIR)
  const { sir, diagnostics: pipelineDiag } = compilePipeline(ast);

  // 5. Serialize and Validate
  const { json, diagnostics: emitDiag } = emitSIR(sir);

  // Combine diagnostics
  const allDiag = [...parseDiag, ...pipelineDiag, ...emitDiag];
  const errors = allDiag.filter((d) => d.level === 'error');
  const warnings = allDiag.filter((d) => d.level === 'warning');

  // Print summary
  console.log(`Compiled API '${sir.apiName}'`);
  console.log(` - Resources: ${sir.resources.length}`);
  console.log(` - Operations: ${sir.resources.reduce((sum, r) => sum + r.operations.length, 0)}`);
  console.log(` - Source hash: ${sir.sourceHash}`);
  
  if (warnings.length > 0) {
    console.warn(`\nWarnings (${warnings.length}):`);
    printDiagnostics(warnings);
  }

  if (errors.length > 0) {
    console.error(`\nErrors (${errors.length}):`);
    printDiagnostics(errors);
    console.error('\nCompilation failed due to errors.');
    process.exit(1);
  }

  // 6. Write output
  try {
    const outPath = path.resolve(options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json, 'utf8');
    console.log(`\nSuccessfully wrote SIR to ${options.out}`);
  } catch (err) {
    console.error(`Error writing output file: ${err}`);
    process.exit(1);
  }
}

function printDiagnostics(diagnostics: { level: string; message: string; subject?: string }[]): void {
  for (const d of diagnostics) {
    const prefix = d.subject ? `[${d.subject}] ` : '';
    console.log(`  - ${prefix}${d.message}`);
  }
}
