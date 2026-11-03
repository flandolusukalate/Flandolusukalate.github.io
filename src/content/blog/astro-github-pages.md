---
title: "从 Astro 到 GitHub Pages：博客技术选型"
description: "用静态生成、Markdown 与自动部署，建立一个易维护的个人博客。"
pubDate: 2026-11-02
category: "技术笔记"
tags: ["Astro", "GitHub", "前端"]
cover: "/illustrations/magic-book-library.webp"
featured: true
draft: false
series: "博客开发日志"
seriesOrder: 1
---

> 示例技术文章：用于展示博客的目录、代码块、引用、列表和排版。正式上线后可继续补充实际开发经验。

## 为什么选择静态网站？

对于以阅读为主的个人博客，静态网站是一个简洁的起点。文章和页面在构建阶段转换为 HTML，访问时不需要一个常驻应用服务器。

这也意味着一些交互功能需要额外方案：例如全文搜索可以预先生成索引，评论可以利用第三方服务。

## 框架选择

Astro 适合内容优先的网站。它能够从 Markdown 文件加载文章、构建页面并生成静态资源。

一个简单的文章文件通常包含：

```yaml
---
title: "我的第一篇文章"
pubDate: 2026-11-03
tags: ["随笔"]
---
```

正文只需要继续使用 Markdown 编写即可。

## 自动化发布

使用 GitHub Actions 后，每次推送代码都可以执行自动构建和部署。

整个过程可以分为三个阶段：

1. 从 GitHub 仓库读取源代码。
2. 安装依赖并构建 Astro 网站和搜索索引。
3. 将静态产物发布到 GitHub Pages。

## 维护比功能数量更重要

长期更新时，统一的内容结构、易读的文章布局和可复用组件，比复杂的动画和功能更重要。

在此基础上逐步添加搜索、RSS、评论与更多个人化设计，网站才会越用越顺手。
