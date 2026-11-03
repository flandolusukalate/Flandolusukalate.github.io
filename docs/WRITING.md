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

## 删除与恢复文章

1. 选中已保存的文章，在右侧设置区点击「删除文章」。有未保存修改时，先保存再操作。
2. 核对弹窗中的文章标题和文件清单。删除中文时，可勾选「同时删除英文版」，默认不勾选；删除英文时只删除英文，保留中文。
3. 点击「确认删除」。文章从本地书架移除，图片保留，完整源码副本保存在被 Git 忽略的 `.local-editor/deletions/`。
4. 在编辑区下方「已删除的文章」中可点击「恢复到书架」。恢复不会覆盖同名的不同文章，也不会自动上传。
5. 已提交过 Git 的文章需点击「发布删除」，核对清单后「构建并发布到 GitHub」。通过检查、构建、推送与 GitHub 部署后，正式网站才移除文章。仅本地新建、从未提交过的文章无需发布删除。

一次处理一组待发布删除：先发布或恢复当前删除，再删除其他文章。待发布删除的同名文章不能新建覆盖。
发布失败时保留恢复副本；如果提交已经创建但推送失败，先重试「发布删除」，完成推送后再恢复。
已发布删除的文章也可恢复到本地，重新上线需按正常文章发布流程操作。删除不会抹除 Git 历史，也不会删除共享图片。

升级编辑器功能后，先保存表单，关闭旧启动窗口，再双击 `Start-Writing.cmd`，刷新编辑器页面。

## 中英版本

点击「编辑另一语言」可打开对应译文；没有译文时会生成同名文章的新表单。
可以手动填写，也可以接入 DeepSeek 生成英文候选译文。

### DeepSeek 自动翻译

1. 打开编辑器上方的「翻译设置」，在 [DeepSeek 控制台](https://platform.deepseek.com/api_keys) 创建 API Key，并直接填入本机编辑器。不要把 Key 发到聊天或提交到 GitHub。
2. 默认使用 DeepSeek Flash，可切换为 V4 Pro。勾选「保存中文变更后，自动生成英文候选译文」并保存设置。默认不开启自动调用。
3. 新增或修改中文文章并「保存到本机」。也可对已保存的中文点击「生成／更新英文」。没有内容变化时，自动模式不会重复生成。仅在外部文本编辑器修改文件不会触发翻译，需要回到本编辑器保存或手动生成。
4. 等待「候选译文已就绪」，点击「检查候选译文」对照中英文，然后「载入英文草稿以修改」。可编辑标题、摘要、分类、标签和完整 Markdown；展开「对照中文原文」可继续核对。
5. 首次必须保存为草稿。完成审阅并预览后，取消「草稿」、再次保存，再执行原有「检查并发布」流程。中英文仍分别发布，生成绝不会自动推送。

DeepSeek 会接收所选文章的标题、摘要、分类、标签和正文文本，按其 API 用量收费；不会发送其他文章或 Git 凭据。代码与 HTML 使用占位符保护，译文恢复后会核对代码、HTML 和链接目标；图片只保留路径，不上传图片文件。仍应检查术语、事实与语气，机器检查不能保证翻译准确。

API Key 使用 Windows 当前账户的 DPAPI 加密，保存到 `%APPDATA%/FlandoluSpace/translation.json`，不在项目目录。设置页只显示是否配置，不回显密钥；留空保存会保留原 Key，「移除密钥」会同时关闭自动翻译。也可在启动编辑器的环境中设置 `DEEPSEEK_API_KEY`，此时以环境变量为准；修改后需重启。非 Windows 环境请使用环境变量。

候选译文保存在被 Git 忽略的 `.local-editor/translations/`，重启后仍可查看。载入表单不会修改英文文件，明确保存才会替换本地英文；正式网站需发布后才改变。中文或英文在生成期间发生变化时，候选会标记失效，必须重新生成。中文后续更新时，已生成的英文也会显示需要更新。现有手动译文没有来源指纹，不推断其是否过时。

当前一次翻译支持 `.md` 正文 1–24,000 字符；MDX 继续手动翻译。一次只运行一个翻译任务；另一篇保存时若任务繁忙，会提示稍后手动生成。请求超时、余额不足、限流或格式错误会提示重试，保留已有英文和上一次候选，不自动重试扣费。生成中保持编辑器启动窗口运行，页面可以关闭；关闭启动窗口会中断未完成的生成。

接口与模型以 [DeepSeek 官方文档](https://api-docs.deepseek.com/) 为准；目前只连接官方 `https://api.deepseek.com/chat/completions`。

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
- **手工撤下文章：** 将 `draft` 改为 `true` 后，手动提交该文件并正常推送。也可使用「删除文章」及「发布删除」移除文章。当前不提供重命名或单独撤下按钮。

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
each version separately. Optional DeepSeek translation is available in **Translation settings**.

Enter an API key locally, choose Flash or V4 Pro, and optionally enable generation after
saving Chinese changes. API calls send only the selected article’s text to DeepSeek and
incur its usage charges. Automatic generation is off by default. Saved Windows keys are
encrypted for your Windows account outside the repository; `DEEPSEEK_API_KEY` is also supported.

Choose **Generate / update English**, then **Review candidate** and **Load English draft for editing**.
Check and edit the English fields alongside **Chinese source**. The first save must be a draft;
after review and preview, uncheck Draft, save again and use the existing publication flow.
Generation never uploads or publishes. Existing English is unchanged until you explicitly save.
Candidates survive restarts in the Git-ignored `.local-editor/translations/` folder.
Source/target changes invalidate a pending candidate; updated Chinese marks generated English out of date.
Code, HTML and link destinations are checked, but meaning and terminology still require human review.
Only `.md` bodies of 1–24,000 characters are supported automatically. MDX remains manual.
Requests are not retried automatically. Keep the editor terminal running during generation.

Dates are metadata, not scheduled publishing. A public repository exposes committed
source even when a document is marked as a draft. If another editor changes a file,
the form refuses a stale save; copy your text, reload and reconcile it.
Publication requires `main`, no staged files and no unfinished code changes.
The editor never force-pushes. If a push fails after committing, retry the unchanged
article after fixing connectivity. If you edited again, run `git push origin main`
first, then publish the newer changes.

To delete, select a saved article and choose **Delete article** in its settings.
Review the title and file list. For Chinese articles, **Also delete the English version**
is optional and unchecked by default; deleting English keeps Chinese. Confirming removes
the selected files locally and keeps recoverable backups in the Git-ignored
`.local-editor/deletions/` folder. Shared images are kept.
Under **Deleted articles**, choose **Restore to library** or **Publish deletion**.
Publishing checks, builds and pushes only the listed deletions; the live site changes after
GitHub deployment. Untracked local articles need no deletion publication. Finish or restore
one pending deletion before starting another, and do not reuse its slug until resolved.
If a commit succeeded but pushing failed, retry **Publish deletion** before restoring.
Restoring an already published deletion stays local until you publish the article again.
After upgrading the editor, save your form, close its old terminal, restart
**Start-Writing.cmd**, then reload the editor.

Images: PNG, JPEG, GIF or WebP, up to 8 MB. Uploads remain local until referenced by a
published article. No automatic image deletion, renaming, separate unpublishing, or cloud CMS is included.
For a port conflict, set `EDITOR_PORT` or `PREVIEW_PORT` before starting the editor.
