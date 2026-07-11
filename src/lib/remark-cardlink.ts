import { visit } from 'unist-util-visit';
import type { Root, Code, Parent } from 'mdast';
import { parse } from 'yaml';

interface CardLinkData {
  url?: string;
  title?: string;
  description?: string;
  host?: string;
  favicon?: string;
  image?: string;
}

/** Obsidian「Auto Card Link」プラグインが生成する```cardlinkブロックをリンクカードに変換する */
export function remarkCardlink() {
  return (tree: Root) => {
    visit(tree, 'code', (node: Code, index, parent) => {
      if (node.lang !== 'cardlink' || !parent || index === undefined) return;

      let data: CardLinkData;
      try {
        data = (parse(node.value) ?? {}) as CardLinkData;
      } catch {
        return; // パース失敗時は元のコードブロックのまま表示する
      }
      if (!data.url) return;

      const textChildren: unknown[] = [
        {
          type: 'element',
          tagName: 'div',
          properties: { className: ['cardlink-title'] },
          children: [{ type: 'text', value: data.title ?? data.url }],
        },
      ];
      if (data.description) {
        textChildren.push({
          type: 'element',
          tagName: 'div',
          properties: { className: ['cardlink-description'] },
          children: [{ type: 'text', value: data.description }],
        });
      }

      const hostChildren: unknown[] = [];
      if (data.favicon) {
        hostChildren.push({
          type: 'element',
          tagName: 'img',
          properties: { className: ['cardlink-favicon'], src: data.favicon, alt: '' },
          children: [],
        });
      }
      hostChildren.push({
        type: 'element',
        tagName: 'span',
        properties: {},
        children: [{ type: 'text', value: data.host ?? safeHostname(data.url) }],
      });
      textChildren.push({
        type: 'element',
        tagName: 'div',
        properties: { className: ['cardlink-host'] },
        children: hostChildren,
      });

      const children: unknown[] = [
        { type: 'element', tagName: 'div', properties: { className: ['cardlink-content'] }, children: textChildren },
      ];
      if (data.image) {
        children.push({
          type: 'element',
          tagName: 'div',
          properties: { className: ['cardlink-thumb'] },
          children: [{ type: 'element', tagName: 'img', properties: { src: data.image, alt: '' }, children: [] }],
        });
      }

      const cardNode = {
        type: 'cardLink',
        data: {
          hName: 'a',
          hProperties: {
            href: data.url,
            class: 'cardlink',
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          hChildren: children,
        },
      };
      (parent as Parent).children.splice(index, 1, cardNode as never);
    });
  };
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
