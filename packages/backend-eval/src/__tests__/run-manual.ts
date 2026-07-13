import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from '@asc/pipeline';
import { evaluateAXI } from '../evaluator.js';

async function main() {
  const postmanFile = path.resolve(__dirname, '..', '..', '..', '..', 'pipeline', 'src', '__tests__', 'fixtures', 'TDSPL Categorized.postman_collection.json');
  console.log('Loading Postman from:', postmanFile);
  const raw = fs.readFileSync(postmanFile, 'utf8');
  const sir = pipeline(JSON.parse(raw), 'tdspl');

  const cliDir = path.resolve(__dirname, '..', '..', 'src', '__tests__', 'test-eval-cli');
  
  console.log('Starting evaluateAXI on:', cliDir);
  const result = await evaluateAXI(cliDir, sir);
  console.log('Eval Result:', result);
  
  if (!result.success) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
