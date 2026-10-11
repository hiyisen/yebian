import Link from "next/link";
import { Fragment } from "react";

import { groupByYear, type Post } from "@/lib/posts";
import { PostTitle } from "./PostTitle";

/** 单条文章行 */
export function PostRow({ post }: { post: Post }) {
  return (
    <Link className="post reveal" href={`/posts/${post.slug}`}>
      <span className="post__date">{post.shortDate}</span>
      <span>
        <span className="post__title">
          <PostTitle title={post.title} />
        </span>
        {post.summary ? <span className="post__excerpt">{post.summary}</span> : null}
        {post.tags.length > 0 ? (
          <span className="post__tags">
            {post.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      <span className="post__go">
        {post.readingMinutes} min
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}

/** 年份轴 —— 全站的视觉记忆点 */
export function PostTimeline({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return <p className="empty">这里还什么都没有。</p>;
  }

  const groups = groupByYear(posts);

  return (
    <div className="timeline">
      {groups.map((group) => (
        <Fragment key={group.year}>
          <span className="year">{group.year}</span>
          {group.posts.map((post) => (
            <PostRow key={post.slug} post={post} />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
