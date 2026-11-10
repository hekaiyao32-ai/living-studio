import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer((req, res) => {
  let base;
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    base = path.resolve(root, '.' + pathname);
    if (base !== path.resolve(root) && !base.startsWith(root)) throw new Error('Invalid path');
  } catch { res.writeHead(400); res.end('Invalid request'); return; }
  const file = [base, path.join(base, 'index.html'), base + '.html'].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
  const target = file || path.join(root, '404.html');
  res.writeHead(file ? 200 : 404, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
}).listen(5173, '127.0.0.1', () => console.log('Living Studio: http://localhost:5173 — press Ctrl+C to stop.'));
