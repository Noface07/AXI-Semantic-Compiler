/**
 * backend-eval/mock-server.ts
 *
 * Generates a mock HTTP server based on a SIR.
 * Listens on a random port and intercepts incoming AXI CLI requests,
 * validating path interpolation, queries, and body payloads.
 */
import * as http from 'http';
import type { SIR } from '@asc/core-sir';

export interface MockServer {
  url: string;
  close: () => void;
  getRequests: () => Array<{
    method: string;
    url: string;
    path: string;
    headers: Record<string, string | string[] | undefined>;
    body: any;
  }>;
}

export async function createMockServer(sir: SIR): Promise<MockServer> {
  const requests: any[] = [];
  
  const server = http.createServer((req, res) => {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk.toString();
    });
    
    req.on('end', () => {
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);
      
      requests.push({
        method: req.method || 'GET',
        url: req.url || '/',
        path: parsedUrl.pathname,
        query: Object.fromEntries(parsedUrl.searchParams.entries()),
        headers: req.headers,
        body: bodyData ? JSON.parse(bodyData) : null,
      });

      // Just respond with generic success to satisfy the CLI
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        message: 'Mock server received request',
        receivedPath: parsedUrl.pathname 
      }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => server.close(),
        getRequests: () => requests,
      });
    });
  });
}
