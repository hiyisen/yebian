import { isValidElement, type ReactNode } from "react";

import { CopyButton } from "./CopyButton";

/** 把 React 子树里的文字全抽出来 —— 用来给复制按钮准备纯文本 */
function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

type CodeBlockProps = {
  children?: ReactNode;
};

/**
 * 代码块外壳。
 *
 * 通过 MDX 的 components 映射接管 markdown 里的 `<pre>`：
 * 高亮本身由构建期的 Shiki 完成（见 lib/code-theme.ts），
 * 这里只负责加顶栏、语言标签和复制按钮，不引入任何运行时高亮开销。
 */
export function CodeBlock({ children }: CodeBlockProps) {
  const codeElement = isValidElement(children) ? children : null;
  const className = codeElement
    ? String((codeElement.props as { className?: string }).className ?? "")
    : "";
  // addLanguageClass 让 Shiki 在 code 上留下 language-xxx
  const language = /language-([\w+#-]+)/.exec(className)?.[1] ?? "text";
  const raw = extractText(children).replace(/\n+$/, "");

  return (
    <div className="code">
      <div className="code__bar">
        <span className="code__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="code__lang">{language}</span>
        <CopyButton text={raw} />
      </div>
      <pre className="code__pre">{children}</pre>
    </div>
  );
}
