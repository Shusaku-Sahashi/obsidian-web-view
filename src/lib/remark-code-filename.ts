import { visit } from 'unist-util-visit';
import type { Root, Code, Parent } from 'mdast';

// ```lang file:filename / ```lang file:"filename with spaces" の meta 表記からファイル名を取り出す
const FILE_META_RE = /(?:^|\s)file:(?:"([^"]+)"|(\S+))/;

/** コードブロックのfile:メタ情報から、コード直上にファイル名バーを追加する */
export function remarkCodeFilename() {
  return (tree: Root) => {
    visit(tree, 'code', (node: Code, index, parent) => {
      if (!node.meta || !parent || index === undefined) return;
      const m = node.meta.match(FILE_META_RE);
      if (!m) return;
      const filename = m[1] ?? m[2];

      const labelNode = {
        type: 'codeFilename',
        data: {
          hName: 'div',
          hProperties: { class: 'code-filename' },
          hChildren: [{ type: 'text', value: filename }],
        },
      };
      (parent as Parent).children.splice(index, 0, labelNode as never);
      return index + 2; // 追加したラベルと元のcodeノードの両方をスキップして続行
    });
  };
}
