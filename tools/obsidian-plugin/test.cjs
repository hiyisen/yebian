/*
 * 博客发布插件 —— 离线功能测试。
 *
 *   npm run test:plugin              测仓库里的源码
 *   node tools/obsidian-plugin/test.cjs <main.js 路径>   测别处的副本
 *
 * 用一个假的 obsidian 模块把插件加载起来，验证：
 *   1. onload 不报错，挂上 1 个 ribbon 图标 + 5 条命令
 *   2. 命令 id / name / 默认快捷键符合预期
 *   3. 能真的跑起 npm（Obsidian 那种很窄的 PATH 下也找得到）
 *   4. 成功路径给出成功提示；失败路径能把原因说人话、不甩堆栈
 *   5. 日志窗口能拿到完整输出
 */

const Module = require("module");
const fs = require("fs");
const path = require("path");

const PLUGIN = process.argv[2] ?? path.join(__dirname, "main.js");

/* ---------------- 测试脚手架 ---------------- */

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
};

const calls = { ribbons: [], commands: [], notices: [], modals: [], status: [] };

class Notice {
  constructor(message, duration) {
    this.message = message;
    calls.notices.push(message);
  }
  setMessage(m) {
    this.message = m;
    calls.notices.push(m);
  }
  hide() {}
}

class Modal {
  constructor(app, title, text) {
    this.app = app;
    this.modalTitle = title;
    this.modalText = text;
    this.titleEl = { setText(t) { this.text = t; } };
    this.contentEl = {
      children: [],
      addClass() {},
      empty() {},
      createEl: (tag, opts) => {
        const el = { tag, text: opts?.text ?? "", onclick: null, setText(t) { this.text = t; } };
        this.contentEl.children.push(el);
        return el;
      },
      createDiv: () => {
        const d = { children: [], createEl: (tag, opts) => {
          const el = { tag, text: opts?.text ?? "", onclick: null, setText() {} };
          d.children.push(el);
          return el;
        } };
        return d;
      },
    };
  }
  open() {
    // 忠实模拟 Obsidian：open() 会触发 onOpen()
    calls.modals.push(this);
    if (typeof this.onOpen === "function") this.onOpen();
  }
  close() {
    if (typeof this.onClose === "function") this.onClose();
  }
}

class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
  }
}

class Setting {
  constructor() {}
  setName() { return this; }
  setDesc() { return this; }
  addText() { return this; }
  addToggle() { return this; }
  addButton() { return this; }
}

class Plugin {
  constructor() {
    this.app = {};
  }
  async loadData() { return null; }
  async saveData() {}
  addStatusBarItem() {
    return { setText: (t) => calls.status.push(t) };
  }
  addRibbonIcon(icon, title, cb) {
    calls.ribbons.push({ icon, title });
    return { onclick: cb };
  }
  addCommand(cmd) {
    calls.commands.push(cmd);
  }
  addSettingTab() {}
}

/* 拦掉 require("obsidian") */
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") return { Plugin, Notice, Modal, PluginSettingTab, Setting };
  return originalLoad.apply(this, arguments);
};

const PluginClass = require(PLUGIN);

/* ---------------- 开跑 ---------------- */

(async () => {
  console.log("\n▸ 加载插件");
  const plugin = new PluginClass();
  await plugin.onload();
  ok(true, "onload() 没有抛异常");

  console.log("\n▸ 注册的入口");
  ok(calls.ribbons.length === 1, `左侧栏 1 个图标（实际 ${calls.ribbons.length} 个）`);
  ok(calls.ribbons[0]?.title.includes("发布博客"), `图标提示语：${calls.ribbons[0]?.title}`);
  ok(calls.commands.length === 5, `命令面板 5 条命令（实际 ${calls.commands.length} 条）`);

  const ids = calls.commands.map((c) => c.id);
  ok(
    JSON.stringify(ids) === JSON.stringify(["publish", "sync-only", "preview-start", "preview-stop", "show-log"]),
    `命令 id：${ids.join(", ")}`,
  );

  const publishCmd = calls.commands.find((c) => c.id === "publish");
  ok(
    publishCmd.hotkeys?.[0]?.modifiers?.join("+") === "Mod+Shift" && publishCmd.hotkeys[0].key === "p",
    `发布默认快捷键：⌘⇧${publishCmd.hotkeys?.[0]?.key?.toUpperCase()}`,
  );

  console.log("\n▸ 路径解析（模拟 Obsidian 那种很窄的 PATH）");
  const realPath = process.env.PATH;
  process.env.PATH = "/usr/bin:/bin"; // 只剩系统自带目录，npm 就不在 PATH 里了
  ok(plugin.settings.repoPath.endsWith("blog"), `仓库路径：${plugin.settings.repoPath}`);
  const repoReady = fs.existsSync(path.join(plugin.settings.repoPath, "scripts", "publish.mjs"));
  ok(repoReady, "publish.mjs 存在");

  if (!repoReady) {
    console.log("\n⚠ 本机没有这个博客仓库，跳过需要真跑 npm 的两段（只测插件逻辑）");
  } else {
    console.log("\n▸ 真跑一次「仅同步」（PATH 里没有 npm，靠插件自己补齐）");
    calls.notices.length = 0;
    await plugin.runOnce("sync", "同步");
    const syncOut = plugin.log;
    ok(syncOut.length > 0, "拿到了 npm 的真实输出");
    ok(
      calls.notices.some((n) => n.includes("完成")),
      `成功提示：${calls.notices.find((n) => n.includes("完成")) ?? calls.notices[calls.notices.length - 1]}`,
    );
    ok(!calls.notices.some((n) => n.includes("❌")), "没有误报失败");

    console.log("\n▸ 失败路径要说人话");
    calls.notices.length = 0;
    calls.modals.length = 0;
    await plugin.runOnce("这个脚本不存在", "测试");

    const failNotice = calls.notices.find((n) => n.includes("❌"));
    ok(Boolean(failNotice), `失败提示：${failNotice}`);
    ok(Boolean(failNotice) && !failNotice.includes("at Object.") && !failNotice.includes("stack"), "失败提示里没有堆栈");
    ok(
      Boolean(failNotice) && !/complete log of this run/i.test(failNotice),
      "失败提示没有抓错行（不是「日志在哪」那句噪音）",
    );
    ok(
      Boolean(failNotice) && /Missing script|missing script|不存在/i.test(failNotice),
      "失败提示说清了真正的原因",
    );

    const modal = calls.modals[0];
    const preText = modal?.contentEl?.children?.find((c) => c.tag === "pre")?.text ?? "";
    ok(calls.modals.length === 1, "失败时自动弹出了日志窗口");
    ok(Boolean(modal?.titleEl?.text?.includes("失败")), `日志窗口标题：${modal?.titleEl?.text}`);
    ok(preText.length > 0, `日志窗口里有内容（${preText.length} 字符）`);
  }

  console.log("\n▸ 防重复触发");
  calls.notices.length = 0;
  plugin.busy = true;
  await plugin.publish();
  ok(calls.notices.some((n) => n.includes("正在进行中")), "上一步没结束时再点会被挡住");
  plugin.busy = false;

  console.log("\n▸ 仓库路径写错时的表现");
  calls.notices.length = 0;
  const goodRepo = plugin.settings.repoPath;
  plugin.settings.repoPath = "/tmp/根本没有这个仓库";
  await plugin.publish();
  ok(calls.notices.some((n) => n.includes("找不到博客仓库")), "会明确说找不到仓库，而不是抛异常");
  plugin.settings.repoPath = goodRepo;

  process.env.PATH = realPath;

  console.log(`\n${fail === 0 ? "✅" : "❌"} 通过 ${pass} 项，失败 ${fail} 项\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
