#!/usr/bin/env node
/**
 * 新建一篇文章。
 *
 *   npm run new -- hello-world "你好，世界"
 *
 * 会在 content/posts/ 下生成 hello-world.mdx，frontmatter 已经填好，
 * draft: true 让它在正式构建里不会出现 —— 写完了记得改成 false 或删掉这一行。
 *
 * 不引第三方依赖，只用 node 内置模块，所以不会给项目增加任何安装负担。
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

const [rawSlug, ...titleParts] = process.argv.slice(2);

if (!rawSlug || rawSlug === "-h" || rawSlug === "--help") {
  console.log(`
用法:  npm run new -- <文件名> ["文章标题"]

  文件名会成为 URL，建议用英文短横线写法：
    npm run new -- css-container-queries "容器查询：比媒体查询更聪明的响应式"

  省略标题时用文件名代替。
`);
  process.exit(rawSlug ? 0 : 1);
}

// 文件名即 slug，会直接进 URL，所以只允许安全字符
const slug = rawSlug
  .trim()
  .replace(/\s+/g, "-")
  .replace(/[^\w\u4e00-\u9fff-]/g, "")
  .replace(/-{2,}/g, "-")
  .replace(/^-|-$/g, "");

if (!slug) {
  console.error("文件名不合法，至少需要一个字母、数字或中文。");
  process.exit(1);
}

const title = titleParts.join(" ").trim() || slug;
const today = new Date().toLocaleDateString("sv-SE"); // sv-SE 恰好是 YYYY-MM-DD
const target = path.join(POSTS_DIR, `${slug}.mdx`);

if (fs.existsSync(target)) {
  console.error(`已经存在同名文章：content/posts/${slug}.mdx`);
  process.exit(1);
}

const template = `---
title: ${title}
date: ${today}
summary: 一句话说清这篇要解决什么问题 —— 会出现在首页列表、搜索结果和 RSS 里。
tags: [待填]
# featured: true      # 置顶到首页大图位，同时只留一篇
draft: true           # 写完改成 false，或在正式构建前删掉这一行
---

开头先用两三句话把问题摆出来：你遇到了什么，为什么值得写下来。

## 第一个小节

正文。行内代码写作 \`npm run dev\`，需要强调的词用 *星号* 包起来会渲染成衬线斜体。

> 引用块适合放一句关键结论。

<Callout type="warn" title="一个容易踩的坑">
提示块只在你真的想提醒读者时用，通篇都是提示块就失去了提醒的意义。
</Callout>

<Callout type="note" title="补充说明">
type 换成 note 是信息色的提示。
</Callout>

\`\`\`ts
// 代码块会自动高亮，并在顶栏显示语言名和复制按钮
const answer: number = 42;
\`\`\`

| 场景 | 做法 | 代价 |
| --- | --- | --- |
| 表格 | 直接写 Markdown 表格 | 窄屏会自动横向滚动 |

## 小结

把结论收一下，或者把还没想清楚的地方诚实写出来。

---

下面两段是组件速查，用得上就留，用不上整段删掉：

\`\`\`mdx
<Figure caption="图注写给看一眼就滑过去的人">
  <img src="/images/your-image.png" alt="描述这张图在说什么" />
</Figure>
\`\`\`

图片放在 \`public/images/\` 下，引用时写 \`/images/文件名\`。
`;

fs.mkdirSync(POSTS_DIR, { recursive: true });
fs.writeFileSync(target, template, "utf8");

console.log(`已创建 content/posts/${slug}.mdx`);
console.log(`访问地址（开发环境）：http://localhost:3000/posts/${slug}`);
console.log("注意：draft 为 true，正式构建不会收录。");
