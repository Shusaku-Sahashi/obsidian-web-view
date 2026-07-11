import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadSiteConfig } from './site-config.ts';

// import.meta.url基準だとAstroビルドのバンドル後にパス解決が壊れるため、
// 常にプロジェクトルート（astroの実行cwd）基準で解決する
export const VAULT_DIR = path.resolve(process.cwd(), 'contents');

const { targetFolder } = loadSiteConfig();
export const TARGET_DIR = targetFolder ? path.join(VAULT_DIR, targetFolder) : VAULT_DIR;

// Obsidianのファイル名規約「絵文字 YYYY-MM-DD タイトル.md」を分解する
const FILENAME_RE = /^(\p{Extended_Pictographic}️?)\s*(\d{4}-\d{2}-\d{2})\s+(.+)\.md$/u;
// 日付の無い「絵文字 タイトル.md」も実vaultには存在するため、タイトル表示用のフォールバック
const EMOJI_PREFIX_RE = /^(\p{Extended_Pictographic}️?)\s*(.+)\.md$/u;

export interface NoteMeta {
  filename: string;
  /** vaultルート（contents/）からの相対パス。obsidian://リンクの生成に使う */
  relativePath: string;
  /** 拡張子を除いたファイル名。Obsidianが挿入するwikilinkはこの形式を使う */
  stem: string;
  /** 絵文字と日付プレフィックスを除いたタイトル（UI表示用） */
  displayTitle: string;
  fileDate: string | null;
  /** URLセーフなID。日付 + 相対パスsha1先頭8桁 */
  slug: string;
}

export function normalizeKey(s: string): string {
  return s.normalize('NFKC').trim().toLowerCase();
}

function walkMarkdownFiles(dir: string, root: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // .obsidian等の隠しフォルダ/ファイルは除外
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMarkdownFiles(full, root));
    } else if (entry.name.endsWith('.md')) {
      out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
  return out;
}

export function slugForPath(relativePath: string): string {
  const m = path.basename(relativePath).match(FILENAME_RE);
  const hash = crypto.createHash('sha1').update(relativePath).digest('hex').slice(0, 8);
  return m ? `${m[2]}-${hash}` : hash;
}

export function parseNote(relativePath: string): NoteMeta {
  const filename = path.basename(relativePath);
  const stem = filename.replace(/\.md$/, '');
  const m = filename.match(FILENAME_RE);
  const emojiOnly = m ? null : filename.match(EMOJI_PREFIX_RE);
  return {
    filename,
    relativePath,
    stem,
    displayTitle: m?.[3] ?? emojiOnly?.[2] ?? stem,
    fileDate: m?.[2] ?? null,
    slug: slugForPath(relativePath),
  };
}

let cache: NoteMeta[] | null = null;

export function loadNotesIndex(): NoteMeta[] {
  if (cache) return cache;
  cache = walkMarkdownFiles(TARGET_DIR, VAULT_DIR).map(parseNote);
  return cache;
}

export interface WikiLinkTarget {
  slug: string;
  displayTitle: string;
}

/** wikilink解決用: 正規化した(stem | displayTitle) -> リンク先情報 のマップ */
export function buildWikiLinkResolutionMap(): Map<string, WikiLinkTarget> {
  const map = new Map<string, WikiLinkTarget>();
  for (const note of loadNotesIndex()) {
    const target = { slug: note.slug, displayTitle: note.displayTitle };
    map.set(normalizeKey(note.stem), target);
    map.set(normalizeKey(note.displayTitle), target);
  }
  return map;
}

export function getNoteBySlug(slug: string): NoteMeta | undefined {
  return loadNotesIndex().find((n) => n.slug === slug);
}

/** Obsidianでそのノートを直接開くURI（obsidian://open?vault=...&file=...） */
export function obsidianFileUri(note: NoteMeta): string {
  const { vaultName } = loadSiteConfig();
  const withoutExt = note.relativePath.replace(/\.md$/, '');
  const encodedPath = withoutExt
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodedPath}`;
}
