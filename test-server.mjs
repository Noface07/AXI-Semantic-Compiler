import * as http from 'http';
import { execSync } from 'child_process';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Mock server received request' }));
});

server.listen(0, () => {
  const port = server.address().port;
  console.log('Server running on port', port);
  try {
    const start = Date.now();
    execSync(`node packages/backend-eval/src/__tests__/test-eval-cli/dist/index.js authentication---user-managements sign-in`, {
      env: { ...process.env, AXI_BASE_URL: `http://localhost:${port}` },
      timeout: 5000,
      stdio: 'inherit'
    });
    console.log('Success in', Date.now() - start, 'ms');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    server.close();
  }
});
