import type { Metadata } from "next";
import { JetBrains_Mono, Newsreader, Public_Sans } from "next/font/google";

import "./globals.css";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { SearchDialog } from "@/components/SearchDialog";
import { RevealObserver } from "@/components/RevealObserver";
import { site } from "@/lib/site";

/* 展示字用衬线（Newsreader），正文用 Public Sans —— 刻意配对的两种气质。
   next/font 会把字体在构建期下载并自托管，运行时不依赖 Google。 */
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-public-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.title} — 工程与设计笔记`,
    template: `%s · ${site.title}`,
  },
  description: site.description,
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: site.title,
    title: site.title,
    description: site.description,
    url: site.url,
  },
  alternates: {
    types: { "application/rss+xml": "/rss.xml" },
  },
};

/**
 * 主题必须在首帧之前定下来，否则会先闪一下浅色再切成深色。
 * 这段脚本刻意内联在 head 里同步执行 —— 放在组件里就晚了。
 */
const themeScript = `(function(){try{
document.documentElement.classList.add('js');
var t=localStorage.getItem('theme');
if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
document.documentElement.setAttribute('data-theme',t);
}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      className={`${newsreader.variable} ${publicSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <SiteNav />
        <main>{children}</main>
        <SiteFooter />
        <SearchDialog />
        <RevealObserver />
      </body>
    </html>
  );
}
