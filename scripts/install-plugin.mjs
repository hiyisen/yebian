#!/usr/bin/env node
/**
 * 把一个 Obsidian 插件装进 vault。
 *
 *   npm run plugin
 *
 * 目前只有一个：tools/obsidian-plugin/ → 「博客发布」。
 * 它的作用是给 Obsidian 加一个左侧栏图标，点一下就等于执行 npm run publish。
 *
 * vault 的位置跟 sync-from-vault.mjs 用的是同一套办法：运行时去读 Obsidian
 * 自己的 vault 清单，所以换电脑、改 vault 名字都不用动代码。
 *
 * 只写 <vault>/.obsidian/plugins/<id>/，不碰 vault 里的其他任何东西。
 * 也不改 community-plugins.json —— 那个文件 Obsidian 退出时会从内存回写，
 * 在外面改容易被覆盖；启用插件请在 Obsidian 里点一次开关（只需一次）。
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "tools", "obsidian-plugin");
const CONFIG = path.join(ROOT, "blog.config.json");
const FILES = ["manifest.json", "main.js", "styles.css"];

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

function resolveVault() {
  if (process.env.BLOG_VAULT_DIR) {
    return path.dirname(process.env.BLOG_VAULT_DIR);
  }
  if (!fs.existsSync(CONFIG)) {
    console.error("缺少 blog.config.json，无法确定 vault 位置。");
    process.exit(1);
  }
  const { vault } = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  const match = obsidianVaults().find((p) => path.basename(p) === vault);
  if (!match) {
    console.error(`在 Obsidian 的 vault 清单里找不到名为「${vault}」的 vault。`);
    console.error("可用：", obsidianVaults().map((p) => path.basename(p)).join("、") || "（一个都没有）");
    process.exit(1);
  }
  return match;
}

/* ------------------------------------------------------------------ */

if (!fs.existsSync(SRC_DIR)) {
  console.error(`找不到插件源码目录：${SRC_DIR}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "manifest.json"), "utf8"));
const pluginId = manifest.id;

const vault = resolveVault();
const pluginsDir = path.join(vault, ".obsidian", "plugins");
if (!fs.existsSync(pluginsDir)) {
  console.error(`vault 里没有插件目录：${pluginsDir}`);
  process.exit(1);
}

const target = path.join(pluginsDir, pluginId);
fs.mkdirSync(target, { recursive: true });

console.log(`\n▸ 安装「${manifest.name}」→ ${target}`);

const changed = [];
for (const file of FILES) {
  const from = path.join(SRC_DIR, file);
  const to = path.join(target, file);
  if (!fs.existsSync(from)) {
    console.error(`  缺少源文件：${from}`);
    process.exit(1);
  }
  const next = fs.readFileSync(from);
  const current = fs.existsSync(to) ? fs.readFileSync(to) : null;

  if (current && current.equals(next)) {
    console.log(`  未变化  ${file}`);
    continue;
  }
  fs.writeFileSync(to, next);
  console.log(`  ${current ? "更新" : "新增"}    ${file}`);
  changed.push(file);
}

/* 校验：写完之后再读一遍对比，确保真的落盘了 */
for (const file of FILES) {
  const a = fs.readFileSync(path.join(SRC_DIR, file));
  const b = fs.readFileSync(path.join(target, file));
  if (!a.equals(b)) {
    console.error(`\n复制校验失败：${file} 内容不一致。`);
    process.exit(1);
  }
}

if (changed.length === 0) {
  console.log("\n已经是最新的，没有改动。");
} else {
  console.log(`\n✅ 装好了（改动 ${changed.length} 个文件）。`);
}

console.log("\n接下来：");
console.log("  1. 重启 Obsidian（⌘Q 再打开）—— 插件是启动时加载的，不重启看不到");
console.log("  2. 如果左侧栏没出现火箭图标，去 设置 → 第三方插件 里打开「博客发布」");
console.log("  3. 之后点那个图标（或按 ⌘⇧P）就是发布博客\n");
