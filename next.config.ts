import type { NextConfig } from "next";

/**
 * 纯静态内容站，不需要 Cache Components：
 * 关掉它可以让「构建期读 Markdown 文件」这类操作保持简单直接，
 * 不必为每个数据读取包一层 "use cache" 或 Suspense。
 */
const nextConfig: NextConfig = {
  cacheComponents: false,

  /*
   * 部署模式二选一。
   *
   * 默认（推荐）：不加 output，站点由 Node 托管（`npm start`），
   * 可直接交给 Vercel，也保留将来加评论、图片优化、接口的能力。
   *
   * 纯静态：取消下一行注释，`npm run build` 会额外产出 out/ 目录，
   * 里面是纯 HTML，可放到任意静态托管（对象存储 + CDN、Cloudflare Pages 等），
   * 不需要 Node 运行时。已实测：搜索、RSS、站内跳转在静态模式下均正常。
   */
  // output: "export",
};

export default nextConfig;
