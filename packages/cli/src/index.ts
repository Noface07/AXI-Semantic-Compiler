#!/usr/bin/env node
/**
 * cli/index.ts
 *
 * Entry point for the 'asc' CLI.
 */
import { Command } from 'commander';
import { runCompile } from './commands/compile.js';
import { runGenerate } from './commands/generate.js';

const program = new Command();

program
  .name('asc')
  .description('API Semantic Compiler')
  .version('0.1.0');

program
  .command('compile')
  .description('Compile a Postman collection into a Semantic Intermediate Representation (SIR)')
  .argument('<file>', 'Postman v2.1 collection JSON file')
  .option('-e, --env <file>', 'Optional JSON file with environment variables to resolve {{VAR}} placeholders')
  .requiredOption('-o, --out <file>', 'Output path for the compiled sir.json')
  .action((file, options) => {
    runCompile(file, options);
  });

program
  .command('generate')
  .description('Generate backend code from a SIR file')
  .argument('<target>', 'Backend target (e.g., "axi")')
  .argument('<sir-file>', 'Compiled sir.json file')
  .requiredOption('-o, --out <dir>', 'Output directory for generated code')
  .action((target, sirFile, options) => {
    runGenerate(target, sirFile, options);
  });

program.parse(process.argv);
