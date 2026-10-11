/**
 * 站点级配置 —— 改这里就能换站名、导航、作者信息。
 * 全站文案与元数据都从这里取，避免散落在各个组件里。
 */
export const site = {
  name: "页边",
  latin: "MARGIN",
  title: "页边 MARGIN",
  description:
    "这里存放我在工程与设计上的笔记——踩过的坑、想通的原理、以及那些值得反复回看的片段。",
  /** 正式域名，RSS、sitemap 与分享卡片都会用它拼绝对地址 */
  url: "https://yebian.vercel.app",
  since: "2024",
  author: {
    name: "页边",
    bio: "写代码，也写思考。这里记录的都是我自己真的踩过一遍的东西。",
  },
  nav: [
    { href: "/", label: "文章" },
    { href: "/tags", label: "标签" },
    { href: "/about", label: "关于" },
  ],
  social: [
    { href: "https://github.com/hiyisen", label: "GitHub" },
    { href: "mailto:1363022366@qq.com", label: "邮件" },
  ],
} as const;

/** 支持页脚等处按需追加的订阅入口 */
export const rssPath = "/rss.xml";
