"use client";

import type { ReactNode } from "react";

/** 打开搜索面板的通用按钮，样式由外部传入 */
export function OpenSearchButton({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      className={className}
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("margin:search"))}
    >
      {children ?? "搜索文章"}
    </button>
  );
}
