import { getAllPosts, plainTitle } from "@/lib/posts";
import type { SearchDoc } from "@/lib/search";

/** 构建期生成一次，之后作为静态文件提供 —— 搜索不需要任何服务端运行时 */
export const dynamic = "force-static";

/** 单篇正文进入索引的长度上限，避免索引文件无限膨胀 */
const BODY_LIMIT = 8000;

export function GET() {
  const docs: SearchDoc[] = getAllPosts().map((post) => ({
    slug: post.slug,
    title: plainTitle(post.title),
    summary: post.summary,
    displayDate: post.displayDate,
    tags: post.tags,
    headings: post.headings.map((h) => ({ id: h.id, text: h.text })),
    body: post.body.slice(0, BODY_LIMIT),
  }));

  return Response.json(docs, {
    headers: { "cache-control": "public, max-age=0, must-revalidate" },
  });
}
