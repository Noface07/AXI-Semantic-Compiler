import { Command } from 'commander';
import { formatToon, checkTwoPhaseConfirm, handleComplexInteraction, runMediumWizard, ensureEnv } from '../utils';

export function registerauthenticationusermanagementsCommand(program: Command) {
  const group = program.command('authentication---user-managements').description("Operations on Authentication & User Managements");

  
  group.command('user-profile')
    .description("Execute user-profile")
    
    
    .option('--file <path>', 'Provide arguments via JSON/YAML file')
    .option('--json', 'Output raw JSON instead of TOON')
    .action(async (opts) => {

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

    if (!opts.file && !opts.axiFile) {
      const missingArgs = [].filter(name => opts[name] === undefined);
      if (missingArgs.length > 0) {
        console.error('error: required option(s) missing: ' + missingArgs.map(a => '--' + a).join(', '));
        process.exit(1);
      }
    }

    let url = "/api/GetUserProfile";

    const baseUrl = process.env.AXI_BASE_URL || 'http://localhost:3000';
    const reqUrl = baseUrl + (url.startsWith('/') ? url : '/' + url);
    const contentType = 'application/json';

    const reqOpts: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': contentType,
        'Accept': 'application/json'
      }
    };
    if (process.env.AXI_TOKEN) {
      (reqOpts.headers as any)['Authorization'] = 'Bearer ' + process.env.AXI_TOKEN;
    }

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
      
      const opNameLower = 'user-profile'.toLowerCase();
      const opIdLower = 'getUserProfile'.toLowerCase();
      const tokenVal = data?.token || data?.access_token || data?.accessToken;
      if ((opNameLower.includes('sign-in') || opNameLower.includes('login') || opIdLower.includes('signin') || opIdLower.includes('login')) && tokenVal) {
        const envPath = require('path').join(process.cwd(), '.env');
        let envContent = '';
        try { envContent = require('fs').readFileSync(envPath, 'utf8'); } catch(e) {}
        if (envContent.includes('AXI_TOKEN=')) {
          envContent = envContent.replace(/AXI_TOKEN=.*/, 'AXI_TOKEN=' + tokenVal);
        } else {
          envContent += '\nAXI_TOKEN=' + tokenVal + '\n';
        }
        require('fs').writeFileSync(envPath, envContent.trim() + '\n');
        console.error('\n[AXI] Automatically saved new AXI_TOKEN to .env');
      }

      process.exit(0);
    } catch (err: any) {
      console.error("Network Error: " + err.message);
      console.error("Attempted URL: " + reqUrl);
      process.exit(1);
    }

    });

  
  group.command('sign-in')
    .description("Execute sign-in")
    
    
    .option('--file <path>', 'Provide arguments via JSON/YAML file')
    .option('--json', 'Output raw JSON instead of TOON')
    .action(async (opts) => {

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

    if (!opts.file && !opts.axiFile) {
      const missingArgs = [].filter(name => opts[name] === undefined);
      if (missingArgs.length > 0) {
        console.error('error: required option(s) missing: ' + missingArgs.map(a => '--' + a).join(', '));
        process.exit(1);
      }
    }

    let url = "/api/SignIn";

    const baseUrl = process.env.AXI_BASE_URL || 'http://localhost:3000';
    const reqUrl = baseUrl + (url.startsWith('/') ? url : '/' + url);
    const contentType = 'application/json';

    const reqOpts: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Accept': 'application/json'
      }
    };
    if (process.env.AXI_TOKEN) {
      (reqOpts.headers as any)['Authorization'] = 'Bearer ' + process.env.AXI_TOKEN;
    }

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
      
      const opNameLower = 'sign-in'.toLowerCase();
      const opIdLower = 'signIn'.toLowerCase();
      const tokenVal = data?.token || data?.access_token || data?.accessToken;
      if ((opNameLower.includes('sign-in') || opNameLower.includes('login') || opIdLower.includes('signin') || opIdLower.includes('login')) && tokenVal) {
        const envPath = require('path').join(process.cwd(), '.env');
        let envContent = '';
        try { envContent = require('fs').readFileSync(envPath, 'utf8'); } catch(e) {}
        if (envContent.includes('AXI_TOKEN=')) {
          envContent = envContent.replace(/AXI_TOKEN=.*/, 'AXI_TOKEN=' + tokenVal);
        } else {
          envContent += '\nAXI_TOKEN=' + tokenVal + '\n';
        }
        require('fs').writeFileSync(envPath, envContent.trim() + '\n');
        console.error('\n[AXI] Automatically saved new AXI_TOKEN to .env');
      }

      process.exit(0);
    } catch (err: any) {
      console.error("Network Error: " + err.message);
      console.error("Attempted URL: " + reqUrl);
      process.exit(1);
    }

    });
  
  // Principle 8: No args -> live top-level data
  group.action(() => {
    console.log("Operations on Authentication & User Managements");
    console.log('Run `<cli> authentication---user-managements --help` for available commands.');
  });
}