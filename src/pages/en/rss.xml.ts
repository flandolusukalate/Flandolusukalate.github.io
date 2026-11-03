import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPosts, entryPath } from '../../lib/content';
import { site } from '../../config';
import { translator } from '../../lib/i18n';

export const GET: APIRoute = async ({ site: base }) => rss({
  title: site.title,
  description: translator('en')(site.description),
  site: base!,
  customData: '<language>en</language>',
  items: (await getPosts('en')).map(post => ({
    title: post.data.title,
    description: post.data.description,
    pubDate: post.data.pubDate,
    link: entryPath(post),
  })),
});
