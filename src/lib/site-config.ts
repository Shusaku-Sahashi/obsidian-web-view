import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export interface SiteConfig {
  /** obsidian://リンクに使うVault名（Obsidianの表示名と一致させる） */
  vaultName: string;
  /** vaultルート（contents/）からの相対パス。空文字ならvaultルート直下を対象にする */
  targetFolder: string;
  /** 添付ファイル（画像・動画）置き場のvaultルートからの相対パス。空文字なら添付ファイル同期を行わない */
  attachmentsDir: string;
}

const CONFIG_PATH = path.resolve(process.cwd(), 'site.config.yaml');

let cached: SiteConfig | null = null;

export function loadSiteConfig(configPath: string = CONFIG_PATH): SiteConfig {
  if (cached) return cached;
  const raw = fs.readFileSync(configPath, 'utf-8');
  const data = (parse(raw) ?? {}) as Partial<SiteConfig>;
  if (!data.vaultName) {
    throw new Error(`${configPath}: "vaultName" を設定してください`);
  }
  cached = {
    vaultName: data.vaultName,
    targetFolder: data.targetFolder ?? '',
    attachmentsDir: data.attachmentsDir ?? '',
  };
  return cached;
}
