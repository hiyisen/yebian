import type { MetadataRoute } from "next";

import { getAllPosts, getAllTags } from "@/lib/posts";
import { site } from "@/lib/site";

/**
 * sitemap 全部由构建期数据生成，标记为静态。
 * 不写这一行时 `next build` 正常，但切到 `output: "export"`（纯静态导出）会报错。
 */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const tags = getAllTags();
  const latest = posts[0]?.date;

  return [
    {
      url: site.url,
      lastModified: latest ? new Date(latest) : new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${site.url}/tags`,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${site.url}/about`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...tags.map(({ tag }) => ({
      url: `${site.url}/tags/${encodeURIComponent(tag)}`,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
    ...posts.map((post) => ({
      url: `${site.url}/posts/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
