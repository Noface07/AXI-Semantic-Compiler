import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// TOON formatter
export function formatToon(data: any): string {
  if (data == null) return '';
  if (Array.isArray(data)) {
    if (data.length === 0) return '(empty)';
    if (typeof data[0] !== 'object') return data.join(', ');
    const keys = Array.from(new Set(data.flatMap(Object.keys)));
    const widths = new Map(keys.map(k => [k, k.length]));
    data.forEach(row => keys.forEach(k => widths.set(k, Math.max(widths.get(k)!, String(row[k] || '').length))));
    let out = keys.map(k => k.padEnd(widths.get(k)!)).join('  ') + '\n';
    data.forEach(row => {
      out += keys.map(k => String(row[k] || '').padEnd(widths.get(k)!)).join('  ') + '\n';
    });
    return out.trimEnd();
  }
  if (typeof data === 'object') {
    return Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n');
  }
  return String(data);
}

// Two-phase confirm state
export function checkTwoPhaseConfirm(opId: string, force: boolean): void {
  if (force) return; // User explicitly forced it
  
  const tokenFile = path.join(process.cwd(), '.axi-confirm');
  const token = `${opId}-${Date.now()}`;
  
  if (fs.existsSync(tokenFile)) {
    const existing = fs.readFileSync(tokenFile, 'utf8').split('|');
    if (existing[0] === opId && Date.now() - parseInt(existing[1]) < 60000) {
      fs.unlinkSync(tokenFile);
      return; // Confirmed within 60s
    }
  }
  
  // Write new token
  fs.writeFileSync(tokenFile, `${opId}|${Date.now()}`);
  console.log(JSON.stringify({
    status: 'confirmation_required',
    message: `Destructive operation '${opId}' requires confirmation. Run the command again within 60 seconds to confirm, or pass --force.`
  }));
  process.exit(0);
}

export function handleComplexInteraction(opId: string): any {
  const tmpFile = path.join(process.cwd(), `${opId}-input.json`);
  fs.writeFileSync(tmpFile, JSON.stringify({ "//": "Fill this payload" }, null, 2));
  console.log(`Generated temporary input file at ${tmpFile}`);
  console.log(`Please edit it and re-run with --file ${tmpFile}`);
  process.exit(0);
}