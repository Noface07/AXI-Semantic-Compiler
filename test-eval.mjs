import * as fs from 'fs';
import * as path from 'path';
import { parsePostmanCollection } from './packages/frontend-postman/dist/index.js';
import { compilePipeline } from './packages/pipeline/dist/index.js';
import { generateAXI } from './packages/backend-axi/dist/index.js';
import { evaluateAXI } from './packages/backend-eval/dist/evaluator.js';

async function run() {
  const COLLECTION_PATH = path.join(process.cwd(), 'fixtures', 'postman', 'synthetic_test_collection.postman_collection.json');
  const OUT_DIR = path.join(process.cwd(), 'packages', 'backend-eval', 'src', '__tests__', 'test-eval-cli');
  const rawCollection = JSON.parse(fs.readFileSync(COLLECTION_PATH, 'utf8'));
  const { ast } = parsePostmanCollection(rawCollection, { URL: 'api.tdspl.com' });
  const { sir } = compilePipeline(ast);
  
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  generateAXI(sir, { outDir: OUT_DIR });
  
  console.log('Evaluating...');
  const result = await evaluateAXI(OUT_DIR, sir);
  console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
