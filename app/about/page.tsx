import type { Metadata } from "next";
import Link from "next/link";

import { getAllPosts, getAllTags } from "@/lib/posts";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "关于",
  description: `关于 ${site.title} 和写这些字的人。`,
};

export default function AboutPage() {
  const posts = getAllPosts();
  const tags = getAllTags();

  return (
    <>
      <header className="page-head wrap">
        <h1>关于这个站</h1>
      </header>

      <section className="wrap" style={{ paddingBottom: "var(--s9)" }}>
        <div className="prose-page reveal">
          <p>
            我是{site.author.name}。这里存放我在工程与设计上的笔记——
            踩过的坑、想通的原理、以及那些值得反复回看的片段。
          </p>
          <p>
            目前有 {posts.length} 篇文章、{tags.length} 个标签，自 {site.since} 年起陆续写下来。
            没有评论、没有账号、没有推荐算法，只有文章本身。
          </p>

          <h2>为什么叫「页边」</h2>
          <p>
            页边（margin）是正文之外的那一圈空白。它不承载内容，却决定了正文读起来舒不舒服。
            大部分真正有用的想法，最初也都是写在页边的批注——不成体系，但足够具体。
          </p>

          <h2>这个站是怎么做的</h2>
          <p>
            用 Next.js 构建，文章以 Markdown 撰写。所有页面在构建期预渲染成静态文件，
            代码高亮也在构建期完成，浏览器不需要为语法高亮下载任何东西。
          </p>
          <p>
            站内搜索走的是构建期生成的索引加本地匹配，所以你看不到任何加载圈——
            索引在打开搜索框的那一刻就开始用了。
          </p>

          <h2>联系</h2>
          <p>
            想聊点什么，可以走 {site.social.map((item, index) => (
              <span key={item.href}>
                {index > 0 ? " 或 " : ""}
                <a href={item.href} target="_blank" rel="me noopener noreferrer">
                  {item.label}
                </a>
              </span>
            ))}。
          </p>
        </div>

        <div className="tagcloud reveal" style={{ marginTop: "var(--s8)" }}>
          <Link href="/">← 回文章列表</Link>
          <a href="/rss.xml">RSS 订阅</a>
        </div>
      </section>
    </>
  );
}
