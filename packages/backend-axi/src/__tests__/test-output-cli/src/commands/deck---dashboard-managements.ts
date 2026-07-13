import { Command } from 'commander';
import { formatToon, checkTwoPhaseConfirm, handleComplexInteraction, runMediumWizard, ensureEnv } from '../utils';

export function registerdeckdashboardmanagementsCommand(program: Command) {
  const group = program.command('deck---dashboard-managements').description("Operations on Deck & Dashboard Managements");

  
  group.command('deck')
    .description("Execute deck")
    
    .option('--field1 <value>', 'Argument field1')
    .option('--field2 <value>', 'Argument field2')
    .option('--field3 <value>', 'Argument field3')
    .option('--field4 <value>', 'Argument field4')
    .option('--field5 <value>', 'Argument field5')
    .option('--field6 <value>', 'Argument field6')
    .option('--field7 <value>', 'Argument field7')
    
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
      const missingArgs = ["field1","field2","field3","field4","field5","field6","field7"].filter(name => opts[name] === undefined);
      if (missingArgs.length > 0) {
        const wizardResult = await runMediumWizard('addDeck', missingArgs, {"field1":"<string>","field2":"<string>","field3":"<string>","field4":"<string>","field5":"<string>","field6":"<string>","field7":"<string>"});
        if (wizardResult === 'generate_file') {
          return handleComplexInteraction('addDeck', {"field1":"<string>","field2":"<string>","field3":"<string>","field4":"<string>","field5":"<string>","field6":"<string>","field7":"<string>"});
        } else {
          Object.assign(opts, wizardResult);
        }
      }
    }

    let url = "/api/AddDeck";

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
    if (opts['field1'] !== undefined) bodyPayload['field1'] = opts['field1'];
    if (opts['field2'] !== undefined) bodyPayload['field2'] = opts['field2'];
    if (opts['field3'] !== undefined) bodyPayload['field3'] = opts['field3'];
    if (opts['field4'] !== undefined) bodyPayload['field4'] = opts['field4'];
    if (opts['field5'] !== undefined) bodyPayload['field5'] = opts['field5'];
    if (opts['field6'] !== undefined) bodyPayload['field6'] = opts['field6'];
    if (opts['field7'] !== undefined) bodyPayload['field7'] = opts['field7'];
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
      
      const opNameLower = 'deck'.toLowerCase();
      const opIdLower = 'addDeck'.toLowerCase();
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

  
  group.command('deck-1')
    .description("Execute deck")
    
    .option('--force', 'Bypass two-phase confirmation')
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
    checkTwoPhaseConfirm('deleteDeck', !!opts.force);

    if (!opts.file && !opts.axiFile) {
      const missingArgs = [].filter(name => opts[name] === undefined);
      if (missingArgs.length > 0) {
        console.error('error: required option(s) missing: ' + missingArgs.map(a => '--' + a).join(', '));
        process.exit(1);
      }
    }

    let url = "/api/DeleteDeck/123";

    const baseUrl = process.env.AXI_BASE_URL || 'http://localhost:3000';
    const reqUrl = baseUrl + (url.startsWith('/') ? url : '/' + url);
    const contentType = 'application/json';

    const reqOpts: RequestInit = {
      method: 'DELETE',
      headers: {
        'Content-Type': contentType,
        'Accept': 'application/json'
      }
    };

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
      
      const opNameLower = 'deck'.toLowerCase();
      const opIdLower = 'deleteDeck'.toLowerCase();
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
    console.log("Operations on Deck & Dashboard Managements");
    console.log('Run `<cli> deck---dashboard-managements --help` for available commands.');
  });
}