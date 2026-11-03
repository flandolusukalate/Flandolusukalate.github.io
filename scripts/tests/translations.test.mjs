import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, rename, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { translationSettings, protectKey } from '../lib/translation-settings.mjs';
import { translateArticle } from '../lib/deepseek.mjs';
import { translations, sourceHash } from '../lib/translations.mjs';
import { saveArticle, getArticle, listArticles } from '../lib/articles.mjs';
import { writeJsonAtomically } from '../lib/atomic-json.mjs';

async function fixture(t) { const root = await mkdtemp(join(tmpdir(),'flandolu-translation-')); t.after(()=>rm(root,{recursive:true,force:true})); return root; }
const input = () => ({ slug:'translation-test', lang:'zh', revision:null, data:{title:'测试标题',description:'摘要',category:'技术',tags:['Astro'],pubDate:'2026-11-03',draft:true,featured:false,lang:'zh'}, body:'## 中文\n\n中文 `const n = 1`\n\n```js\nconsole.log("中文");\n```\n\n[链接](https://example.com/a_(b)) ![图](/uploads/image.png)\n' });
const fakeSettings = { publicState:()=>({configured:true,automatic:true}), credentials:async()=>({key:'fixture-key-not-real',model:'deepseek-flash'}) };
const translated = article => ({title:'Title',description:'Summary',category:'Technology',tags:['Astro'],body:article.body.replaceAll('中文','English')});
async function finish(service, root) {
  for (let tries=0;tries<100;tries++) { const state=await service.state(await listArticles(root)); if(state.job?.state!=='running')return state; await new Promise(resolve=>setTimeout(resolve,10)); }
  throw new Error('Translation did not finish.');
}
const envelope = (content, finish_reason='stop') => ({ok:true,json:async()=>({choices:[{finish_reason,message:{content:typeof content==='string'?content:JSON.stringify(content)}}]})});

test('local JSON replacement retries transient Windows locks and preserves the old file on failure',async t=>{
  const root=await fixture(t), path=join(root,'candidate.json');
  await writeJsonAtomically(path,{version:1}); let attempts=0;
  await writeJsonAtomically(path,{version:2},async(from,to)=>{if(attempts++<2)throw Object.assign(new Error('Synthetic sharing violation'),{code:'EPERM'});await rename(from,to);});
  assert.equal(attempts,3); assert.equal(JSON.parse(await readFile(path,'utf8')).version,2);
  await assert.rejects(()=>writeJsonAtomically(path,{version:3},async()=>{throw Object.assign(new Error('Synthetic permanent failure'),{code:'EIO'});}),/permanent/);
  assert.equal(JSON.parse(await readFile(path,'utf8')).version,2); assert.deepEqual(await readdir(root),['candidate.json']);
});

test('settings redact the key, keep it outside content, preserve blank keys, and clear automation with the key',async t=>{
  const root=await fixture(t), crypt=async(value,decrypt)=>decrypt?value.slice(7):'sealed:'+value;
  const settings=await translationSettings({directory:root,env:{},crypt});
  await settings.save({key:'fixture-key-not-real',model:'deepseek-flash',automatic:true});
  assert.equal(JSON.stringify(settings.publicState()).includes('fixture-key'),false);
  assert.match(await readFile(join(root,'translation.json'),'utf8'),/sealed:/);
  await settings.save({key:'',model:'deepseek-v4-pro',automatic:true});
  const restarted=await translationSettings({directory:root,env:{},crypt});
  assert.equal((await restarted.credentials()).key,'fixture-key-not-real');
  await restarted.save({clearKey:true,model:'deepseek-flash',automatic:true});
  assert.deepEqual(restarted.publicState(),{configured:false,fromEnvironment:false,model:'deepseek-flash',automatic:false});
  await assert.rejects(()=>restarted.credentials(),/Configure/);
  await assert.rejects(()=>restarted.save({key:'bad\nkey',model:'deepseek-flash',automatic:false}),/whitespace/);
});
test('environment credentials cannot be overwritten by the settings form',async t=>{
  const settings=await translationSettings({directory:await fixture(t),env:{DEEPSEEK_API_KEY:'environment-fixture'}});
  assert.equal(settings.publicState().fromEnvironment,true);
  await assert.rejects(()=>settings.save({key:'different',model:'deepseek-flash',automatic:false}),/terminal/);
  assert.equal((await settings.credentials()).key,'environment-fixture');
});
test('Windows DPAPI encrypts and roundtrips a synthetic key without storing plaintext', {skip:process.platform!=='win32'},async()=>{
  const encrypted=await protectKey('fixture-key-not-real');
  assert.equal(encrypted.includes('fixture-key-not-real'),false);
  assert.equal(await protectKey(encrypted,true),'fixture-key-not-real');
});
test('DeepSeek request uses the official endpoint and JSON; code and destinations remain exact',async()=>{
  const article={...input(),file:'src/content/blog/test.md'};
  const result=await translateArticle(article,await fakeSettings.credentials(),async(url,options)=>{
    assert.equal(url,'https://api.deepseek.com/chat/completions'); assert.equal(options.redirect,'error');
    assert.equal(options.headers.Authorization,'Bearer fixture-key-not-real');
    const request=JSON.parse(options.body); assert.deepEqual(request.thinking,{type:'disabled'}); assert.deepEqual(request.response_format,{type:'json_object'});
    const payload=JSON.parse(request.messages[1].content); assert.equal(payload.body.includes('console.log'),false);
    return envelope({...payload,title:'Title',description:'Summary',category:'Technology',body:payload.body.replaceAll('中文','English').replace('[链接]','[Link]').replace('![图]','![Image]')});
  });
  assert.match(result.body,/console.log\("中文"\)/); assert.match(result.body,/`const n = 1`/); assert.match(result.body,/https:\/\/example.com\/a_\(b\)/);
});
test('rejects altered links, missing code, invalid/empty/truncated JSON and provider errors without exposing response bodies',async()=>{
  const article={...input(),file:'src/content/blog/test.md'}, credentials=await fakeSettings.credentials();
  for(const response of [envelope('   '),envelope('{}'),envelope('{'),envelope('{}','length')]) await assert.rejects(()=>translateArticle(article,credentials,async()=>response),/invalid translation/);
  for(const rewrite of [body=>body.replace('https://example.com','https://evil.invalid'),body=>body.replace(/FLANDOLU\w+TOKEN0END/,'')]) {
    await assert.rejects(()=>translateArticle(article,credentials,async(url,options)=>{const payload=JSON.parse(JSON.parse(options.body).messages[1].content);return envelope({...payload,body:rewrite(payload.body)});}),/changed/);
  }
  for(const status of [401,402,429,500]) await assert.rejects(()=>translateArticle(article,credentials,async()=>({ok:false,status,json:()=>{throw new Error('must not read secret body');}})),new RegExp('DeepSeek '+status));
  await assert.rejects(()=>translateArticle(article,credentials,async()=>{throw new Error('secret must not escape');}),/Connection failed/);
  await assert.rejects(()=>translateArticle({...article,file:'test.mdx'},credentials),/MDX/);
  await assert.rejects(()=>translateArticle({...article,body:''},credentials),/24,000/);
});
test('generation persists a candidate, preserves existing English, requires a draft save, and deduplicates automatic saves',async t=>{
  const root=await fixture(t), source=await saveArticle(root,input());
  const english=await saveArticle(root,{...input(),lang:'en',data:{...input().data,lang:'en',title:'Human English',draft:false},body:'Human-reviewed English.\n'});
  let calls=0; const service=translations(root,fakeSettings,async article=>{calls++;return translated(article);});
  await service.afterSave(source); let state=await finish(service,root); assert.equal(state.job.state,'complete');
  assert.equal((await getArticle(root,english)).revision,english.revision);
  await service.afterSave(source); assert.equal(calls,1);
  const restarted=translations(root,fakeSettings,translated), {candidate,target}=await restarted.candidateForReview({slug:source.slug});
  assert.equal(candidate.data.draft,true); assert.equal(target.revision,english.revision);
  const save={...target,data:candidate.data,body:candidate.body,translationCandidate:candidate.id};
  await assert.rejects(()=>restarted.validateSave({...save,data:{...save.data,draft:false}}),/draft/);
  await restarted.validateSave(save); const saved=await saveArticle(root,save);
  assert.equal(saved.data.translationOf,sourceHash(source)); assert.equal(saved.data.draft,true);
  state=await restarted.state(await listArticles(root)); assert.equal(state.pairs[source.slug].candidate,null);
  // A manual regeneration of an already translated source must still be reviewable.
  await restarted.start(source); state=await finish(restarted,root); assert.ok(state.pairs[source.slug].candidate);
});
test('source and target edits during a request make its candidate stale; failed generation preserves the previous candidate',async t=>{
  const root=await fixture(t), source=await saveArticle(root,input());
  let release; const service=translations(root,fakeSettings,()=>new Promise(resolve=>{release=resolve;}));
  await service.start(source); const changed=await saveArticle(root,{...source,body:source.body+'Changed\n'});
  release(translated(source)); let state=await finish(service,root); assert.equal(state.pairs[source.slug].candidate.stale,true);
  await assert.rejects(()=>service.candidateForReview(source),/Chinese has changed/);
  const candidateBefore=await readFile(join(root,'.local-editor/translations/translation-test.json'),'utf8');
  const failed=translations(root,fakeSettings,async()=>{throw new Error('Synthetic provider failure');});
  await failed.start(changed); state=await finish(failed,root); assert.equal(state.job.state,'failed');
  assert.equal(await readFile(join(root,'.local-editor/translations/translation-test.json'),'utf8'),candidateBefore);
  const fresh=translations(root,fakeSettings,translated); await fresh.start(changed); const freshState=await finish(fresh,root);
  assert.equal(freshState.job.state,'complete',freshState.job.error);
  assert.equal((await fresh.candidateForReview(changed)).candidate.sourceHash,sourceHash(await getArticle(root,{slug:changed.slug,lang:'zh'})));
  await saveArticle(root,{...input(),lang:'en',data:{...input().data,lang:'en'}});
  await assert.rejects(()=>fresh.candidateForReview(changed),/English changed/);
});
test('concurrent requests, stale revisions and candidate path traversal are refused',async t=>{
  const root=await fixture(t),source=await saveArticle(root,input()); let release;
  const service=translations(root,fakeSettings,()=>new Promise(resolve=>{release=resolve;}));
  await assert.rejects(()=>service.start({...source,revision:'old'}),/Chinese changed/);
  await service.start(source); await assert.rejects(()=>service.start(source),/Another translation/);
  await assert.rejects(()=>service.candidateForReview({slug:'../escape'}),/Slug/);
  release(translated(source)); await finish(service,root);
});
