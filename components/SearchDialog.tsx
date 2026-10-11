"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { searchDocs, type SearchDoc, type SearchHit } from "@/lib/search";

type Status = "idle" | "loading" | "ready" | "error";

/** 索引在模块级缓存，切页面回来不用重新下载 */
let indexCache: SearchDoc[] | null = null;

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<Status>(indexCache ? "ready" : "idle");

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  /* ---------- 打开索引：只在第一次真正需要时下载 ---------- */
  const ensureIndex = useCallback(async () => {
    if (indexCache) {
      setStatus("ready");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/search-index.json");
      if (!res.ok) throw new Error(String(res.status));
      indexCache = (await res.json()) as SearchDoc[];
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  const openDialog = useCallback(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
    void ensureIndex();
  }, [ensureIndex]);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    restoreFocusRef.current?.focus?.();
  }, []);

  /* ---------- 全局快捷键与外部触发 ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) {
            restoreFocusRef.current?.focus?.();
            return false;
          }
          restoreFocusRef.current = document.activeElement as HTMLElement | null;
          void ensureIndex();
          return true;
        });
      }
    };
    const onExternalOpen = () => openDialog();

    window.addEventListener("keydown", onKey);
    window.addEventListener("margin:search", onExternalOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("margin:search", onExternalOpen);
    };
  }, [ensureIndex, openDialog]);

  /* ---------- 打开时的副作用：聚焦、锁滚动 ---------- */
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // 等面板挂载后再聚焦，否则 ref 还是空的
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(id);
    };
  }, [open]);

  /* ---------- 查询 ---------- */
  useEffect(() => {
    if (!open || status !== "ready" || !indexCache) {
      setHits([]);
      return;
    }
    setHits(searchDocs(indexCache, query, 8));
    setActive(0);
  }, [query, open, status]);

  /* ---------- 让选中项始终留在可视区 ---------- */
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = useCallback(
    (slug: string) => {
      closeDialog();
      router.push(`/posts/${slug}`);
    },
    [closeDialog, router],
  );

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDialog();
      return;
    }
    if (hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[active];
      if (hit) go(hit.doc.slug);
    }
  }

  if (!open) return null;

  return (
    <div
      className="search-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeDialog();
      }}
    >
      <div
        className="search-panel"
        role="dialog"
        aria-modal="true"
        aria-label="搜索文章"
      >
        <div className="search-input-row">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
          </svg>
          <input
            ref={inputRef}
            className="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="搜索标题、正文或标签…"
            aria-label="搜索关键词"
            aria-controls="search-result-list"
            aria-describedby="search-status"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="search-esc">ESC</kbd>
        </div>

        <div id="search-status" className="sr-only" aria-live="polite">
          {status === "loading" && "正在载入搜索索引"}
          {status === "error" && "搜索索引载入失败"}
          {status === "ready" &&
            (query.trim()
              ? `找到 ${hits.length} 条结果`
              : `索引已就绪，共 ${indexCache?.length ?? 0} 篇文章`)}
        </div>

        {status === "error" ? (
          <div className="search-state">
            <strong>索引没能载入</strong>
            检查网络后重试，或者直接用 <kbd>⌘K</kbd> 再试一次
          </div>
        ) : status === "loading" ? (
          <div className="search-state">正在载入索引…</div>
        ) : !query.trim() ? (
          <div className="search-state">
            <strong>输入关键词开始搜索</strong>
            标题、小标题、标签、正文都会被检索
          </div>
        ) : hits.length === 0 ? (
          <div className="search-state">
            <strong>没有找到「{query.trim()}」</strong>
            换个说法试试，或者只输入其中一个词
          </div>
        ) : (
          <ul className="search-results" id="search-result-list" ref={listRef} role="listbox">
            {hits.map((hit, i) => (
              <li key={hit.doc.slug}>
                <button
                  type="button"
                  className="search-item"
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(hit.doc.slug)}
                >
                  <span className="search-item__top">
                    <span className="search-item__title">
                      {hit.title.map((seg, k) =>
                        seg.hit ? <mark key={k}>{seg.text}</mark> : <span key={k}>{seg.text}</span>,
                      )}
                    </span>
                    <span className="search-item__date">{hit.doc.displayDate}</span>
                  </span>
                  <span className="search-item__snippet">
                    {hit.snippet.map((seg, k) =>
                      seg.hit ? <mark key={k}>{seg.text}</mark> : <span key={k}>{seg.text}</span>,
                    )}
                  </span>
                  <span className="search-item__fields">
                    {hit.matchedIn.map((field) => (
                      <span key={field}>{field}</span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="search-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> 选择
          </span>
          <span>
            <kbd>↵</kbd> 打开
          </span>
          <span>
            <kbd>ESC</kbd> 关闭
          </span>
          {status === "ready" && query.trim() && hits.length > 0 && (
            <em>{hits.length} 条结果</em>
          )}
        </div>
      </div>
    </div>
  );
}
