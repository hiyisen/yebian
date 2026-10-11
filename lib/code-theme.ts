import type { ThemeRegistration } from 'shiki'

/**
 * 站点自有的代码高亮主题。
 *
 * 不从现成主题里借色 —— 通用深色主题（One Dark / GitHub Dark）的关键字是鲑鱼红、
 * 函数名是冷蓝，压在暖棕底上会和全站的赤陶暖调打架。
 * 这里的每个颜色都从站点色板派生，并保证在 #1A1815 上 ≥4.5:1。
 *
 * 只定义 5 个角色，其余一律用默认前景色 —— 克制的色板比花花绿绿更耐看。
 */
export const marginCodeTheme: ThemeRegistration = {
  name: 'margin',
  type: 'dark',
  colors: {
    'editor.background': '#1A1815',
    'editor.foreground': '#EDE9E2',
  },
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: '#8A8377', fontStyle: 'italic' },
    },
    {
      scope: [
        'keyword',
        'keyword.control',
        'keyword.operator.new',
        'keyword.operator.expression',
        'storage',
        'storage.type',
        'storage.modifier',
      ],
      settings: { foreground: '#F08A52' },
    },
    {
      scope: [
        'entity.name.function',
        'support.function',
        'meta.function-call',
        'variable.function',
        'entity.name.tag',
        'meta.tag',
      ],
      settings: { foreground: '#86C7A5' },
    },
    {
      scope: ['string', 'string.quoted', 'punctuation.definition.string'],
      settings: { foreground: '#C9B370' },
    },
    {
      scope: [
        'constant.numeric',
        'constant.language',
        'constant.character.escape',
        'support.constant',
      ],
      settings: { foreground: '#E0A458' },
    },
    {
      scope: ['punctuation', 'keyword.operator'],
      settings: { foreground: '#A79F94' },
    },
  ],
}

/** 代码块底色在明暗两套站点主题下保持一致，作为页面上一块稳定的深色「承印面」 */
export const CODE_BACKGROUND = '#1A1815'
