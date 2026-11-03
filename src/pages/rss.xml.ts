import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPosts } from '../lib/content';
import { site } from '../config';

export const GET: APIRoute = async ({ site: base }) => {
  const posts = await getPosts();
  return rss({
    title: site.title,
    description: site.description,
    site: base!,
    items: posts.map(post => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
    })),
  });
};
