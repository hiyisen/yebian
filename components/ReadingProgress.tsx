"use client";

import { useEffect } from "react";

/**
 * 阅读进度条。
 * 进度按正文区块计算而不是整页 —— 顶部导航和页脚不该算进「读了多少」。
 */
export function ReadingProgress() {
  useEffect(() => {
    const bar = document.getElementById("reading-progress");
    const prose = document.querySelector<HTMLElement>(".prose");
    if (!bar || !prose) return;

    let ticking = false;

    const update = () => {
      ticking = false;
      const rect = prose.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY;
      const start = absoluteTop;
      // 终点：正文底部滚到视口底部的位置
      const end = absoluteTop + prose.offsetHeight - window.innerHeight;
      const span = end - start;
      const ratio = span <= 0 ? 1 : (window.scrollY - start) / span;
      const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
      bar.style.width = `${percent}%`;
      bar.setAttribute("aria-valuenow", String(percent));
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
  }, []);

  return (
    <div
      className="progress"
      id="reading-progress"
      role="progressbar"
      aria-label="阅读进度"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
    />
  );
}
