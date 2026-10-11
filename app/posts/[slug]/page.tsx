import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MdxContent } from "@/components/MdxContent";
import { PostTitle } from "@/components/PostTitle";
import { ReadingProgress } from "@/components/ReadingProgress";
import { TableOfContents } from "@/components/TableOfContents";
import { getAdjacentPosts, getAllPosts, getPostBySlug, plainTitle } from "@/lib/posts";
import { site } from "@/lib/site";

type PageProps = { params: Promise<{ slug: string }> };

/**
 * 路由参数是百分号编码的字符串。
 * 英文 slug 看不出来，但 Obsidian 同步过来的中文标题会生成中文 slug，
 * 不解码就永远匹配不到文章（表现为 404）—— 标签页一直是这么处理的。
 */
function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

/** 构建期把所有文章预渲染成静态页 */
export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(decodeSlug(slug));
  if (!post) return { title: "文章不存在" };

  return {
    title: plainTitle(post.title),
    description: post.summary,
    openGraph: {
      type: "article",
      title: plainTitle(post.title),
      description: post.summary,
      publishedTime: post.date,
      tags: post.tags,
      url: `${site.url}/posts/${post.slug}`,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { prev, next } = getAdjacentPosts(slug);
  const [year, month, day] = post.date.split("-");
  const fullDate = `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;

  return (
    <>
      <ReadingProgress />

      <article className="article wrap">
        <header className="article__head">
          <div className="crumbs reveal" data-d="1">
            <Link className="back-link" href="/" style={{ padding: 0, height: "auto" }}>
              ← 全部文章
            </Link>
            {post.tags[0] ? (
              <>
                <i />
                <Link href={`/tags/${encodeURIComponent(post.tags[0])}`}>{post.tags[0]}</Link>
              </>
            ) : null}
            <i />
            <span>{post.displayDate}</span>
          </div>

          <h1 className="article__title reveal" data-d="2">
            <PostTitle title={post.title} multiline />
          </h1>

          {post.summary ? (
            <p className="article__lede reveal" data-d="2">{post.summary}</p>
          ) : null}

          <div className="article__meta reveal" data-d="3">
            <span>{fullDate}</span>
            <span>
              <b>{post.readingMinutes} min</b> 阅读
            </span>
            <span>
              <b>{post.body.replace(/\s/g, "").length.toLocaleString("zh-CN")}</b> 字
            </span>
            {post.tags.length > 0 ? (
              <span className="tags">
                {post.tags.map((tag) => (
                  <Link className="tag" key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                    {tag}
                  </Link>
                ))}
              </span>
            ) : null}
          </div>
        </header>

        <div className="layout">
          <div className="prose reveal" data-d="3">
            <MdxContent source={post.content} />
          </div>
          <TableOfContents headings={post.headings} />
        </div>

        <footer className="article__foot">
          <div className="author reveal">
            <div className="author__avatar" aria-hidden="true">
              {site.name.slice(0, 1)}
            </div>
            <div>
              <h3>{site.title}</h3>
              <p>{site.author.bio}</p>
            </div>
          </div>

          {prev || next ? (
            <nav className="pager reveal" aria-label="文章导航">
              {prev ? (
                <Link href={`/posts/${prev.slug}`}>
                  <span>← 上一篇</span>
                  <h4>{plainTitle(prev.title)}</h4>
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link className="next" href={`/posts/${next.slug}`}>
                  <span>下一篇 →</span>
                  <h4>{plainTitle(next.title)}</h4>
                </Link>
              ) : null}
            </nav>
          ) : null}
        </footer>
      </article>

      {/* 供屏幕阅读器与搜索引擎使用的结构化数据 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: plainTitle(post.title),
            datePublished: post.date,
            description: post.summary,
            keywords: post.tags.join(", "),
            author: { "@type": "Person", name: site.author.name },
            url: `${site.url}/posts/${post.slug}`,
          }),
        }}
      />
    </>
  );
}
