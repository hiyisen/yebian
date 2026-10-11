import type { ReactNode } from "react";

type CalloutProps = {
  type?: "note" | "warn";
  title?: string;
  children?: ReactNode;
};

/**
 * 提示块。在 MDX 里直接写：
 *   <Callout title="一个容易踩的坑">正文…</Callout>
 */
export function Callout({ type = "warn", title, children }: CalloutProps) {
  return (
    <div className={type === "note" ? "callout is-note" : "callout"}>
      <span className="callout__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          {type === "warn" ? (
            <path d="M12 8v5M12 16.5v.5" />
          ) : (
            <path d="M12 11v5M12 7.5v.5" />
          )}
        </svg>
      </span>
      <div>
        {title ? <h4>{title}</h4> : null}
        {children}
      </div>
    </div>
  );
}

type FigureProps = {
  caption?: string;
  children?: ReactNode;
};

/** 插图容器，统一边框、圆角与图注样式 */
export function Figure({ caption, children }: FigureProps) {
  return (
    <figure className="figure">
      <div className="figure__frame">{children}</div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
