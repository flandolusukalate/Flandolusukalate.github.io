# 用浏览器管理博客 / Writing Desk

## 开始使用

Windows 双击项目根目录的 **Start-Writing.cmd**，浏览器会打开本地文章书桌。
也可以在项目目录运行：

```sh
npm ci
npm run editor
```

需要 Node.js 24 和已登录 GitHub 的 Git。已安装依赖时不必重复运行 `npm ci`。
编辑器默认地址是 `http://127.0.0.1:4311/`；文章预览默认使用 4321 端口。
保持启动窗口运行，关闭时按 Ctrl+C。编辑器只监听本机，不会部署到 GitHub Pages。

## 新建、修改与发布

1. 点击「＋ 新文章」，或从左侧选中现有文章。
2. 选择文章语言，填写网址名称，例如 `my-first-post`。使用小写字母、数字和连字符；保存后不允许在表单中更改，以免已有链接失效。
3. 填写标题、摘要、发布日期、分类、标签和 Markdown 正文。更新已有文章时可填写更新日期。
4. 点击「保存到本机」。保存不会提交或上传。正文和其他原有 frontmatter 字段仍保存在 Markdown 文件中。
5. 点击「预览文章」，检查真实网站中的排版、目录、代码和图片。开发预览包含草稿，并显示预览提示。
6. 准备发布时取消「草稿」，再次保存，点击「检查并发布」。
7. 核对文章及图片文件清单、Markdown 改动，点击「构建并发布到 GitHub」。
8. 等待内容检查、Astro 检查、构建、搜索索引和 Git 推送完成，再打开「GitHub 部署进度」。Actions 成功后实际访问正式文章确认效果。

**注意：**“已保存”表示本地文件已保存；“可发布”表示没有标记草稿，并不表示已经上线。发布日期用于展示与排序，**不是定时发布任务**。

编辑器只提交本次选择的文章和它引用的 `public/uploads/` 图片，不会自动提交其他文章、草稿或代码。
需要在 `main` 分支上发布，且不能存在其他已暂存文件、未完成的代码修改或远程新提交。
草稿不会进入正式页面、归档、RSS、搜索索引和 sitemap；但如果手动把草稿源码提交到公开 GitHub 仓库，任何人都能读取源码。

## 中英版本

点击「编辑另一语言」可打开对应译文；没有译文时会生成同名文章的新表单。
请自行填写译文，工具不会自动调用在线翻译服务，也不需要 API Key。

| 语言 | 文件 | 网站地址 |
| --- | --- | --- |
| 中文 | `src/content/blog/my-first-post.md` | `/blog/my-first-post/` |
| English | `src/content/blog/en/my-first-post.md` | `/en/blog/my-first-post/` |

两种语言通过相同文件名关联，各自保存和发布。英文 frontmatter 包含 `lang: en`。
已有中文文件省略 lang 时默认为中文。页面右上角可切换中英，手机上在菜单末尾切换。
若另一语言尚未发布，文章页会标明暂无译文，不会跳转到不存在的页面。
分类、标签、搜索与 RSS 分别按当前语言展示。

## 图片与 Markdown

「插入图片」支持 8 MB 以内的 PNG、JPEG、WebP、GIF，自动写入 `public/uploads/` 并插入 Markdown。
请把“图片描述”替换成恰当的替代文字。封面设置可填写相同图片路径；留空沿用原有书房插画。
建议自行压缩图片后上传。删除正文中的引用不会自动删除图片文件。

```md
## 二级标题

正文可使用 **加粗**、[链接](https://example.com) 和列表。

![图片描述](/uploads/example.webp)
```

手动编辑也受支持；原有 MDX 文件会保留扩展名，已有 series 等高级字段不会被表单删除。
新建文章使用 Markdown。目录由二、三级标题生成，代码高亮沿用 Astro。

## 遇到问题

- **文件已在磁盘改变：** 先复制表单中的未保存文本，再刷新重新读取文章，避免覆盖另一个编辑器中的更新。
- **GitHub 有较新提交：** 保留本地修改，使用 Git 正常同步后重试；编辑器不会强推、自动解决冲突或覆盖远程。
- **检查或构建失败：** 查看发布日志，修正文稿或资源引用，再保存重试。失败前不会推送。
- **提交成功、推送失败：** 本地提交仍在；修复网络或 Git 登录后，对未再修改的同篇文章重新「检查并发布」即可重试推送。
  如果已经继续修改该文章，请先在终端运行 `git push origin main` 推送上次提交，再发布新改动。新改动会保留在工作区。
- **预览端口被占用：** 关闭占用该端口的预览进程，或在 PowerShell 设置 `$env:PREVIEW_PORT='4323'` 后运行 `npm run editor`。
  编辑器端口可用 `$env:EDITOR_PORT='4312'` 修改。预览启动失败时链接会禁用，并显示错误。
- **手工撤下文章：** 将 `draft` 改为 `true` 后，手动提交该文件并正常推送。当前表单发布按钮用于发布非草稿；不提供删除、重命名或撤下按钮。

## English quick start

Double-click **Start-Writing.cmd** on Windows, or run `npm ci` once followed by
`npm run editor`. Requirements: Node.js 24, Git, and an existing GitHub login.
The editor runs only on `127.0.0.1:4311`; keep its terminal open.
Use the top-right language button for the English editor interface.

Select or create an article, fill in its metadata and Markdown, then **Save locally**.
Use **Preview article** to inspect the real page. Drafts are visible locally and
excluded from the production site. To publish, uncheck **Draft**, save, choose
**Review & publish**, review the file list/diff, and confirm **Build & publish to GitHub**.
Only the selected article and its referenced uploaded images are committed.
Wait for GitHub Actions, then visit the live page. A successful push is not yet a successful deployment.

Use **Edit other language** to create or open the matching translation. Chinese files
live in `src/content/blog/`; English files with `lang: en` live in
`src/content/blog/en/`. Matching filenames pair translations. Write and publish
each version separately. Translation is manual; no translation API or credentials are used.

Dates are metadata, not scheduled publishing. A public repository exposes committed
source even when a document is marked as a draft. If another editor changes a file,
the form refuses a stale save; copy your text, reload and reconcile it.
Publication requires `main`, no staged files and no unfinished code changes.
The editor never force-pushes. If a push fails after committing, retry the unchanged
article after fixing connectivity. If you edited again, run `git push origin main`
first, then publish the newer changes.

Images: PNG, JPEG, GIF or WebP, up to 8 MB. Uploads remain local until referenced by a
published article. No automatic deletion, renaming, unpublishing, or cloud CMS is included.
For a port conflict, set `EDITOR_PORT` or `PREVIEW_PORT` before starting the editor.
