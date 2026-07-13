/**
 * backend-axi/generator.ts
 *
 * Generates the AXI CLI from a Semantic Intermediate Representation (SIR).
 */
import * as fs from 'fs';
import * as path from 'path';
import type { SIR, Resource, Operation } from '@asc/core-sir';

export interface GenerateOptions {
  outDir: string;
}

export function generateAXI(sir: SIR, options: GenerateOptions): void {
  const { outDir } = options;
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src', 'commands'), { recursive: true });

  // 1. Generate package.json
  const pkgJson = {
    name: `${sir.apiName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-cli`,
    version: '1.0.0',
    description: `AXI-compliant CLI for ${sir.apiName}`,
    bin: { [sir.apiName.toLowerCase().replace(/[^a-z0-9]/g, '')]: './dist/index.js' },
    type: 'commonjs',
    scripts: {
      build: 'tsc',
    },
    dependencies: {
      commander: '^12.1.0',
      dotenv: '^16.4.5',
      '@inquirer/prompts': '^5.0.0',
      '@toon-format/toon': '^2.3.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
    },
  };
  fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

  // 2. Generate tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'CommonJS',
      moduleResolution: 'node',
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ['src/**/*'],
  };
  fs.writeFileSync(path.join(outDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

  // 3. Generate .gitignore
  const gitignoreContent = `node_modules/
dist/
.env
`;
  fs.writeFileSync(path.join(outDir, '.gitignore'), gitignoreContent);

  // 4. Generate src/utils.ts (includes TOON, auth, interaction logic)
  generateUtils(outDir);

  // 5. Generate commands per resource
  for (const resource of sir.resources) {
    generateResourceCommand(resource, outDir);
  }

  // 5. Generate src/index.ts (main entry point)
  generateIndex(sir, outDir);
}

function generateUtils(outDir: string) {
  const utilsCode = `
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

import { encode } from '@toon-format/toon';

function flattenObject(obj: any, prefix = ''): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return JSON.stringify(obj);

  return Object.entries(obj).reduce((acc: any, [k, v]) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(acc, flattenObject(v, pre + k));
    } else if (Array.isArray(v)) {
      acc[pre + k] = JSON.stringify(v);
    } else {
      acc[pre + k] = v;
    }
    return acc;
  }, {});
}

// TOON formatter wrapper
export function formatToon(data: any): string {
  const normalizeArray = (arr: any[]) => {
    const flattened = arr.map(item => flattenObject(item));
    const allKeys = new Set<string>();
    flattened.forEach((item: any) => Object.keys(item).forEach(k => allKeys.add(k)));
    flattened.forEach((item: any) => {
      allKeys.forEach(k => {
        if (item[k] === undefined) item[k] = null;
      });
    });
    return flattened;
  };

  if (Array.isArray(data)) {
    data = normalizeArray(data);
  } else if (data && typeof data === 'object') {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        data[key] = normalizeArray(data[key]);
      }
    }
  }
  return encode(data);
}

// Two-phase confirm state
export function checkTwoPhaseConfirm(opId: string, force: boolean): void {
  if (force) return; // User explicitly forced it
  
  const tokenFile = path.join(process.cwd(), '.axi-confirm');
  const token = \`\${opId}-\${Date.now()}\`;
  
  if (!fs.existsSync(tokenFile)) {
    fs.writeFileSync(tokenFile, token);
    console.warn(\`[AXI WARNING] This operation is destructive. Run again with --force or within 60s to confirm.\`);
    process.exit(1);
  } else {
    // Check timeout (60s)
    const stat = fs.statSync(tokenFile);
    if (Date.now() - stat.mtimeMs > 60000) {
      fs.writeFileSync(tokenFile, token);
      console.warn(\`[AXI WARNING] Confirmation expired. Run again within 60s to confirm.\`);
      process.exit(1);
    }
    // Confirmed
    fs.unlinkSync(tokenFile);
  }
}

// Ensure Base URL is defined
export async function ensureEnv(): Promise<void> {
  const envPath = require('path').join(process.cwd(), '.env');
  const fs = require('fs');
  require('dotenv').config({ path: envPath });

  if (!process.env.AXI_BASE_URL) {
    const { input } = await import('@inquirer/prompts');
    const baseUrl = await input({ 
      message: 'No AXI_BASE_URL found in .env. What is the base URL for the API?',
      default: 'http://localhost:3000'
    });
    
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    envContent += \`\\nAXI_BASE_URL=\${baseUrl}\\n\`;
    fs.writeFileSync(envPath, envContent.trim() + '\\n');
    process.env.AXI_BASE_URL = baseUrl;
    console.log('[AXI] Saved AXI_BASE_URL to .env');
  }
}

// Medium Complexity Interactive Wizard
export async function runMediumWizard(
  opId: string,
  missingArgs: string[],
  scaffold: any
): Promise<Record<string, string> | 'generate_file'> {
  const { input, password, select } = await import('@inquirer/prompts');

  const choice = await select({
    message: 'Missing required arguments. How would you like to proceed?',
    choices: [
      { name: 'Interactive Prompts', value: 'interactive' },
      { name: 'Generate JSON Template', value: 'generate_file' },
      { name: 'Cancel', value: 'cancel' }
    ]
  });

  if (choice === 'cancel') {
    process.exit(1);
  }
  if (choice === 'generate_file') {
    return 'generate_file';
  }

  const results: Record<string, string> = {};
  for (const arg of missingArgs) {
    if (arg.toLowerCase().includes('password') || arg.toLowerCase().includes('secret') || arg.toLowerCase().includes('token')) {
      results[arg] = await password({ message: \`Enter \${arg}:\` });
    } else {
      results[arg] = await input({ message: \`Enter \${arg}:\` });
    }
  }
  return results;
}

export function handleComplexInteraction(opId: string, scaffold: any): any {
  const tmpFile = path.join(process.cwd(), \`\${opId}-input.json\`);
  fs.writeFileSync(tmpFile, JSON.stringify(scaffold, null, 2));
  console.log(\`Generated temporary input file at \${tmpFile}\`);
  console.log(\`Please edit it and re-run with --file \${tmpFile}\`);
  process.exit(0);
}
`;
  fs.writeFileSync(path.join(outDir, 'src', 'utils.ts'), utilsCode.trim());
}

function buildScaffoldNode(schema: any, defaultTypeDesc: string): any {
  if (!schema) return defaultTypeDesc;
  if (schema.kind === 'object' && schema.properties) {
    const obj: any = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      obj[k] = buildScaffoldNode(v, '<unknown>');
    }
    return obj;
  } else if (schema.kind === 'array' && schema.items) {
    return [buildScaffoldNode(schema.items, '<unknown>')];
  } else if (schema.kind === 'primitive') {
    return `<${schema.type}>`;
  }
  return defaultTypeDesc;
}

function generateResourceCommand(resource: Resource, outDir: string) {
  const safeName = resource.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const code = `
import { Command } from 'commander';
import { formatToon, checkTwoPhaseConfirm, handleComplexInteraction, runMediumWizard, ensureEnv } from '../utils';

export function register${resource.name.replace(/[^a-zA-Z0-9]/g, '')}Command(program: Command) {
  const group = program.command('${safeName}').description(${JSON.stringify(resource.description)});

  ${(function() {
    const usedNames = new Set<string>();
    return resource.operations.map(op => {
      let baseName = op.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      if (!baseName) baseName = 'cmd';
      let cmdName = baseName;
      let counter = 1;
      while (usedNames.has(cmdName)) {
        cmdName = `${baseName}-${counter++}`;
      }
      usedNames.add(cmdName);
      return generateOperationCommand(op, cmdName);
    }).join('\n\n  ');
  })()}
  
  // Principle 8: No args -> live top-level data
  group.action(() => {
    console.log(${JSON.stringify(resource.description)});
    console.log('Run \`<cli> ${safeName} --help\` for available commands.');
  });
}
`;
  fs.writeFileSync(path.join(outDir, 'src', 'commands', `${safeName}.ts`), code.trim());
}

function generateOperationCommand(op: Operation, cmdName: string): string {
  // Map SIR arguments to Commander options
  const optionsCode = op.arguments.map(arg => {
    const flag = arg.type === 'boolean' || arg.role === 'boolean-flag' ? `--${arg.name}` : `--${arg.name} <value>`;
    const req = '.option'; // Removed requiredOption to allow manual validation fallbacks
    return `\n    ${req}('${flag}', 'Argument ${arg.name}')`;
  }).join('');

  const isDestructive = op.danger === 'destructive';
  const destructiveOpt = isDestructive ? `.option('--force', 'Bypass two-phase confirmation')` : '';
  
  const hasFileArg = op.arguments.some(a => a.name === 'file');
  const fileOpt = hasFileArg 
    ? `.option('--axi-file <path>', 'Provide arguments via JSON/YAML file (AXI)')`
    : `.option('--file <path>', 'Provide arguments via JSON/YAML file')`;
    
  const hasJsonArg = op.arguments.some(a => a.name === 'json');
  const jsonOpt = hasJsonArg
    ? `.option('--axi-json', 'Output raw JSON instead of TOON (AXI)')`
    : `.option('--json', 'Output raw JSON instead of TOON')`;

  let actionBody = `
    await ensureEnv();
    
    if (opts.file || opts.axiFile) {
      try {
        const fileContent = require('fs').readFileSync(require('path').resolve(opts.file || opts.axiFile), 'utf-8');
        const parsed = JSON.parse(fileContent);
        Object.assign(opts, parsed);
      } catch (err: any) {
        console.error('Error reading input file: ' + err.message);
        process.exit(1);
      }
    }
`;
  
  if (isDestructive) {
    actionBody += `    checkTwoPhaseConfirm('${op.id}', !!opts.force);\n`;
  }

  const requiredArgs = op.arguments.filter(a => a.required);
  
  // Interaction routing based on complexity
  if (op.complexity === 'complex') {
    const scaffold: any = {};
    op.arguments.forEach(a => {
      const defaultDesc = `<${a.type}>${a.description ? ' - ' + a.description : ''}`;
      scaffold[a.name] = a.astSchema ? buildScaffoldNode(a.astSchema, defaultDesc) : defaultDesc;
    });
    
    actionBody += `
    if (!opts.file && !opts.axiFile) {
      return handleComplexInteraction('${op.id}', ${JSON.stringify(scaffold)});
    }
`;
  } else if (op.complexity === 'medium') {
    const scaffold: any = {};
    op.arguments.forEach(a => {
      const defaultDesc = `<${a.type}>${a.description ? ' - ' + a.description : ''}`;
      scaffold[a.name] = a.astSchema ? buildScaffoldNode(a.astSchema, defaultDesc) : defaultDesc;
    });
    
    actionBody += `
    if (!opts.file && !opts.axiFile) {
      const missingArgs = ${JSON.stringify(requiredArgs.map(a => a.name))}.filter(name => opts[name] === undefined);
      if (missingArgs.length > 0) {
        const wizardResult = await runMediumWizard('${op.id}', missingArgs, ${JSON.stringify(scaffold)});
        if (wizardResult === 'generate_file') {
          return handleComplexInteraction('${op.id}', ${JSON.stringify(scaffold)});
        } else {
          Object.assign(opts, wizardResult);
        }
      }
    }
`;
  } else {
    // Simple validation manually
    actionBody += `
    if (!opts.file && !opts.axiFile) {
      const missingArgs = ${JSON.stringify(requiredArgs.map(a => a.name))}.filter(name => opts[name] === undefined);
      if (missingArgs.length > 0) {
        console.error('error: required option(s) missing: ' + missingArgs.map(a => '--' + a).join(', '));
        process.exit(1);
      }
    }
`;
  }

  // 1. Path interpolation
  actionBody += `
    let url = ${JSON.stringify(op.httpBinding.path)};
`;
  op.arguments.filter(a => a.source === 'path').forEach(a => {
    // If the path was e.g. /users/:id or /users/{id}
    actionBody += `    url = url.replace(/:${a.name}\\b|{${a.name}}/g, encodeURIComponent(String(opts['${a.name}'])));\n`;
  });

  // 2. Query string
  const queryArgs = op.arguments.filter(a => a.source === 'query');
  if (queryArgs.length > 0) {
    actionBody += `    const qs = new URLSearchParams();\n`;
    queryArgs.forEach(a => {
      actionBody += `    if (opts['${a.name}'] !== undefined) qs.append('${a.name}', String(opts['${a.name}']));\n`;
    });
    actionBody += `    if (qs.toString()) url += '?' + qs.toString();\n`;
  }

  // 4. Fetch execution
  actionBody += `
    const baseUrl = process.env.AXI_BASE_URL || 'http://localhost:3000';
    const reqUrl = baseUrl + (url.startsWith('/') ? url : '/' + url);
    const contentType = '${op.httpBinding.bodyType === 'urlencoded' ? 'application/x-www-form-urlencoded' : 'application/json'}';

    const reqOpts: RequestInit = {
      method: '${op.httpBinding.method}',
      headers: {
        'Content-Type': contentType,
        'Accept': 'application/json'
      }
    };
`;

  // 3. Body
  const bodyArgs = op.arguments.filter(a => a.source === 'body');
  if (bodyArgs.length > 0) {
    actionBody += `    const bodyPayload: any = {};\n`;
    bodyArgs.forEach(a => {
      actionBody += `    if (opts['${a.name}'] !== undefined) bodyPayload['${a.name}'] = opts['${a.name}'];\n`;
    });
    
    if (op.httpBinding.bodyType === 'urlencoded') {
      actionBody += `    reqOpts.body = new URLSearchParams(bodyPayload).toString();\n`;
    } else {
      actionBody += `    reqOpts.body = JSON.stringify(bodyPayload);\n`;
    }
  }
  
  if (op.auth && op.auth.length > 0) {
    const authReq = op.auth[0];
    if (authReq) {
      if (authReq.scheme === 'bearer') {
        actionBody += `    if (process.env.AXI_TOKEN) {\n`;
        actionBody += `      (reqOpts.headers as any)['Authorization'] = 'Bearer ' + process.env.AXI_TOKEN;\n`;
        actionBody += `    }\n`;
      } else if (authReq.scheme === 'apikey' && authReq.location === 'header') {
        const keyName = authReq.keyName || 'X-API-Key';
        actionBody += `    if (process.env.AXI_API_KEY) {\n`;
        actionBody += `      (reqOpts.headers as any)['${keyName}'] = process.env.AXI_API_KEY;\n`;
        actionBody += `    }\n`;
      }
    }
  }


  actionBody += `
    try {
      const res = await fetch(reqUrl, reqOpts);
      const data = await res.json().catch(() => null);
      
      if (!res.ok) {
        console.error('Error:', res.status, res.statusText);
        if (data) console.error(JSON.stringify(data, null, 2));
        process.exit(1);
      }
      
      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(formatToon(data));
      }
      
      const opNameLower = '${op.name}'.toLowerCase();
      const opIdLower = '${op.id}'.toLowerCase();
      const tokenVal = data?.token || data?.access_token || data?.accessToken;
      if ((opNameLower.includes('sign-in') || opNameLower.includes('login') || opIdLower.includes('signin') || opIdLower.includes('login')) && tokenVal) {
        const envPath = require('path').join(process.cwd(), '.env');
        let envContent = '';
        try { envContent = require('fs').readFileSync(envPath, 'utf8'); } catch(e) {}
        if (envContent.includes('AXI_TOKEN=')) {
          envContent = envContent.replace(/AXI_TOKEN=.*/, 'AXI_TOKEN=' + tokenVal);
        } else {
          envContent += '\\nAXI_TOKEN=' + tokenVal + '\\n';
        }
        require('fs').writeFileSync(envPath, envContent.trim() + '\\n');
        console.error('\\n[AXI] Automatically saved new AXI_TOKEN to .env');
      }

      process.exit(0);
    } catch (err: any) {
      console.error("Network Error: " + err.message);
      console.error("Attempted URL: " + reqUrl);
      process.exit(1);
    }
`;

  return `
  group.command('${cmdName}')
    .description(${JSON.stringify(op.description || `Execute ${op.name}`)})
    ${optionsCode}
    ${destructiveOpt}
    ${fileOpt}
    ${jsonOpt}
    .action(async (opts) => {
${actionBody}
    });`;
}

function generateIndex(sir: SIR, outDir: string) {
  const imports = sir.resources.map(r => {
    const safeName = r.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const funcName = `register${r.name.replace(/[^a-zA-Z0-9]/g, '')}Command`;
    return `import { ${funcName} } from './commands/${safeName}';`;
  }).join('\n');

  const registers = sir.resources.map(r => {
    const funcName = `register${r.name.replace(/[^a-zA-Z0-9]/g, '')}Command`;
    return `${funcName}(program);`;
  }).join('\n');
  
  const code = `
#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
${imports}

const program = new Command();

program
  .name('${sir.apiName.toLowerCase().replace(/[^a-z0-9]/g, '')}')
  .description('AXI-compliant CLI generated by ASC')
  .version('1.0.0');

${registers}

program.parse(process.argv);
`;
  fs.writeFileSync(path.join(outDir, 'src', 'index.ts'), code.trim());
}
