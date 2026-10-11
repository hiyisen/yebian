import { Fragment, type ReactNode } from "react";

/**
 * 标题里的强调与硬断行。
 *
 * 1. 强调：frontmatter 里写 `删掉了 *60%* 的代码`，
 *    星号包住的部分会渲染成衬线斜体强调色 —— 让作者能自己指定视觉重音，
 *    而不是由模板硬编码某个词。
 * 2. 断行：frontmatter 标题里写换行（YAML 块标量 `|`）会渲染成 `<br>`，
 *    用于控制中文标题的断行点，避免像「然后」这样的词组被拆到两行。
 *    浏览器的自然断行对中文没有词组意识，只有作者知道该在哪里停。
 *    不写换行的标题完全不受影响，仍是自动排版。
 *    `multiline` 只在标题独占一整个区块的语境（文章页、首页特写）开启；
 *    时间线等行内列表语境保持单行，换行会折叠成空格。
 */
export function PostTitle({
  title,
  multiline = false,
}: {
  title: string;
  multiline?: boolean;
}) {
  const source = multiline ? title : title.replace(/\s*\n\s*/g, " ");
  const lines = source.split("\n").filter((line) => line.trim() !== "");

  return (
    <>
      {lines.map((line, lineIndex) => {
        const parts = line.split(/(\*[^*]+\*)/g).filter((part) => part !== "");
        return (
          <Fragment key={lineIndex}>
            {lineIndex > 0 && <br />}
            {parts.map((part, index): ReactNode => {
              const isEmphasis =
                part.length > 2 && part.startsWith("*") && part.endsWith("*");
              return (
                <Fragment key={index}>
                  {isEmphasis ? <em>{part.slice(1, -1)}</em> : part}
                </Fragment>
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
}
