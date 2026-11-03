import { readFile, readdir, writeFile, unlink, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { digest, getArticle, identity, safePath } from './articles.mjs';
import { writeJsonAtomically } from './atomic-json.mjs';
import { command, repositoryReady, preparePublication } from './publish.mjs';

const git = (root, ...args) => command(root, 'git', args);
const backupPath = (root, id) => {
  if (!/^[a-f0-9-]{36}$/.test(id ?? '')) throw new Error('Invalid deletion ID.');
  return safePath(root, `.local-editor/deletions/${id}.json`);
};
async function load(root, id) {
  const record = JSON.parse(await readFile(await backupPath(root, id), 'utf8'));
  if (record.id !== id || !Array.isArray(record.entries) || !record.entries.length || record.entries.length > 2) throw new Error('Invalid deletion backup.');
  for (const entry of record.entries) {
    if (![`${identity(entry)}.md`, `${identity(entry)}.mdx`].includes(entry.file) || digest(entry.source) !== entry.revision) throw new Error('Invalid deletion backup.');
  }
  if (!record.trackedFiles.every(file => record.entries.some(entry => entry.file === file))) throw new Error('Invalid deletion file list.');
  return record;
}
const store = async (root, record) => writeJsonAtomically(await backupPath(root, record.id), record);
const summary = record => ({ id:record.id, title:record.title, status:record.status, files:record.entries.map(e=>e.file), publishable:record.trackedFiles.length > 0, commit:record.commit });
export async function listDeletions(root) {
  let names;
  try { names = await readdir(await safePath(root, '.local-editor/deletions')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const records = await Promise.all(names.filter(name=>/^[a-f0-9-]{36}\.json$/.test(name)).map(name=>load(root,name.slice(0,-5))));
  return records.filter(record=>record.status !== 'restored').map(summary);
}
export async function assertNotPendingDeletion(root, input) {
  const base = identity(input);
  if ((await listDeletions(root)).some(record=>record.status==='pending' && record.files.some(file=>file===`${base}.md`||file===`${base}.mdx`))) throw new Error('该网址的文章正在等待发布删除，请先恢复或完成发布删除。 / This article has a pending deletion; restore or finish publishing it first.');
}
export async function deleteArticle(root, input) {
  if (typeof input.includeEnglish !== 'boolean' || (input.includeEnglish && input.lang !== 'zh')) throw new Error('Invalid language selection.');
  if ((await listDeletions(root)).some(record=>record.status === 'pending')) throw new Error('请先发布或恢复待删除的文章。 / Publish or restore the pending deletion first.');
  const selected = await getArticle(root, input);
  if (!selected || selected.revision !== input.revision) throw new Error('文章已改变，请重新载入后再删除。 / Article changed; reload before deleting.');
  const articles = [selected];
  if (input.includeEnglish) {
    const english = await getArticle(root, {slug:input.slug,lang:'en'});
    if (!english || english.revision !== input.englishRevision) throw new Error('英文版已改变，请重新载入后再删除。 / English changed; reload before deleting.');
    articles.push(english);
  }
  const entries = [];
  for (const article of articles) {
    const source = await readFile(await safePath(root, article.file), 'utf8');
    if (digest(source) !== article.revision) throw new Error('Article changed before deletion.');
    entries.push({slug:article.slug,lang:article.lang,file:article.file,source,revision:article.revision});
  }
  const files = entries.map(e=>e.file);
  if (await git(root,'diff','--cached','--name-only','--',...files)) throw new Error('请先处理文章的暂存改动。 / Resolve staged article changes before deleting.');
  const trackedFiles = (await git(root,'ls-files','--',...files)).split('\n').filter(Boolean);
  const record = {id:randomUUID(),title:selected.data.title,entries,trackedFiles,status:trackedFiles.length ? 'pending' : 'local'};
  await store(root, record); // Durable recovery exists before removing either language.
  try {
    for (const entry of entries) {
      const path = await safePath(root,entry.file);
      if (digest(await readFile(path,'utf8')) !== entry.revision) throw new Error('Article changed before deletion.');
      await unlink(path);
    }
  } catch (error) {
    try { await restoreDeletion(root, {id:record.id}); }
    catch { throw new Error('删除未完成，副本已保留在回收站。请恢复后重试。 / Deletion incomplete; restore the saved backup before retrying.'); }
    throw error;
  }
  return summary(record);
}
export async function restoreDeletion(root, {id}) {
  const record = await load(root,id);
  // A failed push can be retried only while the deletion's working tree is intact.
  if (record.commit && record.status !== 'published') throw new Error('请先重试发布删除，再恢复文章。 / Finish pushing the deletion before restoring.');
  for (const entry of record.entries) {
    const current = await getArticle(root,entry);
    if (current && (current.file !== entry.file || current.revision !== entry.revision)) throw new Error('同名文章已存在，恢复不会覆盖它。 / A different article exists; restore will not overwrite it.');
  }
  for (const entry of record.entries) {
    const path = await safePath(root,entry.file);
    await mkdir(dirname(path),{recursive:true});
    try { await writeFile(path,entry.source,{flag:'wx'}); }
    catch (error) { if (error.code !== 'EEXIST' || digest(await readFile(path,'utf8')) !== entry.revision) throw error; }
  }
  record.status = 'restored'; await store(root,record);
  return {restored:true};
}
const commitMessage = record => `Delete articles: ${record.entries.map(e=>`${e.lang}/${e.slug}`).join(', ')} (${record.id.slice(0,8)})`;
async function verifyDeletionCommit(root, record) {
  if (await git(root,'log','-1','--format=%s') !== commitMessage(record)) throw new Error('Unrelated commit; nothing was pushed.');
  const changes = (await git(root,'diff-tree','--no-commit-id','--name-status','-r','HEAD')).split('\n').filter(Boolean).sort();
  if (JSON.stringify(changes) !== JSON.stringify(record.trackedFiles.map(file=>`D\t${file}`).sort())) throw new Error('Unexpected files in deletion commit; nothing was pushed.');
}
export async function reviewDeletionPublication(root, {id}) {
  const record = await load(root,id);
  if (record.status !== 'pending' || !record.trackedFiles.length) throw new Error('No pending deletion to publish.');
  const head = await repositoryReady(root,record.trackedFiles);
  for (const entry of record.entries) if (await getArticle(root,entry)) throw new Error('文章已重新出现，请检查后再发布删除。 / Article reappeared; review before deleting.');
  const pending = await git(root,'log','--oneline','origin/main..HEAD');
  const tracked = await git(root,'ls-tree','-r','--name-only','HEAD','--',...record.trackedFiles);
  if (pending || !tracked) {
    if (pending && await git(root,'rev-list','--count','origin/main..HEAD') !== '1') throw new Error('There are unrelated local commits.');
    await verifyDeletionCommit(root,record);
  } else if (JSON.stringify(tracked.split('\n').sort()) !== JSON.stringify([...record.trackedFiles].sort())) throw new Error('Tracked files changed; review the deletion again.');
  const diff = await git(root,'diff','--no-ext-diff','--',...record.trackedFiles);
  return {kind:'deletion',head,id:{id},title:record.title,files:record.trackedFiles,backupHash:digest(JSON.stringify(record.entries)),diff,pending};
}
export async function publishDeletion(root, review, onLog, run = command) {
  const matches = fresh => fresh.head === review.head && fresh.backupHash === review.backupHash && JSON.stringify(fresh.files) === JSON.stringify(review.files);
  if (!matches(await reviewDeletionPublication(root,review.id))) throw new Error('Deletion changed after review.');
  await preparePublication(root,onLog,run);
  if (!matches(await reviewDeletionPublication(root,review.id))) throw new Error('Deletion changed during the build.');
  const record = await load(root,review.id.id);
  const tracked = await git(root,'ls-tree','-r','--name-only','HEAD','--',...record.trackedFiles);
  if (tracked) {
    await git(root,'add','--',...record.trackedFiles);
    const staged = (await git(root,'diff','--cached','--name-status')).split('\n').filter(Boolean).sort();
    if (JSON.stringify(staged) !== JSON.stringify(record.trackedFiles.map(file=>`D\t${file}`).sort())) {
      await git(root,'restore','--staged','--',...record.trackedFiles);
      throw new Error('Unexpected staged files; nothing was committed.');
    }
    try { await run(root,'git',['commit','-m',commitMessage(record)],onLog); }
    catch (error) { await git(root,'restore','--staged','--',...record.trackedFiles); throw error; }
  }
  await verifyDeletionCommit(root,record);
  record.commit = await git(root,'rev-parse','HEAD'); await store(root,record);
  try { await run(root,'git',['push','origin','main'],onLog); }
  catch (error) { throw new Error(`删除提交已保留，修复网络后重试“发布删除”。 / Deletion commit saved; retry Publish deletion after fixing connectivity.\n${error.message}`); }
  record.status = 'published'; await store(root,record);
  return {kind:'deletion',commit:record.commit,url:'https://flandolusukalate.github.io/blog/'};
}
