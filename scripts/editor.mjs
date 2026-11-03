import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn, fork } from 'node:child_process';
import { listArticles, saveArticle, uploadImage } from './lib/articles.mjs';
import { reviewPublication, publishArticle } from './lib/publish.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.EDITOR_PORT ?? 4311);
const previewPort = Number(process.env.PREVIEW_PORT ?? 4321);
if (![port, previewPort].every(p => Number.isInteger(p) && p >= 1024 && p < 65536) || port === previewPort) throw new Error('Invalid editor/preview ports.');
const origin = `http://127.0.0.1:${port}`;
const token = randomBytes(32).toString('hex');
let busy = false, review = null, job = null, preview, previewUrl = '', previewError = '';
const json = (res, code, data) => { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); };
async function body(req) {
  let length = 0, chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 12_100_000) throw new Error('Request too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if (req.headers.host !== `127.0.0.1:${port}`) return json(res, 403, { error:'Invalid host.' });
  const path = new URL(req.url, origin).pathname;
  try {
    if (['/', '/app.js', '/style.css'].includes(path) && req.method === 'GET') {
      const file = path === '/' ? 'index.html' : path.slice(1);
      const source = (await readFile(resolve(root, 'scripts/editor-ui', file), 'utf8')).replace('__SESSION_KEY__', token);
      res.writeHead(200, {'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8'});
      return res.end(source);
    }
    if (!path.startsWith('/api/')) return json(res, 404, {error:'Not found.'});
    if (req.headers['x-editor-key'] !== token) return json(res, 403, {error:'Reload the editor to reconnect.'});
    if (req.method === 'GET' && path === '/api/state') return json(res, 200, {articles:await listArticles(root), preview: previewUrl, previewError, job});
    if (req.method !== 'POST' || req.headers.origin !== origin || !req.headers['content-type']?.startsWith('application/json')) return json(res, 403, {error:'Same-origin JSON requests only.'});
    if (busy) return json(res, 409, {error:'Another save or publication is running. Please wait.'});
    busy = true;
    try {
      const input = await body(req);
      if (path === '/api/save') { review = null; return json(res, 200, await saveArticle(root, input)); }
      if (path === '/api/upload') { review = null; return json(res, 200, await uploadImage(root, input)); }
      if (path === '/api/review') {
        review = { ...await reviewPublication(root, input), nonce: randomBytes(24).toString('hex') };
        return json(res, 200, review);
      }
      if (path === '/api/publish') {
        if (!review || review.nonce !== input.nonce) throw new Error('Review the saved changes before publishing.');
        const selected = review; review = null;
        job = { state:'running', log:'Checking content and building…\n' };
        // Keep the write lock until publication finishes. Never include credentials in logs.
        publishArticle(root, selected, chunk => { job.log = (job.log + chunk).slice(-16_000); })
          .then(result => { job = { ...job, state:'complete', result }; })
          .catch(error => { job = { ...job, state:'failed', error:error.message }; })
          .finally(() => { busy = false; });
        json(res, 202, job);
        return;
      }
      return json(res, 404, {error:'Not found.'});
    } finally { if (job?.state !== 'running') busy = false; }
  } catch(error) { json(res, 400, {error:error.message}); }
});
server.on('error', error => { console.error(error.message); preview?.kill(); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  preview = fork(resolve(root, 'scripts/preview.mjs'), [String(previewPort)], {cwd:root, windowsHide:true, stdio:['inherit','inherit','inherit','ipc']});
  preview.on('message', result => {
    if (result.url) { previewUrl = result.url; previewError = ''; }
    if (result.error) previewError = result.error;
  });
  preview.on('error', error => { previewUrl = ''; previewError = error.message; });
  preview.on('exit', code => { previewUrl = ''; previewError ||= `Preview stopped (exit ${code}). Restart the editor; check PREVIEW_PORT if it is occupied.`; });
  console.log(`\nFlandolu's Writing Desk: ${origin}\nLocal only. Ctrl+C to stop.\n`);
  if (process.argv.includes('--open') && process.platform === 'win32') spawn('cmd.exe', ['/d','/c','start','',origin], {windowsHide:true, stdio:'ignore'});
});
function shutdown() { preview?.kill(); server.close(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => preview?.kill());
