import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { identity, saveArticle, getArticle, parseArticle, validDate, uploadImage } from '../lib/articles.mjs';
import { command, repositoryReady, reviewPublication, publishArticle } from '../lib/publish.mjs';
const input = (extra={}) => ({slug:'test-post',lang:'zh',revision:null,data:{title:'中文标题',description:'摘要',pubDate:'2026-11-03',category:'技术笔记',tags:['Astro'],featured:false,draft:true,lang:'zh'},body:'## 正文\n\nHello **Markdown**.\n',...extra});
async function fixture(t) {const root=await mkdtemp(join(tmpdir(),'flandolu-test-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
test('rejects traversal, shell metacharacters, invalid dates and malformed YAML',()=>{
  for(const slug of ['../escape','UPPER','a/b','a;git push','a&echo','-option']) assert.throws(()=>identity({slug,lang:'zh'}));
  assert.throws(()=>identity({slug:'okay',lang:'../../'}));
  assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2024-02-29'),true);
  assert.throws(()=>parseArticle('---\ntitle: A\ntitle: B\n---\nbody'));
});
test('new/save/translation roundtrip preserves Chinese, code, and unknown frontmatter',async t=>{
  const root=await fixture(t);const first=await saveArticle(root,input());
  assert.equal(first.body,input().body);assert.equal(first.data.draft,true);
  const path=join(root,first.file);
  await writeFile(path,(await readFile(path,'utf8')).replace('---\n','---\n# Preserve this comment\nseries: Original series\nseriesOrder: 2\n'));
  const reread=await getArticle(root,input());
  const edited=await saveArticle(root,input({revision:reread.revision,data:{...input().data,title:'修改标题'}}));
  const raw=await readFile(path,'utf8');assert.match(raw,/# Preserve this comment/);assert.match(raw,/series: Original series/);assert.match(raw,/seriesOrder: 2/);
  const translated=await saveArticle(root,input({lang:'en',data:{...input().data,lang:'en',title:'English title'}}));
  assert.equal(translated.file,'src/content/blog/en/test-post.md');
  assert.equal((await getArticle(root,input())).data.title,edited.data.title);
});
test('stale saves and duplicate new slugs cannot overwrite an article',async t=>{
  const root=await fixture(t), original=await saveArticle(root,input());
  await assert.rejects(()=>saveArticle(root,input()),/changed on disk/);
  await saveArticle(root,input({revision:original.revision,data:{...input().data,title:'New title'}}));
  await assert.rejects(()=>saveArticle(root,input({revision:original.revision})),/changed on disk/);
  assert.equal((await getArticle(root,input())).data.title,'New title');
});
test('uploads reject executable/SVG content and retain supported image bytes',async t=>{
  const root=await fixture(t);
  await assert.rejects(()=>uploadImage(root,{base64:Buffer.from('<svg onload="bad"/>').toString('base64')}),/Choose a PNG/);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yL9sAAAAASUVORK5CYII=','base64');
  const result=await uploadImage(root,{base64:png.toString('base64')});
  assert.deepEqual(await readFile(join(root,'public',result.path)),png);
});
test('publication review refuses drafts, wrong branch, staged files and unrelated changes',async t=>{
  const root=await fixture(t);const git=(...args)=>command(root,'git',args);
  await git('init','-b','main');await git('config','user.name','Test');await git('config','user.email','test@example.invalid');
  await writeFile(join(root,'README.md'),'fixture');await git('add','README.md');await git('commit','-m','fixture');
  await git('remote','add','origin','https://github.com/flandolusukalate/Flandolusukalate.github.io.git');
  await git('update-ref','refs/remotes/origin/main','HEAD');
  const draft=await saveArticle(root,input());await assert.rejects(()=>reviewPublication(root,input()),/Uncheck Draft/);
  await saveArticle(root,input({revision:draft.revision,data:{...input().data,draft:false}}));
  const review=await reviewPublication(root,input());assert.deepEqual(review.files,['src/content/blog/test-post.md']);assert.match(review.diff,/New article/);
  await git('switch','-c','codex/test');await assert.rejects(()=>repositoryReady(root),/main branch/);await git('switch','main');
  await writeFile(join(root,'secret.env'),'test-not-secret');await assert.rejects(()=>repositoryReady(root),/other code/);
  await rm(join(root,'secret.env'));await git('add','README.md','src/content/blog/test-post.md');await assert.rejects(()=>repositoryReady(root),/staged/);
});

async function publishingFixture(t) {
  const root=await fixture(t), git=(...args)=>command(root,'git',args);
  await git('init','-b','main');await git('config','user.name','Test');await git('config','user.email','test@example.invalid');await git('config','core.autocrlf','true');
  await writeFile(join(root,'README.md'),'fixture\n');await git('add','README.md');await git('commit','-m','fixture');
  await git('remote','add','origin','https://github.com/flandolusukalate/Flandolusukalate.github.io.git');await git('update-ref','refs/remotes/origin/main','HEAD');
  await saveArticle(root,input({data:{...input().data,draft:false}}));
  return {root,git};
}
test('build failure leaves HEAD and index untouched',async t=>{
  const {root,git}=await publishingFixture(t), head=await git('rev-parse','HEAD');
  const run=async(_,exe,args)=>{if(exe!=='git')throw new Error('Build failed in fixture');if(args[0]==='fetch')return '';throw new Error('Unexpected command');};
  const review=await reviewPublication(root,input());
  await assert.rejects(()=>publishArticle(root,review,()=>{},run),/Build failed in fixture/);
  assert.equal(await git('rev-parse','HEAD'),head);assert.equal(await git('diff','--cached','--name-only'),'');
});
test('CRLF publishes normally; failed push retries the same commit and blocks edited retries',async t=>{
  const {root,git}=await publishingFixture(t), file=join(root,'src/content/blog/test-post.md');
  await writeFile(file,(await readFile(file,'utf8')).replaceAll('\n','\r\n'));
  let failPush=true, commits=0;
  const run=async(cwd,exe,args,log)=>{
    if(exe!=='git'||args[0]==='fetch')return '';
    if(args[0]==='push'){if(failPush)throw new Error('Network unavailable');return '';}
    if(args[0]==='commit')commits++;
    return command(cwd,exe,args,log);
  };
  const review=await reviewPublication(root,input());
  await assert.rejects(()=>publishArticle(root,review,()=>{},run),/saved locally; push did not succeed/);
  const committed=await git('rev-parse','HEAD');
  assert.equal(commits,1);assert.equal(await git('diff','--cached','--name-only'),'');
  const original=await readFile(file,'utf8');await writeFile(file,original+'\nNew local edit.\n');
  await assert.rejects(()=>reviewPublication(root,input()),/previous publication is committed/);
  await writeFile(file,original);failPush=false;
  const retry=await reviewPublication(root,input());const result=await publishArticle(root,retry,()=>{},run);
  assert.equal(result.commit,committed);assert.equal(commits,1);
});
test('edit during build aborts without staging or committing',async t=>{
  const {root,git}=await publishingFixture(t), head=await git('rev-parse','HEAD'), review=await reviewPublication(root,input());
  const run=async(_,exe)=>{if(exe!=='git')await writeFile(join(root,review.files[0]),(await readFile(join(root,review.files[0]),'utf8'))+'\nChanged externally.\n');return '';};
  await assert.rejects(()=>publishArticle(root,review,()=>{},run),/changed during the build/);
  assert.equal(await git('rev-parse','HEAD'),head);assert.equal(await git('diff','--cached','--name-only'),'');
});
