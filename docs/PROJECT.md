# Flandolu's Space ✦

一间以「梦幻数字书房」为主题的个人博客、项目集与生活记录空间。

> 现已增加本地浏览器文章管理和中英双语版本。使用方法见 [写作与发布指南](WRITING.md)。文章、项目与动态仍保留明确标注的示例内容，需由站主逐步替换。评论区尚未开启。

## 技术栈

- Astro（静态站点生成）
- TypeScript
- Tailwind CSS 4 / CSS 设计变量
- Astro Content Collections（Markdown / MDX）
- Pagefind（构建时分别生成中英文搜索索引）
- GitHub Actions → GitHub Pages

## 本地启动

要求 Node.js 24。

```bash
npm ci
npm run dev
```

生产构建与校验：

```bash
npm run check
npm run build
```

`dist/` 是生成的静态网站。站内搜索需要 `npm run build` 中的 Pagefind 步骤才能生成索引；开发模式中搜索可能不可用。

## 添加文章

在 `src/content/blog/` 新建 `.md` 或 `.mdx` 文件：

```markdown
---
title: "文章标题"
description: "简短介绍"
pubDate: 2026-11-03
category: "技术笔记"
tags: ["Python", "学习"]
cover: "/illustrations/magic-book-library.webp"
featured: false
draft: false
---

## 正文

从这里开始。
```

文件名决定文章 URL，例如 `hello-world.md` 对应 `/blog/hello-world/`。尽量不要频繁改名，以免旧链接失效。

使用 `draft: true` 可在公开构建中隐藏文章；同样也适用于项目和动态。

项目使用 `src/content/projects/`，动态使用 `src/content/moments/`，字段定义在 `src/content.config.ts`。

## 发布到 GitHub Pages

1. 创建公开仓库 `flandolusukalate.github.io`，默认分支 `main`。
2. 将此项目的源文件（包含 `.github/workflows/deploy.yml`）推送至仓库。
3. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 工作流安装依赖、构建 Astro、生成 Pagefind 搜索索引并部署。
5. 成功后访问 `https://flandolusukalate.github.io/`。

若未来绑定独立域名，请同步更新 `astro.config.mjs` 的 `site` 和 `public/robots.txt` 中的站点地址。

## 个性化修改

- 网站标题、作者与 GitHub 链接：`src/config.ts`
- 全站颜色与尺寸：`src/styles/global.css`
- 顶部导航：`src/components/Header.astro`
- 首页模块：`src/pages/index.astro`
- 封面与角色素材：`public/illustrations/`

初始插画由 AI 生成。建议将个人真实项目内容与示例文案区分开。

## 当前范围

已经实现：首页、文章、分类、标签、归档、文章目录、项目详情、动态、关于、RSS、Pagefind 全文搜索、404、明暗主题、响应式布局与自动部署配置。

待站主配置：Giscus 评论（需要仓库 Discussions）、自定义域名（可选）、真实文章与作品。

请不要把 API 密钥、私人凭据或支付信息提交到公开仓库。
