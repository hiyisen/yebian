import Link from "next/link";

import { PostTimeline } from "@/components/PostTimeline";
import { PostTitle } from "@/components/PostTitle";
import { Subscribe } from "@/components/Subscribe";
import { getAllPosts, getAllTags, getFeaturedPost } from "@/lib/posts";
import { site } from "@/lib/site";

export default function HomePage() {
  const posts = getAllPosts();
  const tags = getAllTags();
  const featured = getFeaturedPost();
  // 置顶文章已在上面单独展示，列表里不再重复
  const rest = posts.filter((post) => post.slug !== featured?.slug);

  return (
    <>
      <section className="hero wrap">
        <div className="hero__grid">
          <div>
            <span className="kicker reveal" data-d="1">
              Notes on code &amp; craft
            </span>
            <h1 className="reveal" data-d="2">
              写下来，<em>才</em>想明白。
            </h1>
            <p className="hero__lede reveal" data-d="3">{site.description}</p>
            <div className="hero__meta reveal" data-d="4">
              <span>{posts.length} 篇文章</span>
              <i />
              <span>{tags.length} 个标签</span>
              <i />
              <span>自 {site.since} 年</span>
            </div>
          </div>
          <div className="hero__aside reveal" data-d="4">
            <p>
              The margin is where
              <br />
              the real thinking
              <br />
              happens. <b>— 页边的意思</b>
            </p>
          </div>
        </div>
      </section>

      {featured ? (
        <section className="wrap" style={{ paddingTop: "var(--s6)" }}>
          <Link className="featured reveal" href={`/posts/${featured.slug}`}>
            <div className="featured__grid">
              <div className="featured__body">
                <span className="pill">置顶</span>
                <h2 className="featured__title">
                  <PostTitle title={featured.title} multiline />
                </h2>
                {featured.summary ? (
                  <p className="featured__excerpt">{featured.summary}</p>
                ) : null}
                <div className="featured__foot">
                  <span>
                    {featured.displayDate} · {featured.readingMinutes} min read
                  </span>
                  <span className="read-cue">
                    阅读全文
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </div>
              </div>
              <div className="featured__art" aria-hidden="true">
                <svg viewBox="0 0 600 460" preserveAspectRatio="xMidYMid slice">
                  <rect width="600" height="460" fill="var(--art-bg)" />
                  <g fill="none" stroke="var(--art-line)" strokeWidth="1">
                    <circle cx="300" cy="230" r="58" />
                    <circle cx="300" cy="230" r="108" />
                    <circle cx="300" cy="230" r="158" />
                    <circle cx="300" cy="230" r="208" />
                    <line x1="0" y1="230" x2="600" y2="230" />
                    <line x1="300" y1="0" x2="300" y2="460" />
                  </g>
                  <path d="M300 230 L300 72 A158 158 0 0 1 458 230 Z" fill="var(--accent)" opacity="0.88" />
                  <path
                    d="M300 230 L300 338 A108 108 0 0 0 408 230 Z"
                    fill="none"
                    stroke="var(--art-line)"
                    strokeWidth="1"
                  />
                  <circle cx="300" cy="230" r="4.5" fill="var(--text)" />
                </svg>
              </div>
            </div>
          </Link>
        </section>
      ) : null}

      <section className="section wrap">
        <div className="section__head reveal">
          <h2 className="section__title">
            全部文章
            <small>archive · {posts.length} entries</small>
          </h2>
          <Link className="btn-ghost" href="/tags">
            按标签浏览
          </Link>
        </div>
        <PostTimeline posts={rest} />
      </section>

      {tags.length > 0 ? (
        <section className="section wrap">
          <div className="section__head reveal">
            <h2 className="section__title">
              标签
              <small>topics</small>
            </h2>
            <Link className="btn-ghost" href="/tags">
              全部标签
            </Link>
          </div>
          <div className="tagcloud reveal">
            {tags.slice(0, 12).map(({ tag, count }) => (
              <Link key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                {tag} <span>{count}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <Subscribe />
    </>
  );
}
