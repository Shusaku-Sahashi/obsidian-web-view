import { visit } from 'unist-util-visit';
import type { Root, Text, Parent, PhrasingContent } from 'mdast';
import { normalizeKey, type WikiLinkTarget } from './notes-index';

// [[Target]] / [[Target|Alias]] / ![[file.png]] / ![[file.png|caption|500]]
const PATTERN = /(!)?\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
const VIDEO_EXT = new Set(['.mov', '.mp4', '.webm']);

export interface RemarkObsidianOptions {
  /** normalizeKey(stem | displayTitle) -> リンク先情報 */
  noteLinks: Map<string, WikiLinkTarget>;
  /** 添付ファイルのbasename -> 公開URL */
  attachmentUrls: Map<string, string>;
}

export function remarkObsidian({ noteLinks, attachmentUrls }: RemarkObsidianOptions) {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined || !node.value.includes('[[')) return;
      const value = node.value;
      const out: PhrasingContent[] = [];
      let last = 0;
      for (const m of value.matchAll(PATTERN)) {
        const [full, bang, rawTarget, rawAfterPipe] = m;
        const start = m.index;
        if (start > last) out.push({ type: 'text', value: value.slice(last, start) });
        const target = rawTarget.trim();
        out.push(
          bang
            ? buildEmbed(target, rawAfterPipe, attachmentUrls)
            : buildLink(target, rawAfterPipe, noteLinks),
        );
        last = start + full.length;
      }
      if (out.length === 0) return;
      if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
      (parent as Parent).children.splice(index, 1, ...out);
      return index + out.length;
    });
  };
}

function buildLink(
  target: string,
  alias: string | undefined,
  notes: Map<string, WikiLinkTarget>,
): PhrasingContent {
  const resolved = notes.get(normalizeKey(target));
  if (resolved) {
    // エイリアス未指定なら、絵文字・日付を除いたノートタイトルを表示する
    const displayText = alias?.trim() || resolved.displayTitle;
    return {
      type: 'wikiLink',
      data: {
        hName: 'a',
        hProperties: { href: `/posts/${resolved.slug}/`, class: 'wikilink' },
        hChildren: [{ type: 'text', value: displayText }],
      },
    } as unknown as PhrasingContent;
  }
  return {
    type: 'wikiLink',
    data: {
      hName: 'span',
      hProperties: { class: 'wikilink wikilink-unresolved', title: '未解決のリンクです' },
      hChildren: [{ type: 'text', value: alias?.trim() || target }],
    },
  } as unknown as PhrasingContent;
}

function buildEmbed(
  target: string,
  afterPipe: string | undefined,
  attachments: Map<string, string>,
): PhrasingContent {
  const parts = (afterPipe ?? '').split('|').map((s) => s.trim()).filter(Boolean);
  const width = parts.find((p) => /^\d+$/.test(p));
  const caption = parts.find((p) => !/^\d+$/.test(p));
  const url = attachments.get(target);
  if (!url) {
    return {
      type: 'wikiEmbed',
      data: {
        hName: 'span',
        hProperties: { class: 'embed-missing' },
        hChildren: [{ type: 'text', value: `⚠ 添付ファイルが見つかりません: ${target}` }],
      },
    } as unknown as PhrasingContent;
  }
  const ext = target.slice(target.lastIndexOf('.')).toLowerCase();
  if (VIDEO_EXT.has(ext)) {
    return {
      type: 'wikiEmbed',
      data: {
        hName: 'video',
        hProperties: { src: url, controls: true, ...(width ? { width } : {}) },
        hChildren: [],
      },
    } as unknown as PhrasingContent;
  }
  return {
    type: 'wikiEmbed',
    data: {
      hName: 'img',
      hProperties: { src: url, alt: caption ?? target, ...(width ? { width } : {}) },
      hChildren: [],
    },
  } as unknown as PhrasingContent;
}
