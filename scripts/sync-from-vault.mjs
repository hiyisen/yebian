#!/usr/bin/env node
/**
 * 把 Obsidian 笔记同步成博客文章。
 *
 *   npm run sync
 *
 * 源目录由 blog.config.json 指定（vault 名 + 文件夹名），运行时去读 Obsidian 自己的
 * vault 清单拿绝对路径 —— 换电脑或挪动 vault 都不用改代码。
 * 也可以用环境变量 BLOG_VAULT_DIR 直接指定绝对路径来覆盖。
 *
 * 做三件事：
 *   1. 把 Obsidian 专有语法翻译成博客能渲染的写法（[[双链]]、> [!note] 标注、![[附件]]）
 *   2. 规范化 frontmatter（title/date/summary 都有回退，不逼作者写全）
 *   3. 用清单跟踪「哪些文章来自 vault」，vault 里删掉的文章会一起删掉
 *
 * 只写 content/posts/ 与 public/images/，不碰 vault 里的任何文件。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import matter from "gray-matter";

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, "content", "posts");
const IMAGES_DIR = path.join(ROOT, "public", "images");
const MANIFEST = path.join(ROOT, "content", ".vault-manifest.json");
const CONFIG = path.join(ROOT, "blog.config.json");

const warnings = [];
const warn = (msg) => {
  if (!warnings.includes(msg)) warnings.push(msg);
};

/* ------------------------------------------------------------------ *
 * 找到源目录
 * ------------------------------------------------------------------ */

function obsidianVaults() {
  const file = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "obsidian",
    "obsidian.json",
  );
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return Object.values(data.vaults ?? {}).map((v) => v.path);
  } catch {
    return [];
  }
}

function resolveSource() {
  if (process.env.BLOG_VAULT_DIR) {
    return { dir: process.env.BLOG_VAULT_DIR, label: process.env.BLOG_VAULT_DIR };
  }

  if (!fs.existsSync(CONFIG)) {
    console.error("缺少 blog.config.json，无法确定笔记源目录。");
    process.exit(1);
  }
  const { vault, folder } = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  const match = obsidianVaults().find((p) => path.basename(p) === vault);
  if (!match) {
    console.error(`在 Obsidian 的 vault 清单里找不到名为「${vault}」的 vault。`);
    console.error("可用：", obsidianVaults().map((p) => path.basename(p)).join("、"));
    process.exit(1);
  }
  const dir = path.join(match, folder);
  if (!fs.existsSync(dir)) {
    console.error(`vault 里没有「${folder}」文件夹：${dir}`);
    process.exit(1);
  }
  return { dir, label: `${vault}/${folder}` };
}

/* ------------------------------------------------------------------ *
 * 收集笔记
 * ------------------------------------------------------------------ */

/** 下划线或点开头的文件/文件夹视为私有（说明、模板、草稿箱），不同步 */
const isPrivate = (name) => name.startsWith("_") || name.startsWith(".");

function collectNotes(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (isPrivate(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectNotes(full, base, out);
    else if (/\.md$/i.test(entry.name)) out.push({ file: full, rel: path.relative(base, full) });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 文本工具
 * ------------------------------------------------------------------ */

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})[-_ ]/;

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    // 中文标点与空白当成分词边界，保留断句（直接删掉会让「理直气壮，还能」连成一片）
    .replace(/[\s，、。；：？！…—·「」『』“”‘’（）《》〈〉【】〔〕]+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function stripMarkdown(s) {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/<\/?[A-Za-z][^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** YAML 会把 date 解析成 Date 对象，直接 String() 会得到 "Sun Oct 11" 这种结果 */
function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? "").trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** 正文里第一段有意义的文字，用作缺省摘要 */
function fallbackSummary(body) {
  const paras = body.split(/\n{2,}/).map((p) => p.trim());
  const pick = paras.find(
    (p) =>
      p.length > 12 &&
      !p.startsWith("#") &&
      !p.startsWith("|") &&
      !p.startsWith("```") &&
      // 组件（<Callout>、<Figure> 等）不适合当摘要
      !p.startsWith("<"),
  );
  // 开头的引用块常被作者当导语，剥掉 > 后拿来当摘要是合适的
  const text = stripMarkdown((pick ?? "").replace(/^\s*>\s?/gm, ""));
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

/**
 * 输出一个 YAML 标量：安全就裸写，否则加双引号。
 *
 * 不这么做的话，标题写成「Rust: 内存模型」会让整个 frontmatter 解析失败，
 * 摘要里带 `#​ ` 或者日期长相的文字也会被 YAML 悄悄改写（`2026-10-11` 会变成 Date 对象）。
 * 裸写与加引号对博客渲染没有区别，所以宁可多引几个。
 */
function yamlScalar(value) {
  const s = String(value ?? "");
  const unsafe =
    s === "" ||
    /^\s|\s$/.test(s) ||
    /:\s|:$|\s#/.test(s) ||
    // 流式数组（tags: [a, b]）里这些字符会截断标量
    /[,{}[\]]/.test(s) ||
    /^[-?*&!|>%@`"'#]/.test(s) ||
    /^(true|false|yes|no|on|off|null|~)$/i.test(s) ||
    /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) ||
    /^\d{4}-\d{2}-\d{2}([T ]|$)/.test(s);
  if (!unsafe) return s;
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/* ------------------------------------------------------------------ *
 * 附件
 * ------------------------------------------------------------------ */

let attachmentIndex = null;

/** 惰性建立「文件名 → 路径」索引，只在真的需要搬附件时才扫 vault */
function findAttachment(name, noteDir, vaultRoot) {
  const local = path.join(noteDir, name);
  if (fs.existsSync(local)) return local;

  if (!attachmentIndex) {
    attachmentIndex = new Map();
    const walk = (dir, depth = 0) => {
      if (depth > 4) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, depth + 1);
        else if (!attachmentIndex.has(entry.name)) attachmentIndex.set(entry.name, full);
      }
    };
    walk(vaultRoot);
  }
  return attachmentIndex.get(name) ?? null;
}

/**
 * 大图压缩：超过 1.5MB 的图用 macOS 自带的 sips 转 JPEG 并缩到 1920 宽。
 *
 * Obsidian 里随手贴的壁纸/照片动辄 4K 原图好几 MB，直接进仓库会拖垮页面加载。
 * 压缩收益不明显（已小于原体积六成）或环境没有 sips（非 macOS）时保持原样。
 */
function compressIfLarge(src) {
  try {
    if (fs.statSync(src).size <= 1.5 * 1024 * 1024) return null;
    if (!/\.(png|jpe?g|heic|heif|tiff?)$/i.test(src)) return null;

    const probe = execFileSync("/usr/bin/sips", ["-g", "pixelWidth", src], {
      encoding: "utf8",
    });
    const width = Number(/pixelWidth:\s*(\d+)/.exec(probe)?.[1] ?? 0);

    const args = ["-s", "format", "jpeg", "-s", "formatOptions", "78"];
    if (width > 1920) args.push("--resampleWidth", "1920");
    const tmp = path.join(os.tmpdir(), `blog-compress-${process.pid}-${Date.now()}.jpg`);
    execFileSync("/usr/bin/sips", [...args, src, "--out", tmp], { stdio: "ignore" });

    if (fs.existsSync(tmp) && fs.statSync(tmp).size < fs.statSync(src).size * 0.6) return tmp;
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    return null;
  } catch {
    return null;
  }
}

function copyAttachment(src) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const compressed = compressIfLarge(src);
  const actual = compressed ?? src;
  const ext = (compressed ? ".jpg" : path.extname(src)).toLowerCase();
  // Obsidian 的粘贴图常带空格（Pasted image 2026...png），带空格进 URL 会出问题
  const base =
    path
      .basename(src, path.extname(src))
      .replace(/\s+/g, "-")
      .replace(/[^\w\u4e00-\u9fff.-]/g, "")
      .replace(/-{2,}/g, "-") || "image";
  let target = path.join(IMAGES_DIR, `${base}${ext}`);
  let n = 2;
  // 同名但内容不同时另起名字，避免覆盖别人的图
  while (fs.existsSync(target) && !fs.readFileSync(target).equals(fs.readFileSync(actual))) {
    target = path.join(IMAGES_DIR, `${base}-${n}${ext}`);
    n += 1;
    if (n > 20) {
      warn(`附件重名过多，跳过：${base}${ext}`);
      if (compressed) fs.unlinkSync(compressed);
      return null;
    }
  }
  if (!fs.existsSync(target)) fs.copyFileSync(actual, target);
  if (compressed) fs.unlinkSync(compressed);
  return `/images/${encodeURIComponent(path.basename(target))}`;
}

/* ------------------------------------------------------------------ *
 * Obsidian 语法 → 博客写法
 * ------------------------------------------------------------------ */

const CALLOUT_KINDS = {
  note: "note",
  info: "note",
  tip: "note",
  hint: "note",
  abstract: "note",
  summary: "note",
  quote: "note",
  example: "note",
  question: "note",
  warning: "warn",
  caution: "warn",
  attention: "warn",
  danger: "warn",
  error: "warn",
  bug: "warn",
  failure: "warn",
  fail: "warn",
  important: "warn",
};

/**
 * `> [!note] 标题` 加后续的 `>` 行 → <Callout>。
 *
 * 空行即结束 —— Obsidian 里想在标注内部留空行是要写一个单独的 `>` 的，
 * 所以空行必须当作边界，否则相邻的两个标注会被吞成一个（实测踩过）。
 */
function convertCallouts(body, rel) {
  const lines = body.split("\n");
  const out = [];

  for (let i = 0; i < lines.length; i += 1) {
    const open = /^\s*>\s*\[!(\w+)\][+-]?\s*(.*)$/.exec(lines[i]);
    if (!open) {
      out.push(lines[i]);
      continue;
    }

    const kind = CALLOUT_KINDS[open[1].toLowerCase()];
    if (!kind) warn(`${rel}：不认识的标注类型「${open[1]}」，已按警示块处理`);

    const title = open[2].trim();
    const inner = [];
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      if (/^\s*>/.test(lines[j])) inner.push(lines[j].replace(/^\s*>\s?/, ""));
      else break;
    }

    while (inner.length && inner[0].trim() === "") inner.shift();
    while (inner.length && inner[inner.length - 1].trim() === "") inner.pop();

    const attrs = [`type="${kind ?? "warn"}"`];
    if (title) attrs.push(`title="${title.replace(/"/g, "&quot;")}"`);

    // 内容前后留空行，MDX 才会把里面当 Markdown 解析
    out.push(`<Callout ${attrs.join(" ")}>`, "", ...inner, "", "</Callout>");
    i = j - 1;
  }

  return out.join("\n");
}

/**
 * Obsidian 注释 `%%…%%` 删掉。
 * 删除后可能出现连续空格（「行内  代码」这种），顺手压成一个 —— 但代码块里不动。
 */
function stripObsidianComments(body) {
  const withoutComments = body.replace(/%%[\s\S]*?%%/g, "");
  const lines = [];
  let inFence = false;
  for (const line of withoutComments.split("\n")) {
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence;
    lines.push(inFence ? line : line.replace(/(\S) {2,}/g, "$1 "));
  }
  return lines.join("\n");
}

/**
 * 压掉列表项之间的空行。
 *
 * 在 Obsidian 里写列表，换行后会自动补一个缩进空行，看起来清爽；
 * 但标准 Markdown 把「列表中间有空行」视为松散列表，每个 <li> 都会被 <p> 包住，
 * 渲染出来项目之间是一整段的行距，整块列表散得没法看。这里把这类空行去掉，
 * 只处理「前后都是列表项」的情况 —— 列表与段落之间的空行必须保留。
 */
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+\S/;

function compactLists(body) {
  const lines = body.split("\n");
  const out = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence;

    if (inFence || line.trim() !== "") {
      out.push(line);
      continue;
    }

    let prev = null;
    for (let k = out.length - 1; k >= 0; k -= 1) {
      if (out[k].trim() !== "") {
        prev = out[k];
        break;
      }
    }
    let next = null;
    for (let k = i + 1; k < lines.length; k += 1) {
      if (lines[k].trim() !== "") {
        next = lines[k];
        break;
      }
    }

    if (prev && next && LIST_ITEM.test(prev) && LIST_ITEM.test(next)) continue;
    out.push("");
  }

  return out.join("\n");
}

/**
 * 剥掉正文开头与标题重复的一级标题。
 *
 * 在 Obsidian 里写笔记习惯先来一行 `# 标题`，但文章页已经用 frontmatter 的 title
 * 渲染了页面大标题，不处理就会上下顶着两个一模一样的标题。只在两者确实相同时才动手，
 * 作者自己写的小标题不受影响。
 */
function stripDuplicateHeading(body, title) {
  const m = /^\s*#\s+(.+?)\s*\n/.exec(body);
  if (!m) return body;
  const norm = (s) => s.replace(/[*_`]/g, "").replace(/\s+/g, "").trim();
  if (norm(m[1]) !== norm(title)) return body;
  return body.slice(m[0].length).replace(/^\s*\n/, "").trimStart();
}

/**
 * 附件嵌入 → 图片。
 * `![[图.png]]` 插图片；`![[图.png|图注]]` 顺带当图注；`![[图.png|300]]` 里的数字是宽度，忽略。
 *
 * 带图注时是否用 <Figure> 包一层，取决于它是不是独占一行：
 * 嵌在句子中间的 `<Figure>` 会落进段落内部，MDX 会直接报解析错误（实测踩过），
 * 这种情况退化成标准图片语法就没事了。
 */
function convertEmbeds(body, ctx) {
  return body.replace(
    /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (whole, rawName, alias, offset, full) => {
      const name = rawName.trim();
      const src = findAttachment(name, ctx.noteDir, ctx.vaultRoot);
      if (!src) {
        warn(`${ctx.rel}：找不到附件「${name}」，已替换为文字提示`);
        return `【缺少附件：${name}】`;
      }
      const url = copyAttachment(src);
      if (!url) return `【附件重名过多：${name}】`;

      const caption = alias && !/^\d+(x\d+)?$/.test(alias.trim()) ? alias.trim() : "";
      const standalone =
        /(^|\n)[ \t]*$/.test(full.slice(0, offset)) &&
        /^[ \t]*(\n|$)/.test(full.slice(offset + whole.length));

      if (!caption) return `![](${url})`;
      if (!standalone) return `![${caption}](${url})`;

      const safe = caption.replace(/"/g, "&quot;");
      return `\n\n<Figure caption="${safe}">\n  <img src="${url}" alt="${safe}" />\n</Figure>\n\n`;
    },
  );
}

/**
 * 双链 → 站内链接。
 * 目标按 slug / 标题匹配（都忽略大小写与空格）；匹配不上就退化成纯文字并给出提示。
 * `[[目标#小标题]]` 里的锚点会丢掉 —— 只链到文章，不猜小标题的 id。
 */
function convertWikilinks(body, ctx) {
  return body.replace(
    /\[\[([^\]|#^]+)(?:[#^][^\]|]+)?(?:\|([^\]]+))?\]\]/g,
    (whole, rawTarget, alias) => {
      const target = rawTarget.trim();
      const text = (alias ?? target).trim();
      const hit = ctx.lookup.get(target.toLowerCase().replace(/\s+/g, ""));

      if (hit) return `[${text}](/posts/${encodeURIComponent(hit)})`;
      warn(`${ctx.rel}：双链「${target}」没有对应的文章，已退化为纯文字`);
      return text;
    },
  );
}

/* ------------------------------------------------------------------ *
 * 单篇处理
 * ------------------------------------------------------------------ */

/** 先只读元信息 —— 双链要等所有笔记的 slug/标题都拿到手才能解析 */
function readNote(note) {
  const raw = fs.readFileSync(note.file, "utf8").replace(/\r\n/g, "\n");

  let parsed;
  try {
    parsed = matter(raw);
  } catch (err) {
    // YAML 报错信息对写作者没有意义，这里直接翻译成「怎么改」
    console.error(`\n${note.rel} 的 frontmatter 不是合法的 YAML：`);
    console.error(`  ${String(err.message ?? err).split("\n")[0]}`);
    console.error("最常见的原因是标题/摘要里带了冒号（如「Rust: 内存模型」）。用双引号包起来即可：");
    console.error('  title: "Rust: 内存模型"\n');
    process.exit(1);
  }
  const { data, content } = parsed;

  const baseName = path.basename(note.file).replace(/\.md$/i, "");
  const dateMatch = DATE_PREFIX.exec(baseName);
  const titleFromName = (dateMatch ? baseName.slice(dateMatch[0].length) : baseName).trim();
  const title = data.title ? String(data.title).trim() : titleFromName;

  const slug =
    slugify(String(data.slug ?? "")) ||
    slugify(titleFromName) ||
    slugify(note.rel.replace(/\.md$/i, ""));

  const stat = fs.statSync(note.file);
  const fileDate = `${stat.mtime.getFullYear()}-${String(stat.mtime.getMonth() + 1).padStart(2, "0")}-${String(stat.mtime.getDate()).padStart(2, "0")}`;
  const date =
    normalizeDate(data.date) ||
    (dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : "") ||
    // Obsidian 笔记常带 created 字段，比文件修改时间更贴近写作时间
    normalizeDate(data.created) ||
    fileDate;

  return { ...note, data, content, title, slug, date, hasSlug: Boolean(data.slug) };
}

function transformNote(note, ctx) {
  const forNote = { ...ctx, rel: note.rel, noteDir: path.dirname(note.file), slug: note.slug };

  let body = note.content;
  body = stripObsidianComments(body);
  body = convertEmbeds(body, forNote);
  body = convertCallouts(body, note.rel);
  body = convertWikilinks(body, forNote);
  body = compactLists(body);
  body = body.replace(/\n{3,}/g, "\n\n").trim();
  body = stripDuplicateHeading(body, note.title);

  const { data } = note;
  const tags = Array.isArray(data.tags)
    ? data.tags.map(String)
    : typeof data.tags === "string"
      ? data.tags.split(/[,\s]+/).filter(Boolean)
      : Array.isArray(data.tag)
        ? data.tag.map(String)
        : [];

  const summary = String(data.summary ?? "").trim() || fallbackSummary(body);

  /** 含换行的值用 YAML 块标量输出，否则 frontmatter 结构会被换行截断 */
  const yamlTitle = /[\n]/.test(note.title)
    ? `|-\n${note.title
        .split("\n")
        .map((line) => `  ${line.trim()}`)
        .join("\n")}`
    : yamlScalar(note.title);

  const front = [
    `title: ${yamlTitle}`,
    `date: ${note.date}`,
    `summary: ${yamlScalar(summary.replace(/\n/g, " "))}`,
    `tags: [${tags.map(yamlScalar).join(", ")}]`,
  ];
  if (data.featured === true) front.push("featured: true");
  if (data.draft === true) front.push("draft: true");
  if (note.hasSlug) front.push(`slug: ${note.slug}`);

  return {
    slug: note.slug,
    source: note.rel,
    mdx: `---\n${front.join("\n")}\n---\n\n${body}\n`,
  };
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

function main() {
  const { dir, label } = resolveSource();
  const vaultRoot = path.dirname(dir);
  const files = collectNotes(dir);

  fs.mkdirSync(POSTS_DIR, { recursive: true });

  const notes = files.map(readNote);

  // 网址是从文件名/title 生成的，两篇同名笔记会写到同一个 .mdx —— 后写的把先写的覆盖掉，
  // 而且清单里只会剩一条，属于「悄悄丢一篇文章」，必须拦下来。
  const bySlug = new Map();
  for (const note of notes) {
    const list = bySlug.get(note.slug) ?? [];
    list.push(note);
    bySlug.set(note.slug, list);
  }
  const clashes = [...bySlug.entries()].filter(([, list]) => list.length > 1);
  if (clashes.length) {
    console.error("\n有笔记会生成同一个网址，同步会互相覆盖（这是会丢文章的错误，已中止）：");
    for (const [slug, list] of clashes) {
      console.error(`\n  /posts/${slug}`);
      for (const n of list) console.error(`    ← ${n.rel}`);
    }
    console.error("\n改掉其中一个的文件名；或者保留文件名，在它的 frontmatter 里写一行 `slug: 另一个网址`。");
    console.error("（如果两篇是同名的草稿，把暂时不发的那篇挪进下划线开头的目录，如 博客/_草稿/ —— 那个目录整个不会被同步。）\n");
    process.exit(1);
  }

  const lookup = new Map();
  for (const note of notes) {
    lookup.set(note.slug.toLowerCase(), note.slug);
    lookup.set(note.title.toLowerCase().replace(/\s+/g, ""), note.slug);
  }

  // 清单结构升级过：早期版本直接是 {slug: 来源}，读的时候兼容一下
  const rawManifest = fs.existsSync(MANIFEST)
    ? JSON.parse(fs.readFileSync(MANIFEST, "utf8"))
    : {};
  const previousPosts = rawManifest.posts ?? rawManifest;
  const previousImages = Array.isArray(rawManifest.images) ? rawManifest.images : [];

  // 安全闸门：一次同步要删掉大半文章，通常不是作者真的删了稿子，而是源目录设错了
  // （BLOG_VAULT_DIR 指到了别处、vault 改了名）。这种情况必须先确认再动手删。
  const incoming = new Set(notes.map((n) => n.slug));
  const staleSlugs = Object.keys(previousPosts).filter((slug) => !incoming.has(slug));
  const previousCount = Object.keys(previousPosts).length;
  if (
    !process.argv.includes("--force") &&
    previousCount >= 3 &&
    staleSlugs.length / previousCount > 0.5
  ) {
    console.error(
      `\n本次同步会删除 ${staleSlugs.length}/${previousCount} 篇文章：${staleSlugs.join("、")}`,
    );
    console.error("这个比例不正常，多半是源目录指错了。请检查：");
    console.error(`  · blog.config.json 里的 vault 与 folder（当前：${label}）`);
    console.error("  · BLOG_VAULT_DIR 环境变量是否指向了别处");
    console.error("确实要删就加上 --force 重新运行。\n");
    process.exit(1);
  }

  const current = {};
  const usedImages = new Set();
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const note of notes) {
    const { slug, mdx, source } = transformNote(note, { vaultRoot, lookup });
    for (const m of mdx.matchAll(/\/images\/([^\s")]+)/g)) usedImages.add(m[1]);

    const target = path.join(POSTS_DIR, `${slug}.mdx`);
    const before = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
    if (before !== mdx) fs.writeFileSync(target, mdx, "utf8");
    current[slug] = source;

    if (before === null) {
      created += 1;
      console.log(`  新增  ${slug}  ← ${source}`);
    } else if (before !== mdx) {
      updated += 1;
      console.log(`  更新  ${slug}  ← ${source}`);
    } else {
      unchanged += 1;
    }
  }

  // vault 里删掉的同步删掉；只动清单里记录过的文件，手写的文章不受影响
  let removed = 0;
  for (const slug of staleSlugs) {
    const stale = path.join(POSTS_DIR, `${slug}.mdx`);
    if (fs.existsSync(stale)) {
      fs.unlinkSync(stale);
      removed += 1;
      console.log(`  删除  ${slug}（vault 里已不存在）`);
    }
  }

  // 顺带清掉不再被引用的配图。判定前把所有文章（含手写的）都扫一遍，避免误删
  let orphans = 0;
  if (previousImages.length) {
    const referenced = new Set(usedImages);
    for (const file of fs.readdirSync(POSTS_DIR)) {
      if (!/\.mdx?$/.test(file)) continue;
      const text = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      for (const m of text.matchAll(/\/images\/([^\s")]+)/g)) referenced.add(m[1]);
    }
    for (const image of previousImages) {
      if (referenced.has(image)) continue;
      const file = path.join(IMAGES_DIR, decodeURIComponent(image));
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        orphans += 1;
        console.log(`  清理  配图 ${decodeURIComponent(image)}（已无文章引用）`);
      }
    }
  }

  fs.writeFileSync(
    MANIFEST,
    `${JSON.stringify({ posts: current, images: [...usedImages] }, null, 2)}\n`,
    "utf8",
  );

  if (notes.length === 0) {
    console.log(`「${label}」里还没有笔记。`);
    console.log("提示：下划线开头的文件名会被跳过（说明、模板放这类文件）。");
  }

  console.log(
    `\n同步完成：${label} → content/posts/（新增 ${created}，更新 ${updated}，未变化 ${unchanged}，删除 ${removed}）`,
  );
  if (orphans) console.log(`顺带清理了 ${orphans} 张不再引用的配图。`);
  if (warnings.length) {
    console.log("\n需要注意：");
    for (const w of warnings) console.log(`  · ${w}`);
  }
}

main();
