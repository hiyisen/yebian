"use client";

import { useEffect, useRef, useState } from "react";

type State = "idle" | "done" | "failed";

/** 优先用异步剪贴板 API，失败时退回旧方案；两条路都走不通才算失败 */
async function writeClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 权限被拒或非安全上下文 —— 继续尝试降级方案
    }
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    // 放在视口内但不可见，否则部分浏览器不会把内容放进剪贴板
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 复制按钮。
 * 刻意做成独立的小客户端组件 —— 代码高亮的几百个 span 由服务端渲染，
 * 不能因为一个按钮就把整块代码拖进客户端包。
 */
export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    const ok = await writeClipboard(text);
    setState(ok ? "done" : "failed");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1800);
  }

  const label = state === "done" ? "已复制" : state === "failed" ? "复制失败" : "复制";

  return (
    <button
      className={state === "idle" ? "copy" : `copy is-${state}`}
      type="button"
      onClick={copy}
      aria-label="复制代码"
      aria-live="polite"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {state === "done" ? (
          <path d="m4.5 12.5 5 5 10-11" />
        ) : (
          <>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </>
        )}
      </svg>
      {label}
    </button>
  );
}
