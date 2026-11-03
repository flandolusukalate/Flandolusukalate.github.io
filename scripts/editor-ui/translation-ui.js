const $ = selector => document.querySelector(selector);
const copy = {
  heading:['英文译文','English translation'], settings:['翻译设置','Translation settings'],
  generate:['生成／更新英文','Generate / update English'], review:['检查候选译文','Review candidate'], source:['对照中文原文','Chinese source'],
  privacy:['所选中文文章的标题、摘要、分类、标签和正文会发送给 DeepSeek，按其 API 用量计费。生成不会发布。','The selected Chinese article’s title, summary, category, tags and body are sent to DeepSeek and billed at its API rates. Generation does not publish.'],
  keyNote:['密钥经 Windows 当前账户加密后保存在本机，不进入仓库。已配置时留空可保留原密钥。','Windows encrypts the key for your account and stores it locally, outside the repository. Leave blank to keep an existing key.'],
  getKey:['在 DeepSeek 创建 API Key ↗','Create a DeepSeek API key ↗'], model:['模型','Model'],
  automatic:['保存中文变更后，自动生成英文候选译文','Automatically generate an English candidate after saving Chinese changes'],
  removeKey:['移除密钥','Remove key'], close:['关闭','Close'], saveSettings:['保存设置','Save settings'],
  candidateTitle:['检查英文候选译文','Review the English candidate'], candidateEnglish:['英文候选译文','English candidate'],
  candidateNote:['载入后可修改标题、摘要、标签和正文。已有英文在保存前保持不变；请先保存为草稿，审阅后再取消草稿并发布。','After loading, edit the title, summary, tags and body. Existing English stays unchanged until you save. Save as a draft first; after reviewing, uncheck Draft and publish.'],
  adopt:['载入英文草稿以修改','Load English draft for editing'],
  missing:['先在「翻译设置」配置 DeepSeek；也可以继续手动编辑另一语言。','Configure DeepSeek in Translation settings, or keep editing the other language manually.'],
  saveFirst:['请先保存中文文章，再生成译文。','Save the Chinese article before generating a translation.'],
  running:['正在生成英文候选译文，请保持编辑器启动窗口运行…','Generating an English candidate. Keep the editor’s terminal running…'],
  stale:['原文或英文已修改，旧候选译文不可采用。请重新生成。','Chinese or English changed. Generate again before adopting this candidate.'],
  ready:['候选译文已就绪；请检查并载入编辑，已有英文尚未改变。','Candidate ready. Review and load it for editing; existing English is unchanged.'],
  current:['英文对应当前中文版本。后续改动可重新生成。','English matches this Chinese version. Generate again after changes.'],
  outdated:['中文已更新，英文需要重新翻译并审阅。','Chinese was updated. Generate and review a new English version.'],
  manual:['可生成英文候选译文，或继续手动维护已有英文。','Generate an English candidate, or continue maintaining English manually.'],
  automaticOn:['自动生成已开启；保存中文变更后，候选译文会出现在这里。','Automatic generation is on. Save Chinese changes to create a candidate here.'],
  configured:['已配置；留空保留原密钥。','Configured. Leave blank to retain the key.'],
  notConfigured:['尚未配置 API Key。','No API key configured.'],
  environment:['由 DEEPSEEK_API_KEY 环境变量提供；请在终端修改。','Provided by DEEPSEEK_API_KEY; change it in your terminal.'],
  savedSettings:['设置已保存。','Settings saved.'],
  loaded:['候选译文已载入。可以对照中文修改；先保存为草稿，再审阅发布。','Candidate loaded. Edit alongside the Chinese source; save as a draft before reviewing and publishing.'],
  localDraft:['候选译文正在编辑；首次保存必须保持“草稿”。','Editing a candidate. Keep Draft checked for the first save.'],
  failed:['生成未完成，已有英文已保留。','Generation failed; existing English is unchanged.'],
  replace:['重新生成会替换尚未采用的候选译文，是否继续？','Generate again and replace the unadopted candidate?']
};
const readable = article => [article.data.title, article.data.description, `${article.data.category} · ${article.data.tags.join(', ')}`, article.body].join('\n\n');

export function translationDesk({ api, context, locale, message, leave, adopt }) {
  let state = { settings:{}, pairs:{}, job:null }, candidate = null, requesting = false, source = null;
  const t = name => copy[name]?.[locale() === 'en' ? 1 : 0] ?? name;
  function render() {
    document.querySelectorAll('[data-tr]').forEach(element => { element.textContent = t(element.dataset.tr); });
    const { current, dirty, working, pendingCandidate } = context(), pair = state.pairs[current?.slug];
    const running = state.job?.state === 'running', sameJob = !!state.job && state.job.slug === current?.slug;
    let status = !state.settings.configured ? t('missing') : !current ? t('saveFirst') : t(state.settings.automatic ? 'automaticOn' : 'manual');
    if (pair?.translatedHash) status = t(pair.translatedHash === pair.sourceHash ? 'current' : 'outdated');
    if (pair?.candidate) status = t(pair.candidate.stale ? 'stale' : 'ready');
    if (sameJob && state.job.state === 'failed') status = t('failed') + ' ' + state.job.error;
    if (sameJob && running) status = t('running');
    if (pendingCandidate) status = t('localDraft');
    $('#translation-status').textContent = status;
    $('#translation-status').classList.toggle('error', sameJob && state.job?.state === 'failed');
    $('#generate-translation').disabled = requesting || working || running || dirty || !current || current.lang !== 'zh' || !state.settings.configured;
    $('#generate-translation').hidden = current?.lang === 'en';
    $('#review-translation').hidden = !pair?.candidate;
    $('#review-translation').disabled = requesting || working || running || !!pair?.candidate?.stale;
    $('#translation-settings').disabled = working || requesting || running;
    $('#adopt-translation').disabled = requesting;
    $('#translation-source').hidden = !source || current?.lang !== 'en';
    if (source) $('#translation-original').textContent = readable(source);
  }
  async function action(callback, reportError = text => message(text, true)) {
    if (requesting) return;
    requesting = true; render();
    try { await callback(); } catch (error) { reportError(error.message); }
    finally { requesting = false; render(); }
  }
  $('#translation-settings').addEventListener('click', () => {
    $('#deepseek-key').value = ''; $('#deepseek-key').disabled = state.settings.fromEnvironment;
    $('#deepseek-model').value = state.settings.model || 'deepseek-flash';
    $('#auto-translate').checked = state.settings.automatic;
    $('#key-status').textContent = t(state.settings.fromEnvironment ? 'environment' : state.settings.configured ? 'configured' : 'notConfigured');
    $('#clear-deepseek-key').disabled = !state.settings.configured || state.settings.fromEnvironment;
    $('#translation-settings-message').textContent = '';
    $('#translation-settings-dialog').showModal();
  });
  async function saveSettings(clearKey = false) {
    const settingsForm = $('#translation-settings-form'); settingsForm.inert = true;
    try {
      state.settings = await api('translation-settings', { key:clearKey ? '' : $('#deepseek-key').value.trim(), clearKey, model:$('#deepseek-model').value, automatic:$('#auto-translate').checked });
      $('#deepseek-key').value = ''; $('#translation-settings-dialog').close(); message(t('savedSettings')); render();
    } catch (error) { $('#translation-settings-message').textContent = error.message; }
    finally { settingsForm.inert = false; }
  }
  $('#translation-settings-form').addEventListener('submit', event => { event.preventDefault(); saveSettings(); });
  $('#clear-deepseek-key').addEventListener('click', () => saveSettings(true));
  $('#close-translation-settings').addEventListener('click', () => { $('#deepseek-key').value = ''; $('#translation-settings-dialog').close(); });
  $('#translation-settings-dialog').addEventListener('close', () => { $('#deepseek-key').value = ''; });
  $('#generate-translation').addEventListener('click', () => action(async () => {
    const { current } = context();
    if (state.pairs[current.slug]?.candidate && !confirm(t('replace'))) return;
    await api('translate', { slug:current.slug, revision:current.revision });
    state = (await api('state')).translation;
  }));
  $('#review-translation').addEventListener('click', () => action(async () => {
    const slug = context().current.slug;
    candidate = await api('translation-candidate', { slug, id:state.pairs[slug].candidate.id });
    $('#candidate-error').textContent = '';
    $('#candidate-source').textContent = readable(candidate.candidate.source);
    $('#candidate-english').textContent = readable(candidate.candidate);
    $('#translation-review-dialog').showModal();
  }));
  $('#close-translation-review').addEventListener('click', () => $('#translation-review-dialog').close());
  $('#adopt-translation').addEventListener('click', () => action(async () => {
    $('#candidate-error').textContent = '';
    const checked = await api('translation-candidate', { slug:candidate.candidate.slug, id:candidate.candidate.id });
    if (context().current?.slug !== checked.candidate.slug || !leave()) return;
    adopt(checked); source = checked.candidate.source;
    $('#translation-review-dialog').close(); message(t('loaded'));
  }, error => { $('#candidate-error').textContent = error; }));
  return { render, update(next) { state = next; render(); }, selected(article, articles) { source = article?.lang === 'en' ? articles.find(a => a.lang === 'zh' && a.slug === article.slug) : null; } };
}
