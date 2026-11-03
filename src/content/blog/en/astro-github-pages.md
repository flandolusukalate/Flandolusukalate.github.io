---
lang: en
title: "From Astro to GitHub Pages: Choosing a Blog Stack"
description: "Building an easy-to-maintain personal blog with static generation, Markdown, and automated deployment."
pubDate: 2026-11-02
category: "Technical Notes"
tags: ["Astro", "GitHub", "Frontend"]
cover: "/illustrations/magic-book-library.webp"
featured: true
draft: false
series: "Blog Development Log"
seriesOrder: 1
---

> Sample technical article: this post demonstrates the blog's table of contents, code blocks, quotations, lists, and typography. More lessons from actual development can be added after launch.

## Why choose a static website?

For a personal blog focused on reading, a static website is a straightforward starting point. Posts and pages are converted into HTML at build time, so serving them does not require a continuously running application server.

This also means that some interactive features need additional solutions. For example, full-text search can use a pregenerated index, while comments can rely on a third-party service.

## Choosing a framework

Astro works well for content-first websites. It can load posts from Markdown files, build pages, and generate static assets.

A simple post file typically includes:

```yaml
---
title: "My First Post"
pubDate: 2026-11-03
tags: ["Essays"]
---
```

The rest of the post can simply be written in Markdown.

## Automated publishing

With GitHub Actions, each code push can trigger an automated build and deployment.

The process can be divided into three stages:

1. Read the source code from the GitHub repository.
2. Install dependencies and build the Astro website and search index.
3. Publish the static output to GitHub Pages.

## Maintenance matters more than the number of features

When updating a site over the long term, a consistent content structure, readable article layouts, and reusable components matter more than complex animations and features.

Gradually adding search, RSS, comments, and more personal design touches to this foundation will make the site more comfortable to use over time.
