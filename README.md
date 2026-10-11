# 页边 MARGIN

一个用 Next.js 写的个人博客：文章是本地 Markdown 文件，构建期完成解析与代码高亮，
站内搜索、RSS、标签、目录锚点都是真实可用的功能。

- **框架**：Next.js 16（App Router）+ React 19 + TypeScript
- **内容**：`content/posts/` 下的 `.mdx` 文件，frontmatter 驱动
- **高亮**：Shiki，构建期生成，自定义主题见 `lib/code-theme.ts`
- **搜索**：构建期生成索引（`/search-index.json`），前端子串匹配 —— 为中文优化，不依赖分词
- **样式**：一套 CSS 语义令牌 + `[data-theme="dark"]` 单一覆盖点，深色模式无闪烁

---

## 一、本地跑起来

```bash
npm install      # 只第一次需要
npm run dev      # 开发环境，改文章即时生效
```

打开 http://localhost:3000 即可。开发环境里 `draft: true` 的草稿**也会显示**，方便边写边看。

要看正式构建的效果（草稿会被排除）：

```bash
npm run build && npm start
```

---

## 二、写文章

> 如果你习惯用 Obsidian，直接看下一节——那条路不用碰这个仓库。
> 本节是在仓库里直接写文件的方式，两种可以混用。

### 新建一篇

```bash
npm run new -- my-first-post "我的第一篇文章"
```

第一个参数是**文件名**，它会直接成为 URL（`/posts/my-first-post`），所以建议用英文短横线写法；
第二个参数是标题，省略时用文件名代替。生成的文件长这样：

```mdx
---
title: 我的第一篇文章
date: 2026-10-11
summary: 一句话说清这篇要解决什么问题 —— 会出现在首页列表、搜索结果和 RSS 里。
tags: [待填]
draft: true
---

正文从这里开始…
```

写完把 `draft: true` 删掉（或改成 `false`），它才会进入正式构建。

> 不想用脚本也行：直接在 `content/posts/` 里新建 `.mdx` 文件，按上面的格式写 frontmatter 即可。

### frontmatter 字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 标题。可用 `*词*` 标记想强调的部分，会渲染成衬线斜体 + 强调色 |
| `date` | 是 | `YYYY-MM-DD`，决定排序、归档年份和 RSS 时间 |
| `summary` | 是 | 一段话摘要，出现在首页列表、搜索结果、RSS |
| `tags` | 否 | 数组，如 `[React, 架构]`。标签页、标签筛选都基于它 |
| `featured` | 否 | `true` 会置顶到首页大图位；同时只保留一篇 |
| `draft` | 否 | `true` 表示草稿，正式构建时排除 |

两个中文排版相关的写法：

```yaml
# 1. 标题想控制断行点（浏览器对中文没有词组意识，会拆开「然后」这类词）
title: |
  用 Server Components 重写了我的博客，
  然后删掉了 *60%* 的代码

# 2. 强调某几个字
title: 我为什么删掉了 *60%* 的代码
```

标题里的换行只在文章页和首页特写生效；归档列表、搜索结果里会自动收成一行。

### 正文里能用的东西

普通 Markdown 全部支持（标题、列表、引用、表格、链接、行内代码、代码块、图片），
表格列多了会自动横向滚动。此外有三个自定义组件：

```mdx
<Callout type="warn" title="一个容易踩的坑">
  提示块。type 不写默认是 warn，写 "note" 是信息色。
</Callout>

<Figure caption="图注写给看一眼就滑过去的人">
  <img src="/images/your-image.png" alt="描述这张图在说什么" />
</Figure>
```

- 代码块：**必须写语言名**（```ts、```bash），顶栏会显示它并有复制按钮
- 图片：放到 `public/images/`，引用写 `/images/文件名`
- 站外链接会自动加 `target="_blank"`，站内链接保持原样
- 二级、三级标题会**自动**进入右侧目录，不需要手写锚点

写作约定（这些不是限制，是让全站看起来一致的最小共识）：

- 摘要写「这篇解决什么问题」，不要写「本文介绍了…」
- 一个提示块只在真的需要提醒时用，通篇都是就等于没有
- 段落之间多留空行，中文长段落读起来很累

---

## 三、在 Obsidian 里写（推荐）

日常写作走这条路：**在 Obsidian 里写笔记，一条命令发布**，不用碰这个仓库。

### 写作位置

笔记放在 vault 的 `博客/` 文件夹：

```
~/pkm/瑞克和莫蒂/博客/     ← 只放要发布的文章
```

源目录写在 `blog.config.json` 里（vault 名 + 文件夹名），脚本运行时去读 Obsidian 自己的
vault 清单拿绝对路径，所以换电脑或挪动 vault 都不需要改代码。
也可以用环境变量临时指定：`BLOG_VAULT_DIR=/绝对路径 npm run sync`。

**下划线开头的文件会被跳过**——说明、模板、草稿箱都放这类文件，不会误发出去。
文件夹里已经放好了 `_写作说明.md` 和 `_模板.md`。

### 发布

```bash
npm run publish
```

依次做四件事：**同步 → 构建校验 → 提交 → 推送**。推送后 Vercel 自动重新构建，约一分钟上线。
**构建失败会中止**，不会把坏内容推上去。

只想先看看效果、不发布：

```bash
npm run sync      # 只同步到仓库
npm run dev       # 本地预览
```

### frontmatter

```yaml
---
title: 文章标题            # 不写就用文件名（去掉日期前缀）
date: 2026-10-11           # 不写就取文件名日期前缀，再没有就用文件修改时间
summary: 一句话说清这篇解决什么问题   # 不写就自动截取正文开头
tags: [工程, 调试]
draft: true                # 草稿：本地可见，正式构建不收录
slug: my-post              # 指定网址：改了文件名也不会破坏已发布的链接
featured: true             # 置顶到首页大图位，同时只留一篇
---
```

### Obsidian 语法支持

| 写法 | 发布后 |
| --- | --- |
| `[[另一篇笔记]]` | 变成指向那篇文章的站内链接（按文件名或标题匹配） |
| `[[另一篇笔记\|显示文字]]` | 同上，链接文字自定义 |
| `> [!note] 标题` | 信息色提示块 |
| `> [!warning] 标题` | 警示色提示块（danger / error / caution 等同理） |
| `![[图片.png]]` | 图片自动复制到 `public/images/` 并插入正文 |
| `![[图片.png\|图注]]` | 同上，并加上图注；写数字（如 `\|400`）当宽度，忽略 |
| `%%注释%%` | 直接删掉，不会出现在文章里 |
| Dataview / Excalidraw / Canvas | **不支持**，别在要发布的文章里用 |

双链指向的文章不存在时会退化成纯文字，同步结束后会打印提示，不会留下断裂的链接。

### 同步的行为边界

- 只写 `content/posts/` 与 `public/images/`，**绝不修改 vault 里的任何文件**
- 用 `content/.vault-manifest.json` 记录哪些文章来自 vault：
  vault 里删掉的文章会一起删掉，不再引用的配图会顺手清理
- **手写的文章不受影响**——脚本只动清单里记录过的文件
- 同名配图内容不同时会另起名字，不会覆盖你原有的图

---

## 四、部署

### 第 0 步（必做）：把站内信息改成你自己的

打开 `lib/site.ts`，这几处如果留着占位符，RSS 和 sitemap 会指向错误地址：

```ts
url: "https://margin.example.com",   // ← 改成你的真实域名
social: [
  { href: "https://github.com/", label: "GitHub" },        // ← 换成你的
  { href: "mailto:hi@example.com", label: "邮件" },         // ← 换成你的
],
```

站名、简介、导航项也都在这个文件里，全站文案只从这里取，改一处就够。

### 方式一：Vercel（最省事）

Next.js 官方托管，不需要改任何配置。

```bash
npm i -g vercel
vercel          # 首次会让你登录并确认项目设置，一路回车即可
vercel --prod   # 发布到正式域名
```

也可以用 GitHub：把仓库推到 GitHub，在 Vercel 里 Import，之后**每次 push 自动重新构建**。
接上自定义域名在 Vercel 控制台 Domains 里加一条 CNAME 就行。

> 注意：Vercel 在国内访问速度不稳定。如果读者主要在国内，优先看方式二或方式三。

### 方式二：纯静态托管（不需要服务器）

这个博客所有页面都是构建期生成的，所以可以导出成纯 HTML，扔到任何静态托管上。

1. 打开 `next.config.ts`，取消这一行的注释：

   ```ts
   output: "export",
   ```

2. 构建，产物在 `out/`：

   ```bash
   npm run build     # 生成 out/ 目录，约 2.6 MB
   ```

3. 把 `out/` 整个目录上传到托管平台即可。国内可选：对象存储 + CDN（腾讯云 COS / 阿里云 OSS）、
   EdgeOne Pages；国外可选 Cloudflare Pages、Netlify。

有一个前提要注意：产物里文章页是 `posts/我的文章.html`，而访问地址是 `/posts/我的文章`，
所以**托管平台需要支持「干净 URL」**（自动把 `/a/b` 映射到 `/a/b.html`）。
Cloudflare Pages、Netlify、Vercel 默认支持；对象存储需要配置一条回源/重写规则。

这个模式我已经实测过：搜索、RSS、站内跳转全部正常，不需要 Node 运行时，也不会有冷启动。

### 方式三：自己的服务器（国内访问最快）

准备一台有公网 IP 的服务器（国内服务器需要完成 ICP 备案，否则域名会被拦）。

```bash
# 服务器上
git clone <你的仓库> blog && cd blog
npm ci
npm run build
```

用 pm2 常驻，Nginx 反向代理并配 HTTPS：

```bash
npm i -g pm2
pm2 start npm --name margin -- start     # 启动，监听 3000
pm2 save && pm2 startup                  # 开机自启
```

```nginx
server {
  listen 443 ssl;
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

证书用 `certbot --nginx` 一条命令签发并自动续期。以后更新文章的流程是：

```bash
git pull && npm ci && npm run build && pm2 restart margin
```

### 关于「更新内容要重新构建」

文章是在构建期解析、高亮、生成索引的，所以**每次写完新文章都需要重新构建**。

- Vercel / Cloudflare Pages：push 到 GitHub 就自动完成，不用管
- 自己服务器：跑一遍上面那四条命令；想省事可以写个 `deploy.sh` 或装个 GitHub Actions

---

## 五、项目结构

```
app/
  page.tsx                  首页（特写 + 时间线归档）
  posts/[slug]/page.tsx     文章页（目录、阅读进度、上下篇）
  tags/                     标签总览与标签归档
  about/                    关于
  rss.xml/route.ts          RSS 2.0
  sitemap.ts                站点地图
  search-index.json/route.ts 搜索索引（构建期生成）
content/posts/              文章（Obsidian 同步产物 + 手写的都放这里）
content/.vault-manifest.json  同步清单：记录哪些文章来自 vault
blog.config.json            笔记源目录：vault 名 + 文件夹名
components/                 界面组件（搜索面板、代码块、目录、复制按钮…）
lib/
  site.ts                   站点配置
  posts.ts                  内容层：解析 frontmatter、抽目录、算阅读时长
  search.ts                 搜索与高亮算法
  code-theme.ts             代码高亮主题
public/images/              文章配图（同步时自动搬运）
scripts/
  sync-from-vault.mjs       把 Obsidian 笔记转成博客文章
  publish.mjs               一键发布：同步 → 构建校验 → 提交 → 推送
  new-post.mjs              不用 Obsidian 时，直接新建一篇文章
```

## 六、验证

改完东西想确认没写坏：

```bash
npm run build      # 类型检查 + 构建，同时会暴露 frontmatter 写错的问题
npm start          # 然后打开 http://localhost:3000 看实际效果
```

文章的解析与高亮有一条独立的冒烟测试：`scripts/smoke.mts`。
