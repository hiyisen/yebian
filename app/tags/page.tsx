import type { Metadata } from "next";
import Link from "next/link";

import { getAllTags } from "@/lib/posts";

export const metadata: Metadata = {
  title: "标签",
  description: "按主题浏览全部文章。",
};

export default function TagsPage() {
  const tags = getAllTags();

  return (
    <>
      <header className="page-head wrap">
        <h1>标签</h1>
        <p>
          共 {tags.length} 个标签。每一个都点得进去 —— 不摆样子。
        </p>
      </header>

      <section className="wrap" style={{ paddingBottom: "var(--s9)" }}>
        {tags.length === 0 ? (
          <p className="empty">还没有任何标签。</p>
        ) : (
          <div className="tagcloud reveal">
            {tags.map(({ tag, count }) => (
              <Link key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                {tag} <span>{count}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
