// Obsidianのstatusプロパティ（例: "✍️ In Progress", "✅ Done"）をURLセーフな
// スラッグに正規化する。未知の値でも自動でスラッグ化できるよう、固定マップは持たない。
export function statusSlug(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/\p{Extended_Pictographic}|️/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
