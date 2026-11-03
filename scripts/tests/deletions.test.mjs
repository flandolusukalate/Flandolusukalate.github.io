import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveArticle, getArticle } from '../lib/articles.mjs';
import { command } from '../lib/publish.mjs';
import { deleteArticle, restoreDeletion, listDeletions, reviewDeletionPublication, publishDeletion, assertNotPendingDeletion } from '../lib/deletions.mjs';

async function fixture(t, tracked=false) {
  const root=await mkdtemp(join(tmpdir(),'flandolu-delete-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const git=(...args)=>command(root,'git',args);
  await git('init','-b','main');await git('config','user.name','Test');await git('config','user.email','test@example.invalid');
  await writeFile(join(root,'.gitignore'),'.local-editor/\n');await git('add','.gitignore');await git('commit','-m','fixture');
  await git('remote','add','origin','https://github.com/flandolusukalate/Flandolusukalate.github.io.git');
  const data={title:'Test article',description:'Summary',category:'Notes',tags:[],pubDate:'2026-11-03',draft:false,featured:false};
  const zh=await saveArticle(root,{slug:'test',lang:'zh',revision:null,data:{...data,lang:'zh'},body:'中文原文\n'});
  const en=await saveArticle(root,{slug:'test',lang:'en',revision:null,data:{...data,lang:'en'},body:'English\n'});
  if(tracked){await git('add',zh.file,en.file);await git('commit','-m','Articles');}
  await git('update-ref','refs/remotes/origin/main','HEAD');
  return {root,git,zh,en};
}
const selection=(zh,en,includeEnglish=false)=>({slug:zh.slug,lang:zh.lang,revision:zh.revision,includeEnglish,englishRevision:en?.revision});

test('delete defaults to one language, preserves assets, and restores exact untracked source',async t=>{
  const {root,zh,en}=await fixture(t), source=await readFile(join(root,zh.file));
  await mkdir(join(root,'public/uploads'),{recursive:true});await writeFile(join(root,'public/uploads/shared.png'),'fixture');
  const deleted=await deleteArticle(root,selection(zh,en));
  assert.equal(deleted.status,'local');assert.equal(await getArticle(root,zh),null);assert.ok(await getArticle(root,en));
  assert.equal(await readFile(join(root,'public/uploads/shared.png'),'utf8'),'fixture');
  assert.equal((await listDeletions(root)).length,1);
  await restoreDeletion(root,deleted);
  assert.deepEqual(await readFile(join(root,zh.file)),source);assert.deepEqual(await listDeletions(root),[]);
});
test('paired deletion checks both revisions before touching either language; restoration refuses conflicts',async t=>{
  const {root,zh,en}=await fixture(t);
  await assert.rejects(()=>deleteArticle(root,{...selection(zh,en,true),englishRevision:'stale'}),/English changed/);
  assert.ok(await getArticle(root,zh));assert.ok(await getArticle(root,en));
  const removed=await deleteArticle(root,selection(zh,en,true));
  assert.equal(await getArticle(root,zh),null);assert.equal(await getArticle(root,en),null);
  await saveArticle(root,{...zh,revision:null,data:{...zh.data,title:'Different article'}});
  await assert.rejects(()=>restoreDeletion(root,removed),/will not overwrite/);
  assert.equal(await getArticle(root,en),null);
  assert.equal((await getArticle(root,zh)).data.title,'Different article');
});
test('English deletion never removes Chinese; stale, traversal and malformed selections fail',async t=>{
  const {root,zh,en}=await fixture(t);
  await assert.rejects(()=>deleteArticle(root,{...selection(en,zh),includeEnglish:true}),/Invalid language/);
  await assert.rejects(()=>deleteArticle(root,{...selection(zh,en),revision:'stale'}),/Article changed/);
  await assert.rejects(()=>deleteArticle(root,{...selection(zh,en),slug:'../escape'}),/Slug/);
  await assert.rejects(()=>restoreDeletion(root,{id:'../escape'}),/Invalid deletion/);
  await deleteArticle(root,selection(en));assert.ok(await getArticle(root,zh));assert.equal(await getArticle(root,en),null);
});
test('deletion rejects a symlinked content folder',async t=>{
  const {root,zh,en}=await fixture(t), outside=await mkdtemp(join(tmpdir(),'flandolu-outside-'));
  t.after(()=>rm(outside,{recursive:true,force:true}));
  await writeFile(join(outside,'test.md'),await readFile(join(root,en.file)));
  await rm(join(root,'src/content/blog/en'),{recursive:true});
  await symlink(outside,join(root,'src/content/blog/en'),'junction');
  await assert.rejects(()=>deleteArticle(root,selection(zh,en,true)),/Symlinks/);
  assert.ok(await getArticle(root,zh));assert.ok(await readFile(join(outside,'test.md')));
});
test('build failure leaves deletion recoverable without committing or staging',async t=>{
  const {root,git,zh,en}=await fixture(t,true),head=await git('rev-parse','HEAD');
  const removed=await deleteArticle(root,selection(zh,en,true));
  await assert.rejects(()=>assertNotPendingDeletion(root,zh),/pending deletion/);
  await assert.rejects(()=>assertNotPendingDeletion(root,en),/pending deletion/);
  await assertNotPendingDeletion(root,{slug:'unrelated',lang:'zh'});
  await assert.rejects(()=>deleteArticle(root,selection(en)),/pending deletion first/);
  const review=await reviewDeletionPublication(root,removed);
  const run=async(_,exe)=>{if(exe!=='git')throw new Error('Fixture build failure');return '';};
  await assert.rejects(()=>publishDeletion(root,review,()=>{},run),/Fixture build failure/);
  assert.equal(await git('rev-parse','HEAD'),head);assert.equal(await git('diff','--cached','--name-only'),'');
  await restoreDeletion(root,removed);assert.equal(await git('status','--porcelain'),'');await assertNotPendingDeletion(root,zh);
});
test('deletion publication commits only selected files and retries failed pushes without a second commit',async t=>{
  const {root,git,zh,en}=await fixture(t,true),removed=await deleteArticle(root,selection(zh,en));
  await saveArticle(root,{...en,revision:en.revision,data:{...en.data,title:'Keep this local English edit'}});
  let failPush=true,commits=0;
  const run=async(cwd,exe,args,log)=>{
    if(exe!=='git'||args[0]==='fetch')return '';
    if(args[0]==='push'){if(failPush)throw new Error('Fixture offline');return '';}
    if(args[0]==='commit')commits++;
    return command(cwd,exe,args,log);
  };
  async function publish(){return publishDeletion(root,await reviewDeletionPublication(root,removed),()=>{},run);}
  await assert.rejects(publish,/Deletion commit saved/);
  const head=await git('rev-parse','HEAD');assert.equal(commits,1);
  assert.equal(await git('diff-tree','--no-commit-id','--name-status','-r','HEAD'),`D\t${zh.file}`);
  assert.equal((await getArticle(root,en)).data.title,'Keep this local English edit');
  await assert.rejects(()=>restoreDeletion(root,removed),/Finish pushing/);
  failPush=false;await publish();assert.equal(commits,1);assert.equal(await git('rev-parse','HEAD'),head);
  assert.equal((await listDeletions(root))[0].status,'published');await restoreDeletion(root,removed);assert.ok(await getArticle(root,zh));
});
test('recreated article during the build and unrelated changes prevent deletion publication',async t=>{
  const {root,git,zh,en}=await fixture(t,true),removed=await deleteArticle(root,selection(zh,en,true));
  await writeFile(join(root,'unrelated.txt'),'Keep me');
  await assert.rejects(()=>reviewDeletionPublication(root,removed),/other code/);await rm(join(root,'unrelated.txt'));
  const review=await reviewDeletionPublication(root,removed),head=await git('rev-parse','HEAD');
  const run=async(_,exe)=>{if(exe!=='git'&&!await getArticle(root,zh))await saveArticle(root,{...zh,revision:null});return '';};
  await assert.rejects(()=>publishDeletion(root,review,()=>{},run),/Article reappeared/);
  assert.equal(await git('rev-parse','HEAD'),head);assert.equal(await git('diff','--cached','--name-only'),'');
});
