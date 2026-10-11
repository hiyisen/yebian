"use client";

import { useEffect, useState } from "react";

type Heading = { id: string; text: string; depth: 2 | 3 };

/**
 * 目录与滚动高亮。
 *
 * 用 getBoundingClientRect 取绝对位置而不是 offsetTop ——
 * 标题外面套了好几层容器，offsetTop 会相对最近的定位祖先，算出来是错的。
 */
export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? "");

  useEffect(() => {
    if (headings.length === 0) return;

    let ticking = false;

    const update = () => {
      ticking = false;
      const line = window.scrollY + 140; // 比顶部导航稍微靠下一点
      let current = headings[0].id;
      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= line) current = heading.id;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside className="toc" aria-label="文章目录">
      <div className="toc__label">On this page</div>
      <ol>
        {headings.map((heading) => (
          <li key={heading.id} className={heading.depth === 3 ? "is-sub" : undefined}>
            <a
              href={`#${heading.id}`}
              className={heading.id === activeId ? "is-active" : undefined}
              aria-current={heading.id === activeId ? "true" : undefined}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}
