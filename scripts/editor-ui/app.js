import { translationDesk } from './translation-ui.js';
import { deletionDesk } from './deletion-ui.js';
const $ = selector => document.querySelector(selector);
const form = $('#article-form'), field = name => form.elements.namedItem(name);
const key = $('meta[name="editor-key"]').content;
let ui = localStorage.getItem('flandolu-editor-language') === 'en' ? 'en' : 'zh';
let articles = [], current = null, dirty = false, previewOrigin = '', reviewNonce = '', working = false, lastJobState = '';
let pendingCandidate = null;
let libraryScope = 'all';
const words = {
  editing:['编辑文章','Edit article'],writing:['写作区','Writing area'],articleSettings:['文章设置','Article settings'],
  all:['全部','All'],filterArticles:['筛选文章','Filter articles'],summaryPlaceholder:['用一两句话介绍这篇文章…','Introduce this article in a sentence or two…'],
  formatting:['Markdown 工具','Markdown tools'],headingFormat:['插入二级标题','Insert heading'],boldFormat:['加粗','Bold'],linkFormat:['插入链接','Insert link'],codeFormat:['插入代码块','Insert code block'],
  headingText:['小标题','Heading'],boldText:['重点文字','Important text'],linkText:['链接文字','Link text'],codeText:['在这里写代码','Your code here'],characters:['字符','characters'],
  formatUnavailable:['浏览器未能插入格式，正文保持不变。可以直接输入 Markdown 语法。','Your browser could not insert the formatting. The text is unchanged; you can type Markdown directly.'],
  noChanges:['暂无需要发布的本地改动，可以继续编辑文章。','There are no local changes to publish. You can keep editing.'],
  tagsPlaceholder:['Astro, 学习笔记','Astro, Study Notes'],
  local:['仅在本机运行','Local only'],library:['文章书架','Article library'],new:['＋ 新文章','＋ New article'],filter:['查找文章','Find an article'],filterPlaceholder:['查找标题、语言或标签…','Find a title, language or tag…'],
  storage:['文章仍保存在项目的 Markdown 文件中，可随时使用其他编辑器。','Articles stay in your project as Markdown files. You can use another editor at any time.'],
  language:['文章语言','Article language'],slug:['网址名称（保存后固定）','URL slug (fixed after saving)'],translation:['编辑另一语言','Edit other language'],title:['标题','Title'],titlePlaceholder:['一个值得记录的想法','An idea worth keeping'],description:['摘要','Summary'],date:['发布日期','Publication date'],updated:['更新日期（可选）','Updated on (optional)'],category:['分类','Category'],tags:['标签（用逗号分隔）','Tags (comma-separated)'],
  options:['日期、封面与展示','Dates, cover & display'],cover:['封面路径（留空使用原有书房插画）','Cover path (leave empty for the library illustration)'],featured:['精选文章','Featured article'],body:['正文 · Markdown','Body · Markdown'],upload:['插入图片','Insert image'],bodyPlaceholder:['## 从这里开始…','## Start here…'],syntax:['支持 Markdown · 选中文字后可使用上方工具 · Ctrl / ⌘ + S 保存到本机','Markdown supported · Select text to format it · Ctrl / ⌘ + S saves locally'],
  draft:['草稿','Draft'],save:['保存到本机','Save locally'],preview:['预览文章 ↗','Preview article ↗'],review:['检查并发布','Review & publish'],
  publishNote:['保存不会上传。取消“草稿”并保存后，可检查改动、构建并推送到 GitHub。公开仓库里的文章源码可被任何人查看。','Saving does not upload. Uncheck Draft and save to review, build and push to GitHub. Article source in a public repository is visible to everyone.'],
  progress:['发布进度','Publication progress'],actions:['查看 GitHub 部署进度 ↗','View GitHub deployment ↗'],reviewTitle:['确认本次发布','Review this publication'],
  reviewNote:['只提交下列文章及其引用的上传图片。检查与构建通过后推送；网站将在 GitHub 部署完成后更新。','Only the article and its referenced uploads below will be committed. Checks and the build must pass before pushing. The website updates after GitHub finishes deploying.'],
  diff:['查看 Markdown 改动','View Markdown changes'],cancel:['返回编辑','Back to editing'],publish:['构建并发布到 GitHub','Build & publish to GitHub'],
  newTitle:['写下一个新想法','Write your next page'],saved:['已保存到本机','Saved locally'],unsaved:['有未保存的修改','Unsaved changes'],notSaved:['尚未保存','Not saved yet'],discard:['有未保存的修改。放弃这些修改并继续？','Discard your unsaved changes and continue?'],
  saveFirst:['请先保存当前文章，再预览或发布。','Save the article before previewing or publishing.'],saveOK:['已保存。现在可以预览文章。','Saved. You can now preview your article.'],empty:['没有匹配的文章。','No matching articles.'],published:['可发布','Ready to publish'],
  translating:['已创建另一语言的表单。请翻译标题、摘要和正文，再保存；两种语言会通过相同网址名称关联。','The translation form is ready. Translate the title, summary and body, then save. Both languages share the same slug.'],
  running:['正在检查、构建并推送，请保持编辑器运行…','Checking, building and pushing. Keep the editor running…'],pushed:['已推送到 GitHub。等待部署完成后打开正式文章验证。','Pushed to GitHub. Wait for deployment, then check the live article.'],failed:['发布未完成；本地文章已保留。','Publication did not finish; your local article is safe.'],openLive:['打开正式文章 ↗','Open live article ↗'],
  failedConnect:['无法连接本地编辑器。请确认启动窗口仍在运行，然后刷新；表单内容仍保留在此页面。','Cannot reach the local editor. Keep its terminal running, then reload. Your form is still on this page.'],
  chooseImage:['请使用小于 8 MB 的 PNG、JPEG、GIF 或 WebP 图片。','Choose a PNG, JPEG, GIF or WebP under 8 MB.'],uploaded:['图片已插入正文，保存文章后可预览。','Image inserted. Save the article to preview it.'],working:['请等待当前操作完成。','Please wait for the current operation.']
};
const t = id => words[id]?.[ui === 'en' ? 1 : 0] ?? id;
const urlFor = article => `${article.lang === 'en' ? '/en' : ''}/blog/${article.slug}/`;
function message(text = '', error = false) { $('#message').textContent = text; $('#message').classList.toggle('error', error); }
async function api(path, data) {
  let response;
  try { response = await fetch('/api/' + path, { method:data === undefined ? 'GET' : 'POST', headers:{'Content-Type':'application/json','X-Editor-Key':key}, ...(data === undefined ? {} : {body:JSON.stringify(data)}) }); }
  catch { throw new Error(t('failedConnect')); }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
function applyLanguage() {
  document.documentElement.lang = ui === 'en' ? 'en' : 'zh-CN';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-placeholder]').forEach(el => { el.placeholder = t(el.dataset.placeholder); });
  document.querySelectorAll('[data-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.label)); if (el.tagName === 'BUTTON') el.title = t(el.dataset.label); });
  $('#ui-language').textContent = ui === 'en' ? '中文' : 'English';
  renderList(); refreshState(); updateCount();
}
function refreshState() {
  $('#editor-title').textContent = current ? t('editing') : t('newTitle');
  const saveText = dirty ? t('unsaved') : current ? t('saved') : t('notSaved');
  if ($('#save-state').textContent !== saveText) $('#save-state').textContent = saveText;
  $('#save-state').dataset.state = dirty ? 'unsaved' : current ? 'saved' : 'empty';
  $('#url-hint').textContent = urlFor({lang:field('lang').value,slug:field('slug').value || '…'});
  const canPreview = current && !dirty && previewOrigin;
  $('#preview').setAttribute('aria-disabled', String(!canPreview));
  if (canPreview) $('#preview').href = previewOrigin + urlFor(current); else $('#preview').removeAttribute('href');
  $('#review').disabled = working || !current || dirty || field('draft').checked;
  $('#translation').disabled = working || !current;
  $('#new').disabled = working;
  field('draft').disabled = !!pendingCandidate;
  translator.render();
  deletions.render();
}
function updateCount() {
  $('#word-count').textContent = `${Array.from(field('body').value.replace(/\s/g, '')).length.toLocaleString(ui === 'en' ? 'en-US' : 'zh-CN')} ${t('characters')}`;
}
function closeLibrary() {
  document.body.classList.remove('library-open');
  $('#library-toggle').setAttribute('aria-expanded', 'false');
}
function renderList() {
  const query = $('#filter').value.toLowerCase();
  const list = $('#articles'); list.replaceChildren();
  for (const article of articles.filter(a => (libraryScope === 'all' || (libraryScope === 'draft' ? a.data.draft : a.lang === libraryScope)) && (a.data.title + ' ' + a.lang + ' ' + a.data.tags.join(' ')).toLowerCase().includes(query))) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'article-item';
    const active = article.slug === current?.slug && article.lang === current?.lang;
    button.classList.toggle('active', active); button.setAttribute('aria-current', active ? 'true' : 'false');
    const title = document.createElement('strong'); title.textContent = article.data.title; button.title = article.data.title;
    const meta = document.createElement('small');
    const language = document.createElement('span'); language.className = 'article-language'; language.textContent = article.lang === 'en' ? 'EN' : '中文';
    const date = document.createElement('time'); date.dateTime = article.data.pubDate; date.textContent = article.data.pubDate;
    const status = document.createElement('span'); status.className = 'article-status'; status.textContent = article.data.draft ? t('draft') : t('published');
    meta.append(language,date,status);
    button.append(title,meta); button.addEventListener('click', () => { if (leave()) {selectArticle(article);closeLibrary();if(matchMedia('(max-width: 900px)').matches)$('#editor-title').focus();} }); list.append(button);
  }
  if (!list.children.length) { const empty=document.createElement('p');empty.textContent=t('empty');list.append(empty); }
  $('#categories').replaceChildren(...[...new Set(articles.map(a=>a.data.category))].map(category => { const option=document.createElement('option'); option.value=category; return option; }));
}
function leave() { if (working) {message(t('working'));return false;} return !dirty || confirm(t('discard')); }
function selectArticle(article, translation) {
  form.reset(); current = article; dirty = false; message();
  pendingCandidate = null; translator.selected(article, articles);
  const data = article?.data ?? {lang:translation?.lang ?? 'zh',title:'',description:'',pubDate:new Date().toLocaleDateString('en-CA'),category:translation?.lang === 'en' ? 'Technical Notes' : '技术笔记',draft:true,featured:false,tags:[]};
  for (const name of ['lang','title','description','pubDate','updatedDate','category','cover']) field(name).value = data[name] ?? '';
  field('slug').value = article?.slug ?? translation?.slug ?? '';
  field('tags').value = data.tags.join(', ');
  field('draft').checked = data.draft; field('featured').checked = data.featured;
  field('body').value = article?.body ?? '';
  field('lang').disabled = !!article || !!translation; field('slug').disabled = !!article || !!translation;
  refreshState(); renderList(); updateCount();
}
function collect() {
  const data = {};
  for (const name of ['lang','title','description','pubDate','updatedDate','category','cover']) data[name] = field(name).value.trim();
  data.tags = field('tags').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
  data.tags = [...new Set(data.tags)]; data.draft=field('draft').checked; data.featured=field('featured').checked;
  if (current?.data.translationOf) data.translationOf = current.data.translationOf;
  if (current?.data.translationCandidateId) data.translationCandidateId = current.data.translationCandidateId;
  return {lang:data.lang,slug:field('slug').value.trim(),revision:current?.revision ?? null,data,body:field('body').value,translationCandidate:pendingCandidate};
}
async function run(action) {
  if (working) return;
  working = true; form.inert = true; document.querySelectorAll('form button').forEach(button=>{button.disabled=true;});
  try { await action(); } catch(error) { const unchanged = error.message === 'No local changes to publish.'; message(unchanged ? t('noChanges') : error.message, !unchanged); }
  finally { working=lastJobState==='running';form.inert=working;document.querySelectorAll('form button').forEach(button=>{button.disabled=working;});refreshState(); }
}
const translator = translationDesk({ api, locale:()=>ui, context:()=>({current,dirty,working,pendingCandidate}), message, leave, adopt({candidate,target}) {
  selectArticle({ ...target, slug:candidate.slug, lang:'en', revision:target?.revision ?? null, data:candidate.data, body:candidate.body });
  pendingCandidate = candidate.id; dirty = true; refreshState();
} });
function showReview(reviewed, note) {
  reviewNonce=reviewed.nonce;
  $('#review-summary').textContent=reviewed.title;
  $('#review-dialog [data-i18n=reviewNote]').textContent=note??t('reviewNote');
  $('#review-files').replaceChildren(...reviewed.files.map(file=>{const li=document.createElement('li');li.textContent=file;return li;}));
  $('#review-diff').textContent=reviewed.diff||reviewed.pending;
  $('#review-dialog').showModal();
}
const deletions = deletionDesk({api,locale:()=>ui,context:()=>({current,dirty,working,articles}),run,message,review:showReview,async reload(){
  const state=await api('state');articles=state.articles;translator.update(state.translation);deletions.update(state);
  selectArticle(articles.find(article=>article.slug===current?.slug&&article.lang===current?.lang)??articles[0]??null);
}});
form.addEventListener('input', event => {dirty=true;if(event.target === field('body'))updateCount();refreshState();});
// Native validation must be able to focus required fields inside a collapsed section.
form.addEventListener('invalid', event => {
  let section = event.target.closest('details');
  while (section) { section.open = true; section = section.parentElement.closest('details'); }
}, true);
form.addEventListener('submit', event => {event.preventDefault();if (!form.reportValidity()) return;run(async()=>{
  const saved = await api('save', collect());
  const state = await api('state'); articles = state.articles; translator.update(state.translation); selectArticle(saved); message(saved.translationWarning || t('saveOK'), !!saved.translationWarning);
});});
$('#filter').addEventListener('input',renderList);
document.querySelectorAll('[data-scope]').forEach(button=>button.addEventListener('click',()=>{
  libraryScope=button.dataset.scope;
  document.querySelectorAll('[data-scope]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  renderList();
}));
$('#library-toggle').addEventListener('click',()=>{
  const open=document.body.classList.toggle('library-open');
  $('#library-toggle').setAttribute('aria-expanded',String(open));
  if(open)$('#filter').focus();
});
$('#new').addEventListener('click',()=>{if(leave()){selectArticle(null);closeLibrary();field('title').focus();}});
document.querySelectorAll('[data-format]').forEach(button=>button.addEventListener('click',()=>{
  const area=field('body'), start=area.selectionStart, end=area.selectionEnd, selected=area.value.slice(start,end);
  const formats={heading:['## ', '', t('headingText')],bold:['**','**',t('boldText')],link:['[','](https://)',t('linkText')],code:['```\n','\n```',t('codeText')]};
  const [prefix,suffix,placeholder]=formats[button.dataset.format];
  const block=button.dataset.format==='heading'||button.dataset.format==='code';
  const before=block&&start>0&&area.value[start-1]!=='\n'?'\n':'';
  const after=block&&end<area.value.length&&area.value[end]!=='\n'?'\n':'';
  const text=selected||placeholder;
  area.focus();area.setSelectionRange(start,end);
  // Unlike setRangeText, insertText preserves the textarea's native Undo history.
  // https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand
  if(!document.execCommand('insertText',false,before+prefix+text+suffix+after)){message(t('formatUnavailable'));return;}
  area.setSelectionRange(start+before.length+prefix.length,start+before.length+prefix.length+text.length);
  area.dispatchEvent(new Event('input',{bubbles:true}));
}));
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'&&!document.querySelector('dialog[open]')){
    event.preventDefault();if(!working)form.requestSubmit();
  }
  if(event.key==='Escape'&&document.body.classList.contains('library-open')){closeLibrary();$('#library-toggle').focus();}
});
$('#ui-language').addEventListener('click',()=>{ui=ui==='en'?'zh':'en';localStorage.setItem('flandolu-editor-language',ui);applyLanguage();});
$('#translation').addEventListener('click',()=>{
  if (!current || !leave()) return;
  const target={slug:current.slug,lang:current.lang==='en'?'zh':'en'};
  const existing=articles.find(a=>a.slug===target.slug&&a.lang===target.lang);
  selectArticle(existing??null, existing?undefined:target);
  if(!existing)message(t('translating'));
});
$('#preview').addEventListener('click',event=>{if(!current||dirty||!previewOrigin){event.preventDefault();message(!previewOrigin?(ui==='en'?'Local preview is not ready. Check the terminal.':'本地预览尚未就绪，请查看启动窗口。'):t('saveFirst'),true);}});
$('#upload').addEventListener('click',()=>$('#image-file').click());
$('#image-file').addEventListener('change',event=>run(async()=>{
  const file=event.target.files[0];if(!file)return;
  if(file.size>8_000_000)throw new Error(t('chooseImage'));
  const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
  const result=await api('upload',{base64});
  const area=field('body');area.setRangeText(`\n![${ui==='en'?'Image description':'图片描述'}](${result.path})\n`,area.selectionStart,area.selectionEnd,'end');
  dirty=true;updateCount();message(t('uploaded'));event.target.value='';
}));
$('#review').addEventListener('click',()=>run(async()=>{
  if(!current||dirty)throw new Error(t('saveFirst'));
  const reviewed=await api('review',{slug:current.slug,lang:current.lang});
  showReview(reviewed);
}));
$('#cancel').addEventListener('click',()=>$('#review-dialog').close());
$('#publish').addEventListener('click',()=>run(async()=>{
  $('#review-dialog').close();const job=await api('publish',{nonce:reviewNonce});renderJob(job);message(t('running'));
}));
function renderJob(job) {
  if(!job)return;
  $('#job').hidden=false;$('#job-log').textContent=job.log.replace(/\x1b\[[0-9;]*m/g,'');
  $('#job-status').textContent=job.state==='running'?t('running'):job.state==='failed'?t('failed')+' '+job.error:t('pushed')+' '+job.result.commit.slice(0,7);
  if(job.state==='complete'){
    let link=$('#live-article');
    if(!link){link=document.createElement('a');link.id='live-article';link.target='_blank';link.rel='noopener noreferrer';$('#job').append(document.createElement('br'),link);}
    link.href=job.result.url;link.textContent=job.result.kind==='deletion'?(ui==='en'?'Open live blog ↗':'打开正式博客 ↗'):t('openLive');
  }
  if(job.state!==lastJobState){
    lastJobState=job.state;
    if(job.state==='running'){working=true;form.inert=true;}
    else {
      working=false;form.inert=false;
      document.querySelectorAll('form button').forEach(button=>{button.disabled=false;});
      refreshState();
      if(job.state==='failed')message(t('failed')+' '+job.error,true);
      else if(job.state==='complete')message(t('pushed'));
    }
  }
}
window.addEventListener('beforeunload',event=>{if(dirty||working){event.preventDefault();event.returnValue='';}});
try {
  const state=await api('state');articles=state.articles;previewOrigin=state.preview;translator.update(state.translation);deletions.update(state);selectArticle(articles[0]??null);applyLanguage();renderJob(state.job);
  let lastPreviewError='';
  setInterval(async()=>{try{const state=await api('state');previewOrigin=state.preview;translator.update(state.translation);deletions.update(state);refreshState();renderJob(state.job);if(state.previewError&&state.previewError!==lastPreviewError){lastPreviewError=state.previewError;message(state.previewError,true);}}catch{/* Keep form intact if terminal closes. */}},2500);
} catch(error) {message(error.message,true);}
