/** Markdown/Obsidian記法を除去したプレーンテキストの抜粋を生成する */
export function excerptFromBody(body: string, maxLength = 140): string {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ') // コードブロック
    .replace(/`[^`]*`/g, ' ') // インラインコード
    .replace(/!\[\[[^\]]*\]\]/g, ' ') // Obsidian埋め込み ![[...]]
    .replace(/\[\[([^\]|]+)\|([^\]]*)\]\]/g, (_m, _target, alias) => alias) // [[target|alias]]
    .replace(/\[\[([^\]]+)\]\]/g, '$1') // [[target]]
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // Markdown画像
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Markdownリンク
    .replace(/^>\s*\[![^\]]+\][^\n]*$/gm, ' ') // コールアウト見出し行
    .replace(/^>\s?/gm, '') // 引用記号
    .replace(/^#{1,6}\s*/gm, '') // 見出し記号
    .replace(/[*_~]{1,3}/g, '') // 強調記号
    .replace(/^-{3,}\s*$/gm, ' ') // 水平線
    .replace(/^\s*[-*+]\s+/gm, '') // リスト記号
    .replace(/\r?\n+/g, ' ') // 改行を空白に
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}
