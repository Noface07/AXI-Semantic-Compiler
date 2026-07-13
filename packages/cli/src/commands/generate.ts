/**
 * cli/commands/generate.ts
 *
 * Implements the 'asc generate' command.
 * Dispatches to specific backend generators (e.g. AXI).
 */
import * as fs from 'fs';
import * as path from 'path';
import type { SIR } from '@asc/core-sir';
import { generateAXI } from '@asc/backend-axi';

export interface GenerateOptions {
  out: string;
}

export function runGenerate(target: string, sirFile: string, options: GenerateOptions): void {
  // 1. Read SIR
  let rawSir: SIR;
  try {
    const content = fs.readFileSync(path.resolve(sirFile), 'utf8');
    rawSir = JSON.parse(content) as SIR;
  } catch (err) {
    console.error(`Error reading SIR file: ${err}`);
    process.exit(1);
  }

  // 2. Dispatch to backend
  const outDir = path.resolve(options.out);
  
  if (target === 'axi') {
    try {
      generateAXI(rawSir, { outDir });
      console.log(`Successfully generated AXI backend to ${outDir}`);
      console.log(`To use it:`);
      console.log(`  cd ${outDir}`);
      console.log(`  npm install`);
      console.log(`  npm run build`);
    } catch (err) {
      console.error(`Error generating AXI backend: ${err}`);
      process.exit(1);
    }
  } else {
    console.error(`Unknown backend target: ${target}. Supported targets: axi`);
    process.exit(1);
  }
}
