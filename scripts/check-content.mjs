import { readdir, readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArticle, validateArticle, safePath, identity } from './lib/articles.mjs';

export async function checkContent(root) {
  let count = 0;
  for (const collection of ['blog','projects','moments']) {
    const base = resolve(root, 'src/content', collection);
    const names = await readdir(base, { recursive: true });
    const ids = new Set();
    for (const name of names.filter(n => /\.mdx?$/.test(n))) {
      const normalized = name.replaceAll('\\', '/'), lang = normalized.startsWith('en/') ? 'en' : 'zh';
      const slug = normalized.replace(/^en\//,'').replace(/\.mdx?$/,'');
      identity({slug,lang});
      const key = `${lang}/${slug}`;
      if (ids.has(key)) throw new Error(`Duplicate slug: ${collection}/${key}`);
      ids.add(key);
      const source = await readFile(await safePath(root, `src/content/${collection}/${normalized}`), 'utf8');
      const { data, body } = parseArticle(source);
      if ((data.lang ?? 'zh') !== lang) throw new Error(`Language/file mismatch: ${normalized}`);
      if (collection === 'blog') validateArticle({ tags: [], featured: false, draft: false, ...data }, body);
      const images = [data.cover, ...(data.images ?? []), ...[...body.matchAll(/!\[[^\]]*\]\((\/[^\s)]+)(?:\s+"[^"]*")?\)/g)].map(m=>m[1])].filter(Boolean);
      for (const image of images) {
        if (/^https?:\/\//.test(image)) continue;
        if (!image.startsWith('/') || image.startsWith('//')) throw new Error(`Use a root-relative image path: ${image}`);
        await access(await safePath(root, `public${decodeURIComponent(image.split(/[?#]/)[0])}`));
      }
      count++;
    }
  }
  return count;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`Content validated: ${await checkContent(process.cwd())} files.`); }
  catch(error) { console.error(error.message); process.exitCode = 1; }
}
