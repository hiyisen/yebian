"use client";

import { useState } from "react";

/** 复制 RSS 地址 —— 比一个假的邮箱订阅表单实在 */
export function CopyRssLink() {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/rss.xml`);
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      /* 剪贴板不可用时保持原样，用户还可以点「订阅 RSS」 */
    }
  }

  return (
    <button className="btn-ghost" type="button" onClick={copy}>
      {done ? "已复制地址" : "复制 RSS 地址"}
    </button>
  );
}
