#!/usr/bin/env node
/**
 * 一键发布：同步 → 构建校验 → 提交 → 推送。
 *
 *   npm run publish
 *
 * 推送后 Vercel 会自动重新构建上线。构建失败会**中止**，
 * 不会把坏内容推上去 —— 这是这个脚本存在的唯一理由：
 * 让「写完笔记就不管了」这件事不冒险。
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: "utf8", shell: false, ...opts });

const line = (title) => console.log(`\n\x1b[1m▸ ${title}\x1b[0m`);

/* ---------------- 1. 同步 ---------------- */

line("从 Obsidian 同步");
const sync = run(process.execPath, ["scripts/sync-from-vault.mjs"]);
process.stdout.write(sync.stdout ?? "");
if (sync.status !== 0) {
  process.stderr.write(sync.stderr ?? "");
  console.error("\n同步失败，已中止。");
  process.exit(1);
}

const added = [...(sync.stdout ?? "").matchAll(/^\s+新增\s+(\S+)/gm)].map((m) => m[1]);
const updated = [...(sync.stdout ?? "").matchAll(/^\s+更新\s+(\S+)/gm)].map((m) => m[1]);
const removed = [...(sync.stdout ?? "").matchAll(/^\s+删除\s+(\S+)/gm)].map((m) => m[1]);

/* ---------------- 2. 构建校验 ---------------- */

line("构建校验（这一步不过就不会提交）");
const build = run("npm", ["run", "build"], { stdio: "inherit", encoding: "utf8" });
if (build.status !== 0) {
  console.error("\n构建失败，已中止。内容还留在本地，修好后再跑一次 publish。");
  process.exit(1);
}

/* ---------------- 3. 提交 ---------------- */

line("提交");
run("git", ["add", "-A"]);
const staged = run("git", ["diff", "--cached", "--quiet"]);
if (staged.status === 0) {
  console.log("没有需要提交的改动，同步与构建都已完成。");
  process.exit(0);
}

const summary = [];
if (added.length) summary.push(`新增 ${added.length} 篇`);
if (updated.length) summary.push(`更新 ${updated.length} 篇`);
if (removed.length) summary.push(`删除 ${removed.length} 篇`);

// 除了文章与配图，还夹带了别的文件（改了样式、脚本之类）——提交信息要如实反映，
// 否则回头看历史会以为那次只是发了篇文章
const stagedFiles = (run("git", ["diff", "--cached", "--name-only"]).stdout ?? "")
  .trim()
  .split("\n")
  .filter(Boolean);
const contentOnly = stagedFiles.every(
  (f) =>
    f.startsWith("content/posts/") ||
    f.startsWith("public/images/") ||
    f === "content/.vault-manifest.json",
);
const otherFiles = stagedFiles.filter(
  (f) =>
    !f.startsWith("content/posts/") &&
    !f.startsWith("public/images/") &&
    f !== "content/.vault-manifest.json",
);

const subject =
  contentOnly && summary.length
    ? `post: 发布文章（${summary.join("，")}）`
    : contentOnly
      ? "post: 同步内容更新"
      : `chore: 内容同步与仓库改动${summary.length ? `（${summary.join("，")}）` : ""}`;

const body = [
  ...added.map((s) => `新增 ${s}`),
  ...updated.map((s) => `更新 ${s}`),
  ...removed.map((s) => `删除 ${s}`),
  ...(otherFiles.length ? ["", `其他改动：${otherFiles.join("、")}`] : []),
].join("\n");

console.log(`提交信息：${subject}`);

const commit = run("git", ["commit", "-m", subject, ...(body ? ["-m", body] : [])]);
process.stdout.write(commit.stdout ?? "");
if (commit.status !== 0) {
  process.stderr.write(commit.stderr ?? "");
  console.error("\n提交失败，已中止（改动仍在工作区）。");
  process.exit(1);
}

/* ---------------- 4. 推送 ---------------- */

line("推送");
const branch = (run("git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout ?? "main").trim();
let push = run("git", ["push"]);
if (push.status !== 0 && /no upstream|set-upstream/i.test(push.stderr ?? "")) {
  push = run("git", ["push", "-u", "origin", branch]);
}
if (push.status !== 0) {
  process.stderr.write(push.stderr ?? "");
  console.error("\n推送失败。提交已经留在本地，网络恢复后 `git push` 一次即可。");
  process.exit(1);
}
process.stdout.write(push.stdout ?? "");

console.log("\n✅ 已推送。Vercel 会自动重新构建，大约一分钟后生效。");
console.log("   线上地址：https://yebian.vercel.app");
