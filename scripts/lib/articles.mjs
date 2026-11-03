import { readFile, writeFile, mkdir, readdir, lstat, rename, unlink } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parseDocument, Document } from 'yaml';

export const digest = data => createHash('sha256').update(data).digest('hex');
export const articleUrl = ({ slug, lang }) => `${lang === 'en' ? '/en' : ''}/blog/${slug}/`;
export function identity({ slug, lang }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug ?? '') || slug.length > 100) throw new Error('Slug: use lowercase letters, numbers and hyphens (max 100).');
  if (!['zh', 'en'].includes(lang)) throw new Error('Language must be zh or en.');
  return `src/content/blog/${lang === 'en' ? 'en/' : ''}${slug}`;
}

// Reject symlink escapes, including a symlinked parent directory.
export async function safePath(root, path) {
  const target = resolve(root, path);
  const rel = relative(resolve(root), target);
  if (rel.startsWith('..') || !rel || resolve(target) === resolve(root)) throw new Error('Invalid path.');
  let current = resolve(root);
  for (const part of rel.split(/[\\/]/)) {
    current = resolve(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error('Symlinks are not supported for content.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return target;
}
export function parseArticle(source) {
  const match = source.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error('Expected YAML frontmatter between --- lines.');
  const doc = parseDocument(match[1], { uniqueKeys: true });
  if (doc.errors.length) throw new Error(doc.errors.map(e => e.message).join('\n'));
  const data = doc.toJS({ maxAliasCount: 20 });
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Frontmatter must be a mapping.');
  return { doc, data, body: match[2] };
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function validateArticle(data, body) {
  for (const key of ['title', 'description', 'category']) if (typeof data[key] !== 'string' || !data[key].trim()) throw new Error(`${key} is required.`);
  for (const key of ['pubDate', 'updatedDate']) if ((key === 'pubDate' || data[key]) && !validDate(data[key])) throw new Error(`${key}: expected a valid YYYY-MM-DD date.`);
  if (data.lang !== undefined && !['zh','en'].includes(data.lang)) throw new Error('Invalid language.');
  if (!Array.isArray(data.tags) || data.tags.some(tag => typeof tag !== 'string' || !tag.trim())) throw new Error('Tags must be non-empty strings.');
  for (const key of ['draft', 'featured']) if (typeof data[key] !== 'boolean') throw new Error(`${key} must be true or false.`);
  if (typeof body !== 'string' || (!data.draft && !body.trim())) throw new Error('Published articles need Markdown content.');
  if (data.cover && (typeof data.cover !== 'string' || !/^\/(?!\/)[^\s]*$/.test(data.cover))) throw new Error('Cover must be a local /illustrations/ or /uploads/ path.');
}
export async function getArticle(root, id) {
  const base = identity(id);
  const found = [];
  for (const ext of ['md', 'mdx']) {
    const file = `${base}.${ext}`;
    try { found.push({ file, source: await readFile(await safePath(root, file), 'utf8') }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (found.length > 1) throw new Error('Duplicate .md/.mdx slug. Resolve the duplicate first.');
  if (!found.length) return null;
  const { file, source } = found[0], { data, body } = parseArticle(source);
  return { ...id, file, data: { tags: [], featured: false, draft: false, ...data, lang: id.lang }, body, revision: digest(source) };
}
export async function listArticles(root) {
  const result = [];
  for (const lang of ['zh', 'en']) {
    const folder = await safePath(root, `src/content/blog${lang === 'en' ? '/en' : ''}`);
    let names = [];
    try { names = await readdir(folder); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const name of names.filter(n => /\.mdx?$/.test(n))) {
      const slug = name.replace(/\.mdx?$/, '');
      const article = await getArticle(root, { slug, lang });
      if (article) result.push(article);
    }
  }
  return result.sort((a,b) => String(b.data.pubDate).localeCompare(String(a.data.pubDate)));
}
export async function saveArticle(root, input) {
  const base = identity(input), existing = await getArticle(root, input);
  if (existing ? input.revision !== existing.revision : input.revision != null) throw new Error('Article changed on disk. Reload before saving; your form has been kept.');
  const data = input.data, body = input.body;
  validateArticle(data, body);
  if (data.lang !== input.lang) throw new Error('Language does not match the file.');
  const file = existing?.file ?? `${base}.md`, target = await safePath(root, file);
  const doc = existing ? parseArticle(await readFile(target, 'utf8')).doc : new Document();
  for (const key of ['title','description','pubDate','updatedDate','category','tags','cover','featured','draft','lang']) {
    const value = data[key];
    if (value === undefined || (['cover','updatedDate'].includes(key) && !value)) doc.delete(key);
    else doc.set(key, value);
  }
  const source = `---\n${doc.toString()}---\n${body.replace(/^\n/, '')}${body.endsWith('\n') ? '' : '\n'}`;
  await mkdir(dirname(target), { recursive: true });
  if (!existing) await writeFile(target, source, { flag: 'wx' });
  else {
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, source, { flag: 'wx' });
      if (digest(await readFile(target)) !== existing.revision) throw new Error('Article changed on disk. Reload before saving.');
      await rename(temporary, target);
    } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  return getArticle(root, input);
}
export async function uploadImage(root, { base64 }) {
  if (typeof base64 !== 'string' || base64.length > 12_000_000) throw new Error('Image must be under 8 MB.');
  const bytes = Buffer.from(base64, 'base64');
  const ext = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpg'
    : bytes.subarray(0,6).toString().match(/^GIF8[79]a$/) ? 'gif'
    : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP' ? 'webp' : null;
  if (!ext || bytes.length > 8_000_000) throw new Error('Choose a PNG, JPEG, GIF or WebP under 8 MB.');
  const path = `/uploads/${digest(bytes).slice(0,24)}.${ext}`, target = await safePath(root, `public${path}`);
  await mkdir(dirname(target), { recursive: true });
  try { await writeFile(target, bytes, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  return { path };
}
