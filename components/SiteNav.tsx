"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { site } from "@/lib/site";
import { ThemeToggle } from "./ThemeToggle";

/** 搜索按钮：只负责把「打开搜索」广播出去，面板自己监听 */
function SearchTrigger() {
  return (
    <button
      className="search-btn"
      type="button"
      aria-label="搜索文章"
      onClick={() => window.dispatchEvent(new CustomEvent("margin:search"))}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.6-3.6" />
      </svg>
      <span>搜索</span>
      <kbd>⌘K</kbd>
    </button>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/posts") : pathname.startsWith(href);

  return (
    <header className={stuck ? "nav is-stuck" : "nav"}>
      <div className="wrap nav__inner">
        <Link className="brand" href="/" aria-label="返回首页">
          <span className="brand__mark" aria-hidden="true">
            <span />
          </span>
          <span>
            <span className="brand__name">{site.name}</span>
            <span className="brand__latin">{site.latin}</span>
          </span>
        </Link>

        <nav className="nav__links" aria-label="主导航">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              className="nav__link"
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="nav__tools">
          <SearchTrigger />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
