"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 全站入场动效的驱动器。
 *
 * 刻意不做成包裹组件：把每个区块包进客户端组件，会让整棵子树变成
 * 客户端渲染。这里只在挂载后统一观察所有 .reveal 元素，
 * 页面内容依旧全部由服务端渲染。
 *
 * 依赖 pathname：根布局在客户端路由切换时不重挂载，
 * 若只靠挂载时的一次扫描，新页面的 .reveal 元素会永远停在
 * opacity: 0（表现为「点进标签再返回，文章页一片空白」）。
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (items.length === 0) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
