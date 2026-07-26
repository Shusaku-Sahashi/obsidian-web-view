# アーキテクチャ

Obsidian Vaultの特定フォルダをブログ風に一覧表示し、記事詳細はサイト内で全文レンダリングしつつ「Obsidianで開く」リンクも提供する、Astro製の静的サイト。

## 全体像

```
Obsidian Vault (ローカル/iCloud)
   │ symlink
   ▼
contents/  ← vaultルート（git管理外）
   │ site.config.yaml の targetFolder 配下を再帰走査
   ▼
notes-index.ts  ← ファイル名パース・slug生成・obsidian://URI生成の単一情報源
   │
   ▼
.obsidian-staging/  ← URLセーフなslug名でのフラットコピー（Astroのバグ回避）
   │ Content Layer API (glob loader)
   ▼
astro:content の `posts` コレクション
   │ remark/rehypeパイプライン
   ▼
dist/  ← 静的HTML一式
```

## なぜこの構成なのか

- `contents/` はObsidian vault本体（またはそのsymlink）で、**git管理外**（`.gitignore`）。個人のノートをリポジトリにコミットしたくないため。
- vaultの中で実際にサイトに載せたいのは一部のフォルダだけなので、`site.config.yaml` の `targetFolder` で対象を絞り込む。
- Astroの標準的な`src/content/`配下コレクション運用ではなく、プロジェクトルート直下の`contents/`を直接読む構成にしている（`glob()`ローダーの`base`オプションで対応）。

## 設定ファイル: `site.config.yaml`

```yaml
vaultName: "Ideastorage"        # obsidian://リンクに使うVault表示名
targetFolder: "Floating/Activity"  # vaultルートからの相対パス。一覧表示対象
attachmentsDir: "Meta/Images"      # 添付ファイル（画像/動画）置き場。空文字なら同期しない
```

`src/lib/site-config.ts` が読み込み・検証（`vaultName`必須）を行う。`yaml`パッケージでパース。

## コンテンツパイプライン

### 1. `src/lib/notes-index.ts`（単一情報源）

- `VAULT_DIR` = `contents/`（vaultルート）、`TARGET_DIR` = `VAULT_DIR/targetFolder`
- `targetFolder`配下を再帰的に走査し、`.md`ファイルを列挙（隠しフォルダ・ファイルは除外）
- ファイル名規約「絵文字 YYYY-MM-DD タイトル.md」を正規表現でパース。日付が無い・絵文字のみ等のイレギュラーな命名にもフォールバック対応
- `slug`はvaultルートからの相対パスのsha1ハッシュ8桁（+日付があれば先頭に付与）。同名ファイルが別フォルダにあっても衝突しない
- `obsidianFileUri(note)`: `obsidian://open?vault=...&file=...` を生成（vaultルート相対パス、拡張子除去、セグメント単位でURLエンコード）
- `buildWikiLinkResolutionMap()`: `[[wikilink]]`解決用に、正規化した stem/表示タイトル → slug のマップを構築

### 2. `src/lib/content-staging.ts`（Astroのバグ回避）

Astro 7.0.7時点の`glob()`ローダーは内部で`new URL(encodeURI(entry), base)`を使っており、`encodeURI`が`#`をエスケープしないため、**ファイル名に`#`を含むノートが読み込めない**（`#`以降がURLフラグメントとして切り捨てられる）バグがある。

対策として、`targetFolder`配下の全ノートをURLセーフな`{slug}.md`という名前で`.obsidian-staging/`（gitignore対象）へコピーし、Astroにはそちらを読ませている。差分同期（不要になったファイルは削除）。

### 3. `src/content.config.ts`

```ts
glob({ pattern: '*.md', base: syncContentStaging(), generateId: ({ entry }) => entry.replace(/\.md$/, '') })
```

ステージング済みファイル名がそのままslugなので、`generateId`は拡張子を外すだけ。

### 4. `src/lib/frontmatter.ts`（zodスキーマ）

Obsidianのfrontmatterは記事ごとにばらつきがあるため柔軟に検証:
- `created`: `YYYY-MM-DD` / `YYYY-MM-DD HH:mm` 両対応、必須
- `tags` / `aliases`: 配列 or null/未指定 → `[]`にフォールバック
- `up` / `related`: 文字列 or 配列（Obsidianの単一プロパティ/複数プロパティ表記どちらもある）
- 未知フィールドは`.passthrough()`で許容

## Markdownレンダリングパイプライン（`astro.config.ts`）

`@astrojs/markdown-remark`の`unified()`カスタムプロセッサで構成:

```ts
remarkPlugins: [
  [remarkObsidian, { noteLinks, attachmentUrls }],
  remarkCardlink,
  remarkCodeFilename,
],
rehypePlugins: [
  [rehypeCallouts, { theme: 'obsidian' }],
],
```

| プラグイン | 役割 |
|---|---|
| `src/lib/remark-obsidian.ts` | `[[wikilink]]` / `[[wikilink\|alias]]` / `![[embed]]` を変換。解決できるリンクは`/posts/[slug]/`へ、できないものは非クリッカブルなグレー表示。埋め込みは添付ファイルがあれば`<img>`/`<video>`、無ければプレースホルダー表示 |
| `src/lib/remark-cardlink.ts` | Obsidian「Auto Card Link」プラグインが生成する`` ```cardlink ``ブロック（YAML形式）をリッチなリンクカードに変換 |
| `src/lib/remark-code-filename.ts` | `` ```lang file:filename `` / `` ```lang file:"filename" `` というmeta記法から、コードブロック直上にファイル名バーを表示 |
| `rehype-callouts`（obsidianテーマ） | `> [!tip]`等のコールアウト記法を種類別アイコン付きボックスに変換。`!`の直後にスペースがあると認識されない点に注意 |

`src/lib/attachments.ts`: `attachmentsDir`配下の画像/動画を`public/obsidian-assets/`へ差分コピー（サイズ+更新日時が一致すればスキップ、rsyncのクイックチェック相当）。基本的にコピー元が動くことはないので、コピー先には基本的にコピー元のファイル名（basename）だけをキーにしたマップを構築する。

`src/lib/excerpt.ts`: 一覧用に、本文からMarkdown/Obsidian記法を除去したプレーンテキスト抜粋を生成（140文字）。

`src/lib/status.ts`: frontmatterの`status`値をURLセーフなスラッグに正規化（絵文字・変異セレクタ除去 → 小文字化 → 非英数字をハイフンに）。固定の値マップは持たないため、Obsidian側でステータスの種類が増えても自動でページが生成される。

## ページ構成

| パス | ファイル | 内容 |
|---|---|---|
| `/` | `src/pages/index.astro` | 全記事一覧（`created`降順） |
| `/posts/[slug]/` | `src/pages/posts/[slug].astro` | 記事全文。タイトル・日付・タグに加え「Obsidianで開く」リンク |
| `/tags/[tag]/` | `src/pages/tags/[tag].astro` | タグ別一覧。階層タグ（`Language/Haskell`等、`/`を含む）は`encodeURIComponent`でルーティング |
| `/status/[status]/` | `src/pages/status/[status].astro` | ステータス別一覧（執筆管理用）。frontmatterの`status`（例: `✍️ In Progress`）を`src/lib/status.ts`の`statusSlug()`で正規化したスラッグ（`in-progress`等）でルーティング。`status`未設定の記事はどのステータスページにも含まれない |
| `/archive/[year]/[month]/` | `src/pages/archive/[year]/[month].astro` | 年月別一覧 |

## コンポーネント

- `BaseLayout.astro`: 2カラムレイアウト（本文 + サイドバー）。サイドバーは`TagCloud`・`StatusList`・`DateArchive`を縦に並べる
- `PostCard.astro` / `PostList.astro`: 一覧の1件分（日付・タイトル・抜粋・ステータス・タグ）とその並び。詳細ページへのリンクに使用
- `TagBadge.astro`: クリック可能なタグバッジ
- `StatusBadge.astro`: クリック可能なステータスバッジ。タグ（塗りつぶしピル）と区別できるアウトライン型。一覧カードと記事詳細ヘッダに表示
- `TagCloud.astro`: 全タグを件数付きで一覧表示（サイドバー）
- `StatusList.astro`: 全ステータスを件数付きで一覧表示（サイドバー）。表示ラベルは絵文字付きの元の値、リンク先は正規化スラッグ
- `DateArchive.astro`: 年→月の階層で記事件数を表示し、`/archive/[year]/[month]/`へリンク（サイドバー）

## 既知の制約

- `notes-index.ts`のノート一覧はプロセス起動時に一度だけ読み込みキャッシュされる。`npm run dev`実行中に`contents/`の中身が変わっても反映されないため再起動が必要（`build`/`preview`は毎回新規プロセスなので問題ない）
- slugはファイルの相対パスに依存するため、ファイル名やフォルダ構成を変更すると記事のURLが変わる
- `obsidian://`リンクは、閲覧者自身のPCに同名のvaultがローカルに存在し、Obsidianがインストールされている場合のみ機能する（公開デプロイして他人が見ても機能しない）

## デプロイ / Docker

`contents/`はgit管理外かつvaultへのsymlinkのため、通常のgit push型CIでは中身が空になる。そのため:

- `Dockerfile`: イメージには`contents/`を焼き込まず、コンテナ起動時（`CMD`）に`npm run build && npm run preview`を実行する構成。vaultは実行時にbind mountする前提
- `docker-compose.yml`: 実vaultと`site.config.yaml`をbind mount、`.obsidian-staging`/`public/obsidian-assets`は名前付きボリュームで永続化（再起動時の差分コピーを高速化）、`restart: unless-stopped`で常時稼働
- コンテンツを更新したいときは、コンテナ再起動 または `docker compose exec <service> npm run build`（`preview`はディスクから都度配信するため無停止で反映される）

公開デプロイする場合、CI環境に`contents/`を用意する仕組み（別リポジトリ経由の同期等）が別途必要になる。

## テスト

Node標準の`node:test`で`src/lib/*.test.ts`を実行（`npm test`）。`notes-index.test.ts`がファイル名パース・slug生成・wikilink解決・obsidian URI生成を、`status.test.ts`がステータス値の正規化をカバー。フルのテストランナー（Vitest等）は導入していない。
