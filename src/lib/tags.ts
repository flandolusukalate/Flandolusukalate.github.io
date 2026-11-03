import { localizedPath, otherLocale, type Locale } from './i18n';
const pairs: Record<string, string> = {
  '前端':'Frontend', '日常':'Daily Life', '思考':'Reflections', '数字花园':'Digital Garden',
  '学习笔记':'Study Notes', '效率':'Productivity', '个人博客':'Personal Blog', '网站建设':'Website Development',
  '记录':'Notes', '灵感':'Inspiration', '创作':'Creation', '生活':'Life', '随笔':'Essays',
};
export function translatedTagPath(tag: string, locale: Locale, available: string[]) {
  const target = locale === 'zh' ? pairs[tag] ?? tag : Object.keys(pairs).find(key=>pairs[key]===tag) ?? tag;
  return localizedPath(available.includes(target) ? `/tags/${encodeURIComponent(target)}/` : '/blog/', otherLocale(locale));
}
