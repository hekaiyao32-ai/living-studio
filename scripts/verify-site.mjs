import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const target = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});
const files = walk(root);
const resolveAsset = pathname => {
  const base = path.join(root, decodeURIComponent(pathname));
  return [base, path.join(base, 'index.html'), base + '.html'].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
};
assert(fs.existsSync(path.join(root, '404.html')), 'Missing real 404 page');
for (const route of ['/', '/visual-journey', '/idea-presentation', '/working-log', '/project-title', '/feedback', '/about', '/eastern-mood/', '/eastern-mood/experience']) {
  assert(resolveAsset(route), `Missing direct route: ${route}`);
}
let references = 0;
for (const file of files) {
  assert(fs.statSync(file).size <= 25 * 1024 * 1024, `Cloudflare Pages 25 MiB limit: ${path.relative(root, file)}`);
  if (!file.endsWith('.html')) continue;
  const html = fs.readFileSync(file, 'utf8');
  const baseURL = new URL(path.relative(root, file).replaceAll(path.sep, '/'), 'https://site.invalid/');
  for (const match of html.matchAll(/(?:src|href|poster)=["']([^"']+)["']/g)) {
    const url = new URL(match[1].replaceAll('&amp;', '&'), baseURL);
    if (url.origin !== baseURL.origin) continue;
    assert(resolveAsset(url.pathname), `Broken local reference in ${path.relative(root, file)}: ${url.pathname}`);
    references++;
  }
}
const eastern = path.join(root, 'eastern-mood');
const source = fs.readFileSync(path.join(eastern, 'sketch.js'));
for (const name of ['index.html', 'experience.html']) {
  const html = fs.readFileSync(path.join(eastern, name), 'utf8');
  const entry = html.match(/src="(\/eastern-mood\/assets\/sketch-[a-f0-9]+\.js)"/);
  assert(entry && fs.readFileSync(resolveAsset(entry[1])).equals(source), `Artwork entry not synchronized: ${name}`);
}
for (const dependency of ['vendor/p5.min.js', 'vendor/mediapipe/vision_bundle.mjs', 'vendor/mediapipe/gesture_recognizer.task', 'vendor/mediapipe/wasm/vision_wasm_internal.wasm', 'vendor/mediapipe/wasm/vision_wasm_nosimd_internal.wasm']) {
  assert(fs.existsSync(path.join(eastern, dependency)), `Missing artwork dependency: ${dependency}`);
}
// Fail before publication if common credential formats are accidentally added.
const privateValue = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bAKIA[0-9A-Z]{16}\b/;
for (const file of files.filter(file => /\.(html|css|js|mjs|json|txt|md)$/.test(file))) {
  assert(!privateValue.test(fs.readFileSync(file, 'utf8')), `Possible credential in ${path.relative(root, file)}; inspect before publication`);
}
console.log(`PASS: ${files.length} static files, ${references} local references, direct routes, artwork/model assets, 25 MiB file limit and common credential-pattern scan.`);
console.log('Static output is already in dist/. No transpilation or dependency installation is required.');
