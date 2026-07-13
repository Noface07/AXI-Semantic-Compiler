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
  const token = `${opId}-${Date.now()}`;
  
  if (!fs.existsSync(tokenFile)) {
    fs.writeFileSync(tokenFile, token);
    console.warn(`[AXI WARNING] This operation is destructive. Run again with --force or within 60s to confirm.`);
    process.exit(1);
  } else {
    // Check timeout (60s)
    const stat = fs.statSync(tokenFile);
    if (Date.now() - stat.mtimeMs > 60000) {
      fs.writeFileSync(tokenFile, token);
      console.warn(`[AXI WARNING] Confirmation expired. Run again within 60s to confirm.`);
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
    
    envContent += `\nAXI_BASE_URL=${baseUrl}\n`;
    fs.writeFileSync(envPath, envContent.trim() + '\n');
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
      results[arg] = await password({ message: `Enter ${arg}:` });
    } else {
      results[arg] = await input({ message: `Enter ${arg}:` });
    }
  }
  return results;
}

export function handleComplexInteraction(opId: string, scaffold: any): any {
  const tmpFile = path.join(process.cwd(), `${opId}-input.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(scaffold, null, 2));
  console.log(`Generated temporary input file at ${tmpFile}`);
  console.log(`Please edit it and re-run with --file ${tmpFile}`);
  process.exit(0);
}