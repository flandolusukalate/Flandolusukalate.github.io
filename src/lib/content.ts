import { getCollection } from 'astro:content';

export async function getPosts() {
  const entries = await getCollection('blog', ({ data }) => !data.draft);
  return entries.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getProjects() {
  const entries = await getCollection('projects', ({ data }) => !data.draft);
  return entries.sort((a, b) => Number(b.data.featured) - Number(a.data.featured));
}

export async function getMoments() {
  const entries = await getCollection('moments', ({ data }) => !data.draft);
  return entries.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(value);
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
