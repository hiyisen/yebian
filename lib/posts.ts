import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";
import { cache } from "react";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

export type Heading = { id: string; text: string; depth: 2 | 3 };

export type Post = {
  slug: string;
  title: string;
  /** ISO 日期，YYYY-MM-DD */
  date: string;
  summary: string;
  tags: string[];
  featured: boolean;
  draft: boolean;
  /** 预估阅读时长（分钟） */
  readingMinutes: number;
  headings: Heading[];
  /** 原始 MDX 正文，交给渲染层 */
  content: string;
  /** 去掉 Markdown 语法的纯文本，用于搜索与摘要 */
  body: string;
  year: string;
  shortDate: string;
  displayDate: string;
};

/* ------------------------------------------------------------------ *
 * 文本处理
 * ------------------------------------------------------------------ */

/**
 * 去掉标题里的强调标记。
 * 标题里的 `*xxx*` 表示「用衬线斜体强调这个词」（见 PostTitle 组件），
 * 属于作者的排版意图；但在搜索索引、元数据、上下篇导航这些纯文本场景里，
 * 星号应该消失。所有需要纯标题的地方都必须走这个函数。
 */
export function plainTitle(title: string): string {
  return title
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s*\n\s*/g, " ")
    // 中文字符（含全角标点）之间不留空格 —— 断行归一时「博客， 然后」应为「博客，然后」；
    // 西文词间仍保留空格，如「Server Components 重写」。
    .replace(/([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]) (?=[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef])/g, "$1")
    .trim();
}

/**
 * 阅读时长估算。
 * 中文按 350 字/分钟、西文按 200 词/分钟分别计算再相加 ——
 * 混合内容里两种字符的阅读速度差得很远，用单一系数会明显失真。
 */
function readingMinutes(text: string): number {
  const cjk = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const words = (text.match(/[A-Za-z0-9_'’-]+/g) ?? []).length;
  return Math.max(1, Math.round(cjk / 350 + words / 200));
}

/** 去掉标题里的行内标记，拿到纯文字 —— 必须与 rehype-slug 看到的文本一致 */
function stripInlineMarkdown(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * 从 Markdown 源码抽目录。
 *
 * 用 github-slugger 生成 id —— 与 rehype-slug 用的是同一个库，
 * 所以这里的锚点和渲染出来的标题 id 必然一致（已在 scripts/smoke.mts 中验证）。
 * 代码围栏内的 # 要跳过，否则示例代码会被误认成标题。
 */
function extractHeadings(markdown: string): Heading[] {
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  let inFence = false;

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const m = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;

    const depth = m[1].length;
    const text = stripInlineMarkdown(m[2]);
    // 无论层级都要过一遍 slugger，保证同名标题的编号与渲染端一致
    const id = slugger.slug(text);
    if (depth === 2 || depth === 3) headings.push({ id, text, depth });
  }

  return headings;
}

/** 把 Markdown 剥成纯文本，供搜索使用 */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}>[ \t]?/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/^\s*[-:| ]{3,}\s*$/gm, " ")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/<\/?[A-Za-z][^>]*>/g, " ")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ *
 * 读取
 * ------------------------------------------------------------------ */

function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return "1970-01-01";
}

function parsePost(slug: string, source: string): Post {
  const { data, content } = matter(source);
  const date = normalizeDate(data.date);
  const [year, month, day] = date.split("-");

  // frontmatter 里的 slug 优先级高于文件名 —— 从 Obsidian 同步过来的文章
  // 常常会改文件名（加日期前缀、调整措辞），不该因此换掉已发布的网址
  const frontSlug = String(data.slug ?? "").trim();

  return {
    slug: frontSlug || slug,
    title: String(data.title ?? slug),
    date,
    summary: String(data.summary ?? ""),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    featured: data.featured === true,
    draft: data.draft === true,
    readingMinutes: readingMinutes(toPlainText(content)),
    headings: extractHeadings(content),
    content,
    body: toPlainText(content),
    year,
    shortDate: `${month}.${day}`,
    displayDate: `${year}.${month}.${day}`,
  };
}

/** 草稿只在开发环境可见，正式构建直接排除 */
function shouldInclude(post: Post): boolean {
  return process.env.NODE_ENV !== "production" || !post.draft;
}

function readAllPosts(): Post[] {
  if (!fs.existsSync(POSTS_DIR)) return [];

  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => {
      const slug = f.replace(/\.mdx?$/, "");
      return parsePost(slug, fs.readFileSync(path.join(POSTS_DIR, f), "utf8"));
    })
    .filter(shouldInclude)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/* ------------------------------------------------------------------ *
 * 对外 API（用 cache 做请求内去重，避免同一页重复读盘）
 * ------------------------------------------------------------------ */

export const getAllPosts = cache(readAllPosts);

export const getPostSlugs = cache((): string[] =>
  getAllPosts().map((p) => p.slug),
);

export const getPostBySlug = cache((slug: string): Post | undefined =>
  getAllPosts().find((p) => p.slug === slug),
);

/** 置顶文章；没有显式指定就取最新一篇，保证首屏永远不空 */
export const getFeaturedPost = cache((): Post | undefined => {
  const posts = getAllPosts();
  return posts.find((p) => p.featured) ?? posts[0];
});

/** 上一篇 / 下一篇 —— 按时间倒序排列后的相邻关系 */
export const getAdjacentPosts = cache(
  (slug: string): { prev?: Post; next?: Post } => {
    const posts = getAllPosts();
    const i = posts.findIndex((p) => p.slug === slug);
    if (i < 0) return {};
    return {
      // 列表是倒序的，所以下标更大的是更早的文章
      prev: posts[i + 1],
      next: posts[i - 1],
    };
  },
);

export type TagCount = { tag: string; count: number };

export const getAllTags = cache((): TagCount[] => {
  const counts = new Map<string, number>();
  for (const post of getAllPosts()) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh"));
});

export const getPostsByTag = cache((tag: string): Post[] =>
  getAllPosts().filter((p) => p.tags.includes(tag)),
);

export type YearGroup = { year: string; posts: Post[] };

export function groupByYear(posts: Post[]): YearGroup[] {
  const groups = new Map<string, Post[]>();
  for (const post of posts) {
    const list = groups.get(post.year) ?? [];
    list.push(post);
    groups.set(post.year, list);
  }
  return [...groups.entries()]
    .map(([year, list]) => ({ year, posts: list }))
    .sort((a, b) => (a.year < b.year ? 1 : -1));
}
