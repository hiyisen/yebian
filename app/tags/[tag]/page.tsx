import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostTimeline } from "@/components/PostTimeline";
import { getAllTags, getPostsByTag } from "@/lib/posts";

type PageProps = { params: Promise<{ tag: string }> };

export function generateStaticParams() {
  return getAllTags().map(({ tag }) => ({ tag }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const posts = getPostsByTag(decoded);
  return {
    title: `标签：${decoded}`,
    description: `关于「${decoded}」的 ${posts.length} 篇文章。`,
  };
}

export default async function TagPage({ params }: PageProps) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const posts = getPostsByTag(decoded);
  if (posts.length === 0) notFound();

  return (
    <>
      <header className="page-head wrap">
        <div className="crumbs reveal">
          <Link href="/tags">← 全部标签</Link>
        </div>
        <h1 className="reveal" data-d="1">{decoded}</h1>
        <p className="reveal" data-d="2">这个标签下有 {posts.length} 篇文章。</p>
      </header>

      <section className="wrap" style={{ paddingBottom: "var(--s9)" }}>
        <PostTimeline posts={posts} />
      </section>
    </>
  );
}
