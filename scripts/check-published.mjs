import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const input = process.argv[2];
if (!input) { console.error('Usage: npm run check:live -- https://your-project.pages.dev'); process.exit(1); }
const origin = new URL(input).origin;
assert(origin.startsWith('https://'), 'Use the actual public HTTPS URL');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const entries = [['/', 'index.html'], ...['visual-journey', 'idea-presentation', 'working-log', 'project-title', 'feedback', 'about'].map(page => ['/' + page, page + '/index.html']), ['/eastern-mood/', 'eastern-mood/index.html'], ['/eastern-mood/experience', 'eastern-mood/experience.html']];
const resources = new Set();
for (const [route, file] of entries) {
  const response = await fetch(origin + route, { signal: AbortSignal.timeout(30000) });
  assert(response.ok, `${route}: HTTP ${response.status}`);
  const html = await response.text();
  const local = fs.readFileSync(path.join(root, file), 'utf8');
  const marker = local.match(/data-page="[^"]+"|<meta name="artwork-release" content="[^"]+">/)?.[0];
  assert(html.includes(marker), `${route}: unexpected page or old artwork release`);
  if (file === 'index.html') {
    assert(html.includes('NET ART 02') && html.includes('/working-log'), 'Missing project/log entry');
  }
  for (const match of local.matchAll(/(?:src|href|poster)=["'](\/[^"']+)["']/g)) {
    const url = new URL(match[1], origin);
    if (/\.(png|svg|js|mjs|css|wasm|task)$/.test(url.pathname)) resources.add(url.href);
  }
  console.log(`PASS direct page: ${route}`);
}
for (const resource of ['gesture_recognizer.task', 'vision_bundle.mjs', 'wasm/vision_wasm_internal.wasm', 'wasm/vision_wasm_nosimd_internal.wasm']) {
  resources.add(origin + '/eastern-mood/vendor/mediapipe/' + resource);
}
const queue = [...resources];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const url = queue.shift();
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
    assert(response.ok, `${new URL(url).pathname}: HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    assert(!type.includes('text/html'), `Resource fell back to HTML: ${url}`);
    if (url.endsWith('.wasm')) assert(type.includes('application/wasm'), `Incorrect WASM type: ${url}`);
  }
}));
const missing = await fetch(origin + '/__living-studio-missing-page-check__', { signal: AbortSignal.timeout(30000) });
assert(missing.status === 404, `Missing page should return 404, received ${missing.status}`);
console.log(`PASS: ${resources.size} public asset responses, model/WASM resources and real 404.`);
console.log('Still verify real-camera gestures, mobile/desktop layout and a later Git-triggered redeployment manually.');
