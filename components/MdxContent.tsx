import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import type { ComponentPropsWithoutRef } from "react";

import { marginCodeTheme } from "@/lib/code-theme";
import { Callout, Figure } from "./Callout";
import { CodeBlock } from "./CodeBlock";

const components = {
  // 接管 markdown 的 <pre>，换成带顶栏和复制按钮的代码卡片
  pre: CodeBlock,
  Callout,
  Figure,
  // 表格套一层可横向滚动的容器，窄屏才不会被撑破
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="table-wrap">
      <table {...props} />
    </div>
  ),
  // 外链自动补上 target 与 rel，站内链接保持原样
  a: ({ href = "", ...rest }: ComponentPropsWithoutRef<"a">) => {
    const isExternal = /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...rest}
      />
    );
  },
};

/**
 * MDX 渲染入口。
 *
 * 高亮在构建期由 Shiki 完成（自定义主题见 lib/code-theme.ts），
 * 客户端不会下载任何语法定义文件。
 */
export function MdxContent({ source }: { source: string }) {
  return (
    <MDXRemote
      source={source}
      components={components}
      options={{
        mdxOptions: {
          remarkPlugins: [remarkGfm],
          rehypePlugins: [
            rehypeSlug,
            [
              rehypeShiki,
              {
                theme: marginCodeTheme,
                defaultLanguage: "text",
                // 让 code 元素带上 language-xxx，代码块顶栏要用它显示语言
                addLanguageClass: true,
              },
            ],
          ],
        },
      }}
    />
  );
}
