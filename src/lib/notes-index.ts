import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// import.meta.url基準だとAstroビルドのバンドル後にパス解決が壊れるため、
// 常にプロジェクトルート（astroの実行cwd）基準で解決する
export const CONTENTS_DIR = path.resolve(process.cwd(), 'contents');

// Obsidianのファイル名規約「絵文字 YYYY-MM-DD タイトル.md」を分解する
const FILENAME_RE = /^(\p{Extended_Pictographic}️?)\s*(\d{4}-\d{2}-\d{2})\s+(.+)\.md$/u;

export interface NoteMeta {
  filename: string;
  /** 拡張子を除いたファイル名。Obsidianが挿入するwikilinkはこの形式を使う */
  stem: string;
  /** 絵文字と日付プレフィックスを除いたタイトル（UI表示用） */
  displayTitle: string;
  fileDate: string | null;
  /** URLセーフなID。日付 + ファイル名sha1先頭8桁 */
  slug: string;
}

export function normalizeKey(s: string): string {
  return s.normalize('NFKC').trim().toLowerCase();
}

export function slugForFilename(filename: string): string {
  const base = filename.endsWith('.md') ? filename : `${filename}.md`;
  const m = base.match(FILENAME_RE);
  const hash = crypto.createHash('sha1').update(base).digest('hex').slice(0, 8);
  return m ? `${m[2]}-${hash}` : hash;
}

export function parseFilename(filename: string): NoteMeta {
  const m = filename.match(FILENAME_RE);
  const stem = filename.replace(/\.md$/, '');
  return {
    filename,
    stem,
    displayTitle: m?.[3] ?? stem,
    fileDate: m?.[2] ?? null,
    slug: slugForFilename(filename),
  };
}

let cache: NoteMeta[] | null = null;

export function loadNotesIndex(dir: string = CONTENTS_DIR): NoteMeta[] {
  if (cache) return cache;
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
    : [];
  cache = files.map(parseFilename);
  return cache;
}

export interface WikiLinkTarget {
  slug: string;
  displayTitle: string;
}

/** wikilink解決用: 正規化した(stem | displayTitle) -> リンク先情報 のマップ */
export function buildWikiLinkResolutionMap(dir: string = CONTENTS_DIR): Map<string, WikiLinkTarget> {
  const map = new Map<string, WikiLinkTarget>();
  for (const note of loadNotesIndex(dir)) {
    const target = { slug: note.slug, displayTitle: note.displayTitle };
    map.set(normalizeKey(note.stem), target);
    map.set(normalizeKey(note.displayTitle), target);
  }
  return map;
}

export function getNoteBySlug(slug: string, dir: string = CONTENTS_DIR): NoteMeta | undefined {
  return loadNotesIndex(dir).find((n) => n.slug === slug);
}
