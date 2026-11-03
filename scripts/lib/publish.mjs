import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { digest, getArticle, safePath, validateArticle } from './articles.mjs';

const require = createRequire(import.meta.url);
async function verifyGitBlobs(root, revision, review) {
  for (const file of review.files) {
    const object = await git(root, 'rev-parse', '--verify', `${revision}:${file}`);
    if (object !== review.gitHashes[file]) throw new Error('Git content changed after review. Inspect changes and review again; nothing was pushed.');
  }
}
export function packageBin(name) {
  const file = fileURLToPath(new URL(`../../node_modules/${name}/package.json`, import.meta.url));
  const pkg = require(file);
  return resolve(file, '..', typeof pkg.bin === 'string' ? pkg.bin : pkg.bin[name]);
}
export function command(root, executable, args, onLog = () => {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(executable, args, { cwd: root, shell: false, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', CI: 'true' } });
    let output = '', stdout = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Command timed out. Check local Git/build state before retrying.')); }, 240_000);
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output += chunk; if (output.length > 500_000) output = output.slice(-500_000); onLog(chunk.toString()); });
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolveResult(stdout.trimEnd()) : reject(new Error(`${executable === 'git' ? 'Git' : 'Build'} failed (exit ${code}).\n${output.slice(-4000)}`)); });
  });
}
const git = (root, ...args) => command(root, 'git', args);
export async function repositoryReady(root) {
  const remote = await git(root, 'remote', 'get-url', 'origin');
  if (!/^(https:\/\/github\.com\/|git@github\.com:)flandolusukalate\/Flandolusukalate\.github\.io(?:\.git)?$/i.test(remote)) throw new Error('Origin must be the Flandolu Space repository.');
  if (await git(root, 'branch', '--show-current') !== 'main') throw new Error('Publishing requires the main branch. Save locally and finish any code work first.');
  if (await git(root, 'diff', '--cached', '--name-only')) throw new Error('Other files are staged. Commit or unstage them before publishing.');
  const changed = await git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all');
  for (const record of changed.split('\0').filter(Boolean)) {
    const file = record.slice(3);
    if (!/^(src\/content\/blog\/|public\/uploads\/)/.test(file) || record.slice(0,2).includes('D') || record.slice(0,2).includes('R')) throw new Error('Finish other code changes/deletions before publishing articles.');
  }
  return git(root, 'rev-parse', 'HEAD');
}
export async function reviewPublication(root, id) {
  const head = await repositoryReady(root), article = await getArticle(root, id);
  if (!article) throw new Error('Save the article before reviewing.');
  validateArticle(article.data, article.body);
  if (article.data.draft) throw new Error('Uncheck Draft and save before publishing. Drafts stay local.');
  const source = await readFile(await safePath(root, article.file), 'utf8');
  const assets = [...new Set(source.match(/\/uploads\/[a-zA-Z0-9._-]+\.(?:png|jpg|jpeg|webp|gif)/g) ?? [])].map(path => `public${path}`);
  const files = [article.file, ...assets], hashes = {}, gitHashes = {};
  for (const file of files) {
    hashes[file] = digest(await readFile(await safePath(root, file)));
    gitHashes[file] = await git(root, 'hash-object', `--path=${file}`, file);
  }
  const tracked = await git(root, 'ls-files', '--', article.file);
  const diff = tracked ? await git(root, 'diff', '--no-ext-diff', '--', article.file) : `New article: ${article.file}\n\n${source}`;
  const pending = await git(root, 'log', '--oneline', 'origin/main..HEAD');
  // A push retry is restricted to this exact article's previous commit.
  if (pending) {
    const count = await git(root, 'rev-list', '--count', 'origin/main..HEAD');
    const message = await git(root, 'log', '-1', '--format=%s');
    const committed = (await git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD')).split('\n');
    if (count !== '1' || message !== `Publish article: ${article.lang}/${article.slug}` || committed.some(file => !files.includes(file))) throw new Error('There are unrelated local commits. Push or resolve them outside the editor first.');
    if (diff || await git(root, 'status', '--porcelain', '--', ...assets)) throw new Error('A previous publication is committed but not pushed. Run git push origin main to finish that publication first; your newer local edits will be kept.');
  }
  if (!diff && !pending && !(await git(root, 'status', '--porcelain', '--', ...assets))) throw new Error('No local changes to publish.');
  return { head, id: { slug: article.slug, lang: article.lang }, title: article.data.title, files, hashes, gitHashes, diff, pending };
}
export async function publishArticle(root, review, onLog, run = command) {
  const fresh = await reviewPublication(root, review.id);
  if (fresh.head !== review.head || JSON.stringify(fresh.hashes) !== JSON.stringify(review.hashes)) throw new Error('Files changed after review. Review the changes again.');
  await run(root, 'git', ['fetch', 'origin', 'main'], onLog);
  const ancestor = await git(root, 'merge-base', 'HEAD', 'origin/main');
  if (ancestor !== await git(root, 'rev-parse', 'origin/main')) throw new Error('GitHub has newer changes. Pull them before publishing; nothing was overwritten.');
  await run(root, process.execPath, [resolve(root, 'scripts/check-content.mjs')], onLog);
  await run(root, process.execPath, [packageBin('astro'), 'check'], onLog);
  await run(root, process.execPath, [packageBin('astro'), 'build'], onLog);
  await run(root, process.execPath, [packageBin('pagefind'), '--site', 'dist'], onLog);
  const checked = await reviewPublication(root, review.id);
  if (checked.head !== review.head || JSON.stringify(checked.hashes) !== JSON.stringify(review.hashes)) throw new Error('Files changed during the build. Review again.');
  await git(root, 'add', '--', ...review.files);
  const staged = await git(root, 'diff', '--cached', '--name-only');
  if (staged.split('\n').filter(Boolean).some(file => !review.files.includes(file))) throw new Error('Unexpected staged files detected. Inspect Git before retrying.');
  try { await verifyGitBlobs(root, '', review); }
  catch (error) { await git(root, 'restore', '--staged', '--', ...review.files); throw error; }
  if (staged) {
    try { await run(root, 'git', ['commit', '-m', `Publish article: ${review.id.lang}/${review.id.slug}`], onLog); }
    catch (error) { await git(root, 'restore', '--staged', '--', ...review.files); throw error; }
  }
  const commit = await git(root, 'rev-parse', 'HEAD');
  await verifyGitBlobs(root, 'HEAD', review);
  const committedFiles = (await git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD')).split('\n');
  if (committedFiles.some(file => !review.files.includes(file))) throw new Error('Unexpected files in the commit. Inspect Git before pushing; nothing was pushed.');
  try { await run(root, 'git', ['push', 'origin', 'main'], onLog); }
  catch (error) { throw new Error(`Commit ${commit.slice(0,7)} is saved locally; push did not succeed. Fix network/login, then review and publish again to retry.\n${error.message}`); }
  return { commit, url: `https://flandolusukalate.github.io/${review.id.lang === 'en' ? 'en/' : ''}blog/${review.id.slug}/`, actions: 'https://github.com/flandolusukalate/Flandolusukalate.github.io/actions' };
}
