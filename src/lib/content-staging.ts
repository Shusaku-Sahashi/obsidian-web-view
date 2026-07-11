import fs from 'node:fs';
import path from 'node:path';
import { VAULT_DIR, loadNotesIndex } from './notes-index';

export const STAGING_DIR = path.resolve(process.cwd(), '.obsidian-staging');

/**
 * AstroのContent Layer `glob()`ローダーは内部で `new URL(encodeURI(entry), base)` を使っており、
 * `encodeURI`は `#` をエスケープしないため、ファイル名に `#` が含まれるとURLフラグメントとして
 * 誤解釈されファイルが読めなくなる（Astro 7.0.7時点の既知の制約）。
 * 対策として、対象フォルダ配下の全ノートをURLセーフなslug名でステージングディレクトリへ
 * フラットにコピーし、glob loaderにはそちらを読ませる。
 */
export function syncContentStaging(dir: string = STAGING_DIR): string {
  fs.mkdirSync(dir, { recursive: true });

  const notes = loadNotesIndex();
  const wanted = new Set(notes.map((n) => `${n.slug}.md`));

  for (const existing of fs.readdirSync(dir)) {
    if (!wanted.has(existing)) fs.rmSync(path.join(dir, existing));
  }

  for (const note of notes) {
    fs.copyFileSync(path.join(VAULT_DIR, note.relativePath), path.join(dir, `${note.slug}.md`));
  }

  return dir;
}
