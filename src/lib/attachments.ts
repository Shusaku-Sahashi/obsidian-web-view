import fs from 'node:fs';
import path from 'node:path';
import { CONTENTS_DIR } from './notes-index';

const ATTACHMENT_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.mp4', '.mov', '.webm',
]);

export function scanAttachments(dir: string = CONTENTS_DIR): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(dir)) return map;
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (ATTACHMENT_EXT.has(path.extname(entry.name).toLowerCase())) map.set(entry.name, full);
    }
  };
  walk(dir);
  return map;
}

/** 添付ファイルを public/ へコピーし、basename -> 公開URL のマップを返す */
export function syncAttachmentsToPublic(publicDir: string): Map<string, string> {
  const found = scanAttachments();
  const urlMap = new Map<string, string>();
  if (found.size === 0) return urlMap;
  fs.mkdirSync(publicDir, { recursive: true });
  for (const [name, srcPath] of found) {
    fs.copyFileSync(srcPath, path.join(publicDir, name));
    urlMap.set(name, `/obsidian-assets/${encodeURIComponent(name)}`);
  }
  return urlMap;
}
