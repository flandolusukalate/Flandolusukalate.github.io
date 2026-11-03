import { getCollection, type CollectionEntry } from 'astro:content';
import { localizedPath, otherLocale, type Locale } from './i18n';

type Entry = CollectionEntry<'blog' | 'projects' | 'moments'>;
export const slugOf = (entry: Entry) => entry.id.replace(/^en\//, '');
export const entryPath = (entry: Entry) => localizedPath(`/${entry.collection}/${slugOf(entry)}/`, entry.data.lang);
const visible = (entry: Entry, locale: Locale) => entry.data.lang === locale && (import.meta.env.DEV || !entry.data.draft);

export async function getPosts(locale: Locale = 'zh') {
  const entries = await getCollection('blog', entry => visible(entry, locale));
  return entries.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getProjects(locale: Locale = 'zh') {
  const entries = await getCollection('projects', entry => visible(entry, locale));
  return entries.sort((a, b) => Number(b.data.featured) - Number(a.data.featured));
}

export async function getMoments(locale: Locale = 'zh') {
  const entries = await getCollection('moments', entry => visible(entry, locale));
  return entries.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function alternateEntryPath(entry: CollectionEntry<'blog' | 'projects'>) {
  const translated = (await getCollection(entry.collection)).find(candidate =>
    candidate.data.lang === otherLocale(entry.data.lang) && slugOf(candidate) === slugOf(entry) && (import.meta.env.DEV || !candidate.data.draft));
  return translated ? entryPath(translated) : null;
}

export function formatDate(value: Date, locale: Locale = 'zh') {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(value);
}

export function readingTime(body?: string) {
  const words = ((body ?? '').match(/[\u4e00-\u9fff]|[A-Za-z0-9_]+/g) ?? []).length;
  return Math.max(1, Math.ceil(words / 300));
}

export const statusLabel = {
  planned: '构思中',
  developing: '开发中',
  released: '已发布',
  archived: '已归档',
};
