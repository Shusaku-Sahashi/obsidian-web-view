import fs from 'node:fs';
import path from 'node:path';
import { VAULT_DIR } from './notes-index';
import { loadSiteConfig } from './site-config';

const ATTACHMENT_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.mp4', '.mov', '.webm',
]);

function walkAttachments(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkAttachments(full));
    } else if (ATTACHMENT_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

/** サイズ・更新日時が一致する場合はコピーをスキップする（rsync同様のクイックチェック） */
function copyIfChanged(src: string, dest: string): void {
  const srcStat = fs.statSync(src);
  if (fs.existsSync(dest)) {
    const destStat = fs.statSync(dest);
    if (destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) return;
  }
  fs.copyFileSync(src, dest);
  fs.utimesSync(dest, srcStat.atime, srcStat.mtime); // 次回以降の差分判定のためコピー元の更新日時を保持する
}

/**
 * site.config.yamlの`attachmentsDir`で指定された添付ファイル置き場から、
 * 画像・動画を`publicDir`へ差分コピーする（変更のないファイルは再コピーしない）。
 * 戻り値はbasename -> 公開URL のマップ（Obsidianの埋め込みはファイル名のみで参照するため）。
 */
export function syncAttachmentsToPublic(publicDir: string): Map<string, string> {
  const { attachmentsDir } = loadSiteConfig();
  const urlMap = new Map<string, string>();
  if (!attachmentsDir) return urlMap;

  const sourceDir = path.join(VAULT_DIR, attachmentsDir);
  const files = walkAttachments(sourceDir);

  fs.mkdirSync(publicDir, { recursive: true });
  const wanted = new Set(files.map((f) => path.basename(f)));
  for (const existing of fs.readdirSync(publicDir)) {
    if (!wanted.has(existing)) fs.rmSync(path.join(publicDir, existing));
  }

  for (const file of files) {
    const basename = path.basename(file);
    copyIfChanged(file, path.join(publicDir, basename));
    urlMap.set(basename, `/obsidian-assets/${encodeURIComponent(basename)}`);
  }

  return urlMap;
}
