/*
 * 博客发布 —— 一个只做一件事的 Obsidian 插件。
 *
 * 点左侧栏的火箭图标（或按 ⌘⇧P），等于在博客仓库里执行：
 *
 *     npm run publish      同步 → 构建校验 → 提交 → 推送
 *
 * 构建不通过就中止，不会把坏内容推上去；Vercel 收到推送后自动上线。
 *
 * 这个插件没有第三方依赖，只用 Obsidian 自带 API 和 Node 的 child_process。
 */

const { Plugin, Notice, Modal, PluginSettingTab, Setting } = require("obsidian");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/* ------------------------------------------------------------------ *
 * 环境探测
 *
 * Obsidian 从访达启动时，PATH 只有 /usr/bin:/bin:/usr/sbin:/sbin，
 * 找不到 npm。这里按优先级把常见的 node 安装位置补上。
 * ------------------------------------------------------------------ */

function candidateBins() {
  const home = os.homedir();
  const bins = [];

  // Homebrew（最常见的系统 node）
  bins.push("/opt/homebrew/bin", "/usr/local/bin");

  // WorkBuddy 自带的 node
  const managedRoot = path.join(home, ".workbuddy/binaries/node/versions");
  try {
    const versions = fs
      .readdirSync(managedRoot)
      .filter((v) => /^\d+\.\d+\.\d+/.test(v))
      .sort(compareVersions)
      .reverse();
    for (const v of versions) bins.push(path.join(managedRoot, v, "bin"));
  } catch (err) {
    /* 没装就没有 */
  }

  // nvm
  const nvmRoot = path.join(home, ".nvm/versions/node");
  try {
    const versions = fs
      .readdirSync(nvmRoot)
      .filter((v) => /^v?\d+/.test(v))
      .sort(compareVersions)
      .reverse();
    for (const v of versions) bins.push(path.join(nvmRoot, v, "bin"));
  } catch (err) {
    /* 没装就没有 */
  }

  return [...new Set(bins)];
}

function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, "").split(".").map(Number);
  const pb = String(b).replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function fullPath() {
  return [...candidateBins(), "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":");
}

function resolveNpm() {
  for (const dir of candidateBins()) {
    const candidate = path.join(dir, "npm");
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (err) {
      /* 忽略 */
    }
  }
  return "npm"; // 交给 PATH 兜底
}

/* ------------------------------------------------------------------ *
 * 输出处理
 * ------------------------------------------------------------------ */

/* eslint-disable no-control-regex */
const stripAnsi = (text) => String(text).replace(/\u001b\[[0-9;]*m/g, "");

/* publish.mjs 会打印「▸ 从 Obsidian 同步」这类分步标题，据此显示进度 */
const STEPS = [
  { re: /▸\s*从 Obsidian 同步/, label: "同步" },
  { re: /▸\s*构建校验/, label: "构建校验" },
  { re: /▸\s*提交/, label: "提交" },
  { re: /▸\s*推送/, label: "推送" },
];

const FAIL_HINTS = [
  "同步失败",
  "构建失败",
  "提交失败",
  "推送失败",
  "这个比例不正常",
  "网址冲突",
  "slug 冲突",
  "frontmatter",
];

/** 从日志里挑一句人话当失败原因，不要甩一屏堆栈 */
function summarizeFailure(log) {
  const lines = stripAnsi(log)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const cut = (text) => (text.length > 200 ? `${text.slice(0, 200)}…` : text);

  // 1) 我们自己脚本报的错，措辞已经是给人看的
  for (const hint of FAIL_HINTS) {
    const index = lines.findIndex((line) => line.includes(hint));
    if (index >= 0) return cut(lines.slice(index, index + 2).join(" "));
  }

  // 2) npm / node 抛的错：挑第一条真正的原因，
  //    跳过「日志在哪」这类正确的废话（它总是最后一行）
  const noise = /A complete log of this run|debug-0\.log/i;
  const npmError = lines.find((line) => /^(npm\s+)?error\b/i.test(line) && !noise.test(line));
  if (npmError) return cut(npmError.replace(/^npm\s+error\s*/i, ""));

  // 3) 兜底
  return cut(lines[lines.length - 1] ?? "未知错误");
}

/* ------------------------------------------------------------------ *
 * 日志窗口
 * ------------------------------------------------------------------ */

class LogModal extends Modal {
  constructor(app, title, log) {
    super(app);
    this.logTitle = title;
    this.logText = log;
  }

  onOpen() {
    this.titleEl.setText(this.logTitle);
    this.contentEl.addClass("blog-publisher-log");

    const pre = this.contentEl.createEl("pre");
    pre.setText(this.logText);

    const actions = this.contentEl.createDiv({ cls: "blog-publisher-log-actions" });
    const copy = actions.createEl("button", { text: "复制全部" });
    copy.onclick = () => {
      navigator.clipboard.writeText(this.logText);
      new Notice("日志已复制到剪贴板");
    };
    const close = actions.createEl("button", { text: "关闭" });
    close.onclick = () => this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ------------------------------------------------------------------ *
 * 设置面板
 * ------------------------------------------------------------------ */

class BlogPublisherSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("博客仓库路径")
      .setDesc("「页边 MARGIN」这个项目的本地目录，里面应该有 scripts/publish.mjs。")
      .addText((text) =>
        text
          .setPlaceholder("/路径/到/blog")
          .setValue(this.plugin.settings.repoPath)
          .onChange(async (value) => {
            this.plugin.settings.repoPath = value.trim();
            await this.plugin.saveData(this.plugin.settings);
          }),
      );

    new Setting(containerEl)
      .setName("点按钮前先确认")
      .setDesc("开启后，点发布图标会先弹一句确认，避免误触。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.confirmBeforePublish).onChange(async (value) => {
          this.plugin.settings.confirmBeforePublish = value;
          await this.plugin.saveData(this.plugin.settings);
        }),
      );

    new Setting(containerEl)
      .setName("失败时自动打开日志")
      .setDesc("发布失败时直接弹出完整日志，省得再去开终端。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.openLogOnError).onChange(async (value) => {
          this.plugin.settings.openLogOnError = value;
          await this.plugin.saveData(this.plugin.settings);
        }),
      );

    new Setting(containerEl)
      .setName("环境自检")
      .setDesc("检查仓库路径、npm、node 是否都能找到。")
      .addButton((button) =>
        button.setButtonText("检查").onClick(() => {
          const lines = [
            `仓库：${this.plugin.settings.repoPath}`,
            `publish 脚本：${
              fs.existsSync(path.join(this.plugin.settings.repoPath, "scripts", "publish.mjs"))
                ? "找到"
                : "❌ 没找到"
            }`,
            `npm：${resolveNpm()}`,
            `PATH：${fullPath()}`,
          ];
          new LogModal(this.app, "环境自检", lines.join("\n")).open();
        }),
      );
  }
}

/* ------------------------------------------------------------------ *
 * 插件本体
 * ------------------------------------------------------------------ */

const DEFAULT_SETTINGS = {
  repoPath: "/Users/yjh/WorkBuddy/2026-10-10-20-56-05/blog",
  confirmBeforePublish: false,
  openLogOnError: true,
};

module.exports = class BlogPublisher extends Plugin {
  async onload() {
    const saved = (await this.loadData()) ?? {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    if (!saved.repoPath) await this.saveData(this.settings);

    this.busy = false;
    this.devProcess = null;
    this.log = "";

    this.statusEl = this.addStatusBarItem();

    this.addRibbonIcon("rocket", "发布博客（同步 → 校验 → 推送）", () => this.publish());

    this.addCommand({
      id: "publish",
      name: "发布博客（同步 → 校验 → 提交 → 推送）",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "p" }],
      callback: () => this.publish(),
    });

    this.addCommand({
      id: "sync-only",
      name: "仅同步文章（不发布）",
      callback: () => this.runOnce("sync", "同步"),
    });

    this.addCommand({
      id: "preview-start",
      name: "本地预览：启动",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "l" }],
      callback: () => this.startPreview(),
    });

    this.addCommand({
      id: "preview-stop",
      name: "本地预览：停止",
      callback: () => this.stopPreview(false),
    });

    this.addCommand({
      id: "show-log",
      name: "查看上次发布日志",
      callback: () => new LogModal(this.app, "上次发布日志", this.log || "（还没有发布记录）").open(),
    });

    this.addSettingTab(new BlogPublisherSettingTab(this.app, this));
  }

  onunload() {
    this.stopPreview(true);
  }

  /* ---------------------------- 小工具 ---------------------------- */

  setStatus(text) {
    this.statusEl.setText(text ? `🚀 ${text}` : "");
  }

  repoIsReady() {
    const repo = this.settings.repoPath;
    if (repo && fs.existsSync(path.join(repo, "scripts", "publish.mjs"))) return true;
    new Notice(`找不到博客仓库：${repo}\n请在「博客发布」插件设置里改正路径。`, 12000);
    return false;
  }

  openUrl(url) {
    try {
      require("electron").shell.openExternal(url);
    } catch (err) {
      try {
        window.open(url);
      } catch (err2) {
        new Notice(`请手动在浏览器打开：${url}`);
      }
    }
  }

  /**
   * 跑一个命令，边跑边把输出喂给 onData。
   * 返回 { code, output }。不抛异常 —— 出错也要有可读的结果。
   */
  spawnCapture(cmd, args, cwd, onData, timeoutMs) {
    return new Promise((resolve) => {
      let output = "";
      let settled = false;
      let child;

      const finish = (code) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve({ code, output });
      };

      try {
        child = spawn(cmd, args, {
          cwd,
          env: Object.assign({}, process.env, {
            PATH: fullPath(),
            FORCE_COLOR: "0",
            NO_COLOR: "1",
          }),
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (err) {
        finish(-1);
        onData?.(`启动失败：${err}\n`);
        return;
      }

      const timer = timeoutMs
        ? setTimeout(() => {
            onData?.(`\n⏱ 超过 ${Math.round(timeoutMs / 1000)} 秒还没有结束，已中止。\n`);
            try {
              child.kill("SIGTERM");
            } catch (err) {
              /* 忽略 */
            }
            finish(-2);
          }, timeoutMs)
        : null;

      const push = (buf) => {
        const text = buf.toString("utf8");
        output += text;
        onData?.(text);
      };

      child.stdout.on("data", push);
      child.stderr.on("data", push);
      child.on("error", (err) => {
        output += `\n${err}\n`;
        onData?.(`\n${err}\n`);
        finish(-1);
      });
      child.on("close", (code) => finish(code ?? -1));
    });
  }

  /** 仅执行一条 npm 脚本（同步 / 构建之类），结果只弹提示 */
  async runOnce(script, label) {
    if (this.busy) {
      new Notice("还有一步正在进行中，请稍候…");
      return;
    }
    if (!this.repoIsReady()) return;

    this.busy = true;
    this.log = "";
    this.setStatus(`${label}中…`);
    const notice = new Notice(`正在${label}…`, 0);

    const result = await this.spawnCapture(
      resolveNpm(),
      ["run", script],
      this.settings.repoPath,
      (chunk) => {
        this.log += chunk;
      },
      5 * 60 * 1000,
    );

    notice.hide();
    this.busy = false;

    if (result.code === 0) {
      this.setStatus(`${label}完成 ✓`);
      new Notice(`✅ ${label}完成`);
      setTimeout(() => this.setStatus(""), 8000);
    } else {
      this.setStatus(`${label}失败`);
      new Notice(`❌ ${label}失败：${summarizeFailure(result.output)}`, 12000);
      new LogModal(this.app, `${label}失败`, stripAnsi(result.output)).open();
    }
  }

  /* ---------------------------- 发布 ---------------------------- */

  async publish() {
    if (this.busy) {
      new Notice("发布正在进行中，请稍候…");
      return;
    }
    if (!this.repoIsReady()) return;

    if (this.settings.confirmBeforePublish) {
      const ok = await this.ask("现在发布博客？", "会同步文章 → 构建校验 → 提交 → 推送。");
      if (!ok) return;
    }

    this.busy = true;
    this.log = "";
    this.setStatus("发布中 0/4…");

    const notice = new Notice("📦 开始发布…（约 1 分钟）", 0);
    const say = (text) => {
      if (typeof notice.setMessage === "function") notice.setMessage(text);
    };

    const result = await this.spawnCapture(
      resolveNpm(),
      ["run", "publish"],
      this.settings.repoPath,
      (chunk) => {
        this.log += chunk;
        const clean = stripAnsi(this.log);
        let step = 0;
        for (let i = 0; i < STEPS.length; i++) {
          if (STEPS[i].re.test(clean)) step = i + 1;
        }
        if (step > 0) {
          const label = STEPS[step - 1].label;
          this.setStatus(`${label} ${step}/4…`);
          say(`📦 ${label}（${step}/4）…`);
        }
      },
      8 * 60 * 1000,
    );

    notice.hide();
    this.busy = false;

    const clean = stripAnsi(result.output);

    if (result.code === 0) {
      this.setStatus("已发布 ✓");
      new Notice("✅ 已发布。Vercel 正在构建，约 1 分钟后生效。", 10000);
      setTimeout(() => this.setStatus(""), 20000);
      return;
    }

    this.setStatus("发布失败");
    if (result.code === -2) {
      new Notice("⏱ 发布超时，已中止。内容还在本地，稍后重试即可。", 12000);
    } else {
      new Notice(`❌ 发布失败：${summarizeFailure(clean)}`, 15000);
    }

    if (this.settings.openLogOnError) {
      new LogModal(this.app, "发布失败 —— 完整日志", clean).open();
    }
  }

  ask(title, body) {
    return new Promise((resolve) => {
      let answered = false;
      const modal = new Modal(this.app);
      modal.titleEl.setText(title);
      modal.contentEl.createEl("p", { text: body });

      const bar = modal.contentEl.createDiv({ cls: "blog-publisher-log-actions" });
      const yes = bar.createEl("button", { text: "发布", cls: "mod-cta" });
      const no = bar.createEl("button", { text: "取消" });

      const done = (value) => {
        if (answered) return;
        answered = true;
        modal.close();
        resolve(value);
      };

      yes.onclick = () => done(true);
      no.onclick = () => done(false);
      modal.onClose = () => {
        modal.contentEl.empty();
        done(false);
      };
      modal.open();
    });
  }

  /* -------------------------- 本地预览 -------------------------- */

  startPreview() {
    if (this.devProcess) {
      new Notice("本地预览已经在跑：http://localhost:3000");
      this.openUrl("http://localhost:3000");
      return;
    }
    if (!this.repoIsReady()) return;

    this.log = "";
    this.setStatus("预览启动中…");

    try {
      this.devProcess = spawn(resolveNpm(), ["run", "dev"], {
        cwd: this.settings.repoPath,
        env: Object.assign({}, process.env, { PATH: fullPath(), FORCE_COLOR: "0", NO_COLOR: "1" }),
        detached: true, // 独立进程组，方便连 next 的子进程一起收掉
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      new Notice(`启动失败：${err}`);
      this.setStatus("");
      return;
    }

    this.devProcess.stdout.on("data", (buf) => {
      this.log += buf.toString("utf8");
    });
    this.devProcess.stderr.on("data", (buf) => {
      this.log += buf.toString("utf8");
    });
    this.devProcess.on("close", () => {
      this.devProcess = null;
      this.setStatus("");
    });

    new Notice("🚀 预览启动中，几秒后会自动打开 http://localhost:3000", 8000);
    setTimeout(() => {
      this.setStatus("预览中 :3000");
      this.openUrl("http://localhost:3000");
    }, 4000);
  }

  stopPreview(silent) {
    if (!this.devProcess) {
      if (!silent) new Notice("本地预览没有在运行。");
      return;
    }
    try {
      process.kill(-this.devProcess.pid, "SIGTERM"); // 整个进程组
    } catch (err) {
      try {
        this.devProcess.kill("SIGTERM");
      } catch (err2) {
        /* 已经退出了 */
      }
    }
    this.devProcess = null;
    this.setStatus("");
    if (!silent) new Notice("本地预览已停止。");
  }
};
