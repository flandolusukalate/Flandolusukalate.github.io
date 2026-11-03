const $ = selector => document.querySelector(selector);
const copy = {
  delete:['删除文章','Delete article'],trash:['已删除的文章','Deleted articles'],
  trashNote:['本地副本可恢复；发布删除后，正式网站才会更新。','Local backups can be restored. Publish a deletion to update the live website.'],
  confirmTitle:['删除这篇文章？','Delete this article?'],
  note:['文章会从本地书架移除，并保留可恢复的副本。图片不会删除。正式网站需另行发布删除才会更新。','The article will leave your local library, with a recoverable backup. Images are kept. Publish the deletion separately to update the live website.'],
  alsoEnglish:['同时删除英文版','Also delete the English version'],
  keepEnglish:['未勾选时，英文版会保留。','The English version is kept unless selected.'],
  noEnglish:['没有对应的英文版，仅删除中文。','There is no English version; only Chinese will be deleted.'],
  englishOnly:['仅删除当前英文版，中文版会保留。','Only this English version will be deleted; Chinese is kept.'],
  cancel:['取消','Cancel'],confirm:['确认删除','Confirm deletion'],restore:['恢复到书架','Restore to library'],publish:['发布删除','Publish deletion'],
  pending:['待发布删除','Deletion not published'],published:['删除已推送','Deletion pushed'],local:['仅本地文章，无需发布删除','Local-only article; no deletion to publish'],
  removed:['已从本地书架移除，可在“已删除的文章”中恢复或发布删除。','Removed locally. Restore or publish the deletion under Deleted articles.'],
  restored:['已恢复到本地书架；如需重新上线，请按正常流程发布文章。','Restored locally. Use the usual publication flow to put it back online if needed.'],
  saveFirst:['请先保存当前修改，再删除文章。','Save your current changes before deleting.'],
  finishPush:['请先重试发布删除，完成推送后可恢复。','Retry publishing the deletion before restoring.'],
  reviewNote:['只提交清单中的文章删除。检查和构建通过后推送到 GitHub；部署完成后网站才会移除这些文章。图片和本地恢复副本不会上传。','Only the listed article deletions will be committed. Checks and the build must pass before pushing. The website removes them after deployment. Images and local recovery backups are not included.']
};
export function deletionDesk({api,context,locale,run,message,reload,review}) {
  let records=[], translationRunning=false, selected=null, english=null, signature='';
  const t = name => copy[name]?.[locale()==='en'?1:0] ?? name;
  function renderFiles() {
    const files = [selected?.file,...($('#delete-english').checked&&english?[english.file]:[])].filter(Boolean);
    $('#delete-files').replaceChildren(...files.map(file=>{const item=document.createElement('li');item.textContent=file;return item;}));
  }
  function render() {
    document.querySelectorAll('[data-deletion]').forEach(el=>{el.textContent=t(el.dataset.deletion);});
    const {current,dirty,working}=context(), blocked=working||translationRunning;
    $('#delete-article').hidden=!current;
    $('#delete-article').disabled=blocked||dirty||!current;
    $('#delete-article').title=dirty?t('saveFirst'):t('delete');
    for(const id of ['confirm-delete','cancel-delete','delete-english'])$('#'+id).disabled=working;
    $('#deleted-articles').hidden=!records.length;
    if(selected)$('#delete-language-note').textContent=t(selected.lang==='en'?'englishOnly':english?'keepEnglish':'noEnglish');
    const next=JSON.stringify([records,locale(),blocked,dirty]);
    if(next===signature)return;
    signature=next;
    $('#deletion-list').replaceChildren(...records.map(record=>{
      const row=document.createElement('div');row.className='deletion-row';
      const info=document.createElement('div'),title=document.createElement('strong'),status=document.createElement('small');
      title.textContent=record.title;status.textContent=t(record.status);info.append(title,status);row.append(info);
      const restore=document.createElement('button');restore.type='button';restore.textContent=t('restore');restore.disabled=blocked||dirty||!!(record.commit&&record.status!=='published');
      if(record.commit&&record.status!=='published')restore.title=t('finishPush');
      restore.addEventListener('click',()=>run(async()=>{await api('restore-deletion',{id:record.id});await reload();message(t('restored'));}));row.append(restore);
      if(record.status==='pending'&&record.publishable){
        const publish=document.createElement('button');publish.type='button';publish.textContent=t('publish');publish.disabled=blocked||dirty;
        publish.addEventListener('click',()=>run(async()=>{review(await api('review-deletion',{id:record.id}),t('reviewNote'));}));row.append(publish);
      }
      return row;
    }));
  }
  $('#delete-article').addEventListener('click',()=>{
    const {current,dirty,working,articles}=context();if(!current||dirty||working||translationRunning)return;
    selected=current;english=current.lang==='zh'?articles.find(a=>a.slug===current.slug&&a.lang==='en'):null;
    $('#delete-name').textContent=current.data.title;
    $('#delete-english').checked=false;$('#delete-english-label').hidden=!english;
    $('#delete-error').textContent='';renderFiles();render();$('#delete-dialog').showModal();
  });
  $('#delete-english').addEventListener('change',renderFiles);
  $('#cancel-delete').addEventListener('click',()=>$('#delete-dialog').close());
  $('#delete-dialog').addEventListener('cancel',event=>{if(context().working)event.preventDefault();});
  $('#confirm-delete').addEventListener('click',()=>run(async()=>{
    render();
    try {
      await api('delete',{slug:selected.slug,lang:selected.lang,revision:selected.revision,includeEnglish:$('#delete-english').checked,englishRevision:english?.revision});
      $('#delete-dialog').close();await reload();message(t('removed'));
    } catch(error){$('#delete-error').textContent=error.message;}
  }));
  return {render,update(state){records=state.deletions??[];translationRunning=state.translation?.job?.state==='running';render();}};
}
