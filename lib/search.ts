/**
 * 搜索的核心算法 —— 纯函数，服务端构建索引用它，浏览器端查询也用它。
 *
 * 为什么不用 Fuse.js：它的默认分词基于空格，而中文词之间没有空格，
 * 整句会被当成一个 token，召回率会很难看。
 * 中文场景下「子串匹配 + 分字段加权」更直接也更好控，
 * 代价是牺牲模糊匹配 —— 但对个人博客来说，搜不准比搜不到更少见。
 */

export type SearchDoc = {
  slug: string;
  title: string;
  summary: string;
  displayDate: string;
  tags: string[];
  headings: { id: string; text: string }[];
  body: string;
};

export type Segment = { text: string; hit: boolean };

export type MatchField = "标题" | "标签" | "小标题" | "摘要" | "正文";

export type SearchHit = {
  doc: SearchDoc;
  score: number;
  title: Segment[];
  snippet: Segment[];
  matchedIn: MatchField[];
};

/** 查询分词：空格切分；中文没有空格，整串就是一个词 */
export function tokenizeQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/[\s\u3000]+/)
    .filter(Boolean);
}

function findRanges(text: string, terms: string[]): [number, number][] {
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const term of terms) {
    let from = 0;
    while (from <= lower.length - term.length) {
      const at = lower.indexOf(term, from);
      if (at < 0) break;
      ranges.push([at, at + term.length]);
      from = at + term.length;
    }
  }
  return ranges;
}

/** 合并重叠区间后切成命中/未命中片段，交给 React 渲染 <mark> */
export function highlight(text: string, terms: string[]): Segment[] {
  const ranges = findRanges(text, terms);
  if (ranges.length === 0) return [{ text, hit: false }];

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i][0] <= last[1]) {
      last[1] = Math.max(last[1], ranges[i][1]);
    } else {
      merged.push(ranges[i]);
    }
  }

  const segments: Segment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), hit: false });
    segments.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false });
  return segments;
}

/** 截取第一个命中位置附近的上下文作为摘要 */
export function makeSnippet(body: string, terms: string[], radius = 44): string {
  const lower = body.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const i = lower.indexOf(term);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) {
    return body.length > radius * 2 ? body.slice(0, radius * 2) + "…" : body;
  }
  const start = Math.max(0, at - radius);
  const end = Math.min(body.length, at + radius);
  return (start > 0 ? "…" : "") + body.slice(start, end) + (end < body.length ? "…" : "");
}

type FieldHit = { score: number; field: MatchField };

function scoreField(
  value: string,
  term: string,
  weight: number,
  field: MatchField,
): FieldHit | null {
  const lower = value.toLowerCase();
  const at = lower.indexOf(term);
  if (at < 0) return null;
  // 命中越靠前越相关；位置惩罚封顶，避免长文本被过度惩罚
  const positionPenalty = Math.min(at, 60) * weight * 0.01;
  return { score: weight - positionPenalty, field };
}

export function searchDocs(
  docs: SearchDoc[],
  query: string,
  limit = 8,
): SearchHit[] {
  const terms = tokenizeQuery(query);
  if (terms.length === 0) return [];

  const hits: SearchHit[] = [];

  for (const doc of docs) {
    let score = 0;
    const matched = new Set<MatchField>();
    let everyTermMatched = true;

    for (const term of terms) {
      const candidates: FieldHit[] = [];
      const push = (hit: FieldHit | null) => {
        if (hit) candidates.push(hit);
      };

      push(scoreField(doc.title, term, 120, "标题"));
      if (doc.title.toLowerCase() === term) score += 90;
      for (const tag of doc.tags) push(scoreField(tag, term, 80, "标签"));
      for (const h of doc.headings) push(scoreField(h.text, term, 50, "小标题"));
      push(scoreField(doc.summary, term, 34, "摘要"));
      push(scoreField(doc.body, term, 16, "正文"));

      if (candidates.length === 0) {
        everyTermMatched = false;
        break;
      }
      candidates.sort((a, b) => b.score - a.score);
      score += candidates[0].score;
      matched.add(candidates[0].field);
    }

    if (!everyTermMatched) continue;

    hits.push({
      doc,
      score,
      title: highlight(doc.title, terms),
      snippet: highlight(makeSnippet(doc.body, terms), terms),
      matchedIn: [...matched],
    });
  }

  hits.sort((a, b) => b.score - a.score || (a.doc.displayDate < b.doc.displayDate ? 1 : -1));
  return hits.slice(0, limit);
}
