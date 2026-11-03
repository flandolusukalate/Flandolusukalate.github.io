import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { digest, getArticle, identity, safePath } from './articles.mjs';
import { translateArticle } from './deepseek.mjs';
import { writeJsonAtomically } from './atomic-json.mjs';

export function sourceHash(article) {
  const { title, description, category, tags, pubDate, updatedDate, cover, featured } = article.data;
  return digest(JSON.stringify({ title, description, category, tags, pubDate, updatedDate, cover, featured, body:article.body }));
}
export function translations(root, settings, translate = translateArticle) {
  let job = null;
  const candidatePath = async slug => { identity({slug,lang:'zh'}); return safePath(root, `.local-editor/translations/${slug}.json`); };
  async function readCandidate(slug) {
    try { return JSON.parse(await readFile(await candidatePath(slug), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async function pair(slug) {
    return Promise.all([getArticle(root, {slug,lang:'zh'}), getArticle(root, {slug,lang:'en'})]);
  }
  async function start({ slug, revision, automatic = false }) {
    const [source, target] = await pair(slug);
    if (!source || source.revision !== revision) throw new Error('中文已改变，请重新保存或刷新。 / Chinese changed; save or reload first.');
    const hash = sourceHash(source), previous = await readCandidate(slug);
    if (automatic && (target?.data.translationOf === hash || previous?.sourceHash === hash)) return;
    if (job?.state === 'running') throw new Error('另一篇文章正在翻译，请完成后手动生成。 / Another translation is running; generate manually when it finishes.');
    const credentials = await settings.credentials();
    job = { slug, state:'running' };
    // The request never writes article files. A successful candidate remains local
    // across restarts until the owner explicitly adopts and saves it as a draft.
    (async () => {
      const translated = await translate(source, credentials);
      const id = randomUUID();
      const candidate = { id, slug, sourceHash:hash, targetRevision:target?.revision ?? null, model:credentials.model, created:new Date().toISOString(), source, data:{ ...source.data, ...translated, lang:'en', draft:true, translationOf:hash, translationCandidateId:id }, body:translated.body };
      delete candidate.data.body;
      const path = await candidatePath(slug);
      await writeJsonAtomically(path, candidate);
      job = { slug, state:'complete' };
    })().catch(error => { job = { slug, state:'failed', error:error.message }; });
  }
  async function candidateForReview({ slug, id }) {
    const candidate = await readCandidate(slug), [source, target] = await pair(slug);
    if (!candidate || (id && id !== candidate.id)) throw new Error('候选译文已改变，请刷新。 / Candidate changed; reload.');
    if (!source || sourceHash(source) !== candidate.sourceHash) throw new Error('中文已更新，请重新生成译文。 / Chinese has changed; generate a new translation.');
    if ((target?.revision ?? null) !== candidate.targetRevision) throw new Error('英文已修改，请重新生成，避免覆盖人工编辑。 / English changed; generate again to preserve manual edits.');
    return { candidate, target };
  }
  return {
    start, candidateForReview,
    async afterSave(article) {
      if (article.lang !== 'zh' || !settings.publicState().automatic) return;
      try { await start({ ...article, automatic:true }); }
      catch (error) { return error.message; }
    },
    async validateSave(input) {
      if (!input.translationCandidate) return;
      const { candidate } = await candidateForReview({ slug:input.slug, id:input.translationCandidate });
      if (input.lang !== 'en' || input.data.translationOf !== candidate.sourceHash || input.data.translationCandidateId !== candidate.id || input.data.draft !== true || input.revision !== candidate.targetRevision) throw new Error('请先将候选译文保存为草稿，再审阅发布。 / Save the candidate as a draft before reviewing and publishing.');
    },
    async state(articles) {
      const pairs = {};
      for (const source of articles.filter(article => article.lang === 'zh')) {
        const candidate = await readCandidate(source.slug), target = articles.find(article => article.slug === source.slug && article.lang === 'en');
        const hash = sourceHash(source);
        pairs[source.slug] = { sourceHash:hash, translatedHash:target?.data.translationOf ?? null, candidate: candidate && target?.data.translationCandidateId !== candidate.id ? { id:candidate.id, stale:candidate.sourceHash !== hash || candidate.targetRevision !== (target?.revision ?? null) } : null };
      }
      return { settings:settings.publicState(), job, pairs };
    }
  };
}
