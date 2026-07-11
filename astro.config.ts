import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import rehypeCallouts from 'rehype-callouts';
import { fileURLToPath } from 'node:url';
import { remarkObsidian } from './src/lib/remark-obsidian';
import { buildWikiLinkResolutionMap } from './src/lib/notes-index';
import { syncAttachmentsToPublic } from './src/lib/attachments';

const publicAssetsDir = fileURLToPath(new URL('./public/obsidian-assets/', import.meta.url));
const attachmentUrls = syncAttachmentsToPublic(publicAssetsDir);
const noteLinks = buildWikiLinkResolutionMap();

export default defineConfig({
  markdown: {
    processor: unified({
      remarkPlugins: [[remarkObsidian, { noteLinks, attachmentUrls }]],
      rehypePlugins: [[rehypeCallouts, { theme: 'obsidian' }]],
    }),
  },
});
