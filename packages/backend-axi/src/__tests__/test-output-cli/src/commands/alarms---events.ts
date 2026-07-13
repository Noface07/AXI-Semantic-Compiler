import { Command } from 'commander';
import { formatToon, checkTwoPhaseConfirm, handleComplexInteraction, runMediumWizard, ensureEnv } from '../utils';

export function registeralarmseventsCommand(program: Command) {
  const group = program.command('alarms---events').description("Operations on Alarms & Events");

  
  group.command('active-alarms')
    .description("Execute active alarms")
    
    .option('--filter <value>', 'Argument filter')
    
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
      return handleComplexInteraction('activeAlarms', {"filter":{}});
    }

    let url = "/api/ActiveAlarms";

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
    const bodyPayload: any = {};
    if (opts['filter'] !== undefined) bodyPayload['filter'] = opts['filter'];
    reqOpts.body = JSON.stringify(bodyPayload);

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
      
      const opNameLower = 'active alarms'.toLowerCase();
      const opIdLower = 'activeAlarms'.toLowerCase();
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
    console.log("Operations on Alarms & Events");
    console.log('Run `<cli> alarms---events --help` for available commands.');
  });
}