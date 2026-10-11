"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * 主题切换。
 * 首帧的主题已由 layout 里的内联脚本设好，这里只负责读取与改写，
 * 不做「挂载后同步」——否则会和内联脚本打架，反而闪一下。
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* 隐私模式下 localStorage 不可用，忽略即可 */
    }
  }

  return (
    <button
      className="icon-btn"
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
      aria-pressed={theme === "dark"}
    >
      {/* 首帧未知主题时两枚图标都隐藏，避免闪错 */}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ display: theme === "dark" ? "none" : "block" }}
      >
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M5.8 5.8 4.3 4.3M19.7 19.7l-1.5-1.5M18.2 5.8l1.5-1.5M4.3 19.7l1.5-1.5" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ display: theme === "dark" ? "block" : "none" }}
      >
        <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.6 8.6 0 1 0 20 14.2Z" />
      </svg>
    </button>
  );
}
