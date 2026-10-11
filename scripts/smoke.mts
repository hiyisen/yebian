/**
 * 高亮管线冒烟测试 —— 验证 remark-gfm + rehype-slug + @shikijs/rehype
 * 能在本地产出自定义主题的 HTML，并且标题锚点 id 与预期一致。
 *
 * 跑法：node --experimental-strip-types scripts/smoke.mts
 */
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeShiki from '@shikijs/rehype'
import rehypeStringify from 'rehype-stringify'
import GithubSlugger from 'github-slugger'

import { marginCodeTheme } from '../lib/code-theme.ts'

const md = `
## 先搞清楚 RSC 到底解决什么

普通段落，含 \`inline code\` 和 **加粗**。

\`\`\`tsx
// app/posts/[slug]/page.tsx
export default async function PostPage({ params }) {
  const post = await getPost(params.slug)
  if (!post) notFound()
  return <PostBody html={post.html} />
}
\`\`\`

| 指标 | 重构前 | 重构后 |
| --- | --- | --- |
| 首屏 JS | 412 KB | 96 KB |

### 把数据获取下沉到组件内部

结束。
`

const file = await unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeShiki, {
    theme: marginCodeTheme,
    defaultLanguage: 'text',
    addLanguageClass: true,
  })
  .use(rehypeStringify)
  .process(md)

const html = String(file)

const headingIds = [...html.matchAll(/<h[23] id="([^"]+)"/g)].map(m => m[1])
const slugger = new GithubSlugger()
const expected = ['先搞清楚 RSC 到底解决什么', '把数据获取下沉到组件内部'].map(h => slugger.slug(h))

console.log('渲染出的标题 id ：', JSON.stringify(headingIds))
console.log('按同样规则预期 ：', JSON.stringify(expected))
console.log('锚点一致        ：', JSON.stringify(headingIds) === JSON.stringify(expected) ? 'YES' : 'NO')

const hasShiki = html.includes('class="shiki')
const hasCustomColor = html.includes('--shiki') || html.includes('#F08A52')
console.log('Shiki 已应用     ：', hasShiki ? 'YES' : 'NO')
console.log('自定义主题色生效 ：', hasCustomColor ? 'YES' : 'NO')
console.log('表格已渲染       ：', html.includes('<table>') ? 'YES' : 'NO')
console.log('行内代码已渲染   ：', html.includes('<code>') ? 'YES' : 'NO')

const pre = html.match(/<pre[\s\S]*?<\/pre>/)?.[0] ?? ''
console.log('\n--- pre 开标签 ---')
console.log(pre.slice(0, 200))
console.log('\n--- code 开标签（需要带 language-* class）---')
console.log(pre.match(/<code[^>]*>/)?.[0] ?? '未找到 code 标签')
