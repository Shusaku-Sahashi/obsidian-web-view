import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CONTENTS_DIR,
  loadNotesIndex,
  parseFilename,
  slugForFilename,
  buildWikiLinkResolutionMap,
  normalizeKey,
} from './notes-index.ts';

test('contents内の全ファイル名がパースできる（絵文字・日付・タイトルに分解）', () => {
  const notes = loadNotesIndex();
  const files = fs.readdirSync(CONTENTS_DIR).filter((f) => f.endsWith('.md'));
  assert.equal(notes.length, files.length);
  assert.ok(notes.length > 0, 'contents/にMarkdownが存在すること');
  for (const note of notes) {
    assert.ok(note.fileDate, `${note.filename}: 日付が抽出できていない`);
    assert.match(note.fileDate!, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!/\p{Extended_Pictographic}/u.test(note.displayTitle), `${note.filename}: タイトルに絵文字が残っている`);
    assert.ok(!note.displayTitle.startsWith(note.fileDate!), `${note.filename}: タイトルに日付が残っている`);
  }
});

test('slugは全ノートで一意かつURLセーフ', () => {
  const notes = loadNotesIndex();
  const slugs = new Set(notes.map((n) => n.slug));
  assert.equal(slugs.size, notes.length, 'slugが衝突している');
  for (const note of notes) {
    assert.match(note.slug, /^\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$/);
  }
});

test('slugForFilenameは拡張子の有無で同じ結果を返す（glob loaderのentryとの整合）', () => {
  const withExt = slugForFilename('📔 2024-08-24 フロントエンドの歴史をまとめる.md');
  const withoutExt = slugForFilename('📔 2024-08-24 フロントエンドの歴史をまとめる');
  assert.equal(withExt, withoutExt);
});

test('wikilink解決マップはstemと表示タイトルの両方で引ける', () => {
  const map = buildWikiLinkResolutionMap();
  const note = parseFilename('📔 2024-07-20 Pull Request Reviewの意義を考えてみる.md');
  assert.equal(map.get(normalizeKey(note.stem))?.slug, note.slug);
  assert.equal(map.get(normalizeKey(note.displayTitle))?.slug, note.slug);
  assert.equal(map.get(normalizeKey(note.stem))?.displayTitle, note.displayTitle);
  assert.equal(map.get(normalizeKey('存在しないノート')), undefined);
});
