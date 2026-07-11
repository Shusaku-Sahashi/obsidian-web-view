import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TARGET_DIR,
  loadNotesIndex,
  parseNote,
  slugForPath,
  buildWikiLinkResolutionMap,
  normalizeKey,
  obsidianFileUri,
} from './notes-index.ts';

function countMarkdownRecursive(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) count += countMarkdownRecursive(full);
    else if (entry.name.endsWith('.md')) count += 1;
  }
  return count;
}

test('対象フォルダ配下の全Markdown（サブフォルダ含む）がパースできる', () => {
  const notes = loadNotesIndex();
  assert.equal(notes.length, countMarkdownRecursive(TARGET_DIR));
  assert.ok(notes.length > 0, 'targetFolder配下にMarkdownが存在すること');
  for (const note of notes) {
    // 絵文字+日付の命名規則(📔 YYYY-MM-DD タイトル.md)に従わないノートも
    // 実vaultには混在しうるため、fileDateはnullを許容する
    if (note.fileDate) {
      assert.match(note.fileDate, /^\d{4}-\d{2}-\d{2}$/);
    }
    assert.ok(!/\p{Extended_Pictographic}/u.test(note.displayTitle), `${note.filename}: タイトルに絵文字が残っている`);
  }
});

test('slugは全ノートで一意かつURLセーフ', () => {
  const notes = loadNotesIndex();
  const slugs = new Set(notes.map((n) => n.slug));
  assert.equal(slugs.size, notes.length, 'slugが衝突している');
  for (const note of notes) {
    // 命名規則に従うノートは "YYYY-MM-DD-hash8桁"、従わないノートは "hash8桁" のみ
    assert.match(note.slug, /^(?:\d{4}-\d{2}-\d{2}-)?[0-9a-f]{8}$/);
  }
});

test('relativePathはvaultルート基準で、サブフォルダを含む', () => {
  const notes = loadNotesIndex();
  for (const note of notes) {
    assert.ok(!note.relativePath.startsWith('/'), '相対パスは/始まりでないこと');
    assert.ok(note.relativePath.endsWith(note.filename));
  }
});

test('同一相対パスなら同一slugを返す（決定的）', () => {
  const note = parseNote('サブフォルダ/📔 2024-08-24 テスト.md');
  assert.equal(note.slug, slugForPath('サブフォルダ/📔 2024-08-24 テスト.md'));
});

test('wikilink解決マップはstemと表示タイトルの両方で引ける', () => {
  const map = buildWikiLinkResolutionMap();
  const notes = loadNotesIndex();
  assert.ok(notes.length > 0);
  const note = notes[0];
  assert.equal(map.get(normalizeKey(note.stem))?.slug, note.slug);
  assert.equal(map.get(normalizeKey(note.displayTitle))?.slug, note.slug);
  assert.equal(map.get(normalizeKey('存在しないノート')), undefined);
});

test('obsidianFileUriはvault名とパスをエンコードし拡張子を除去する', () => {
  const note = parseNote('Diary/📔 2024-08-24 テスト タイトル.md');
  const uri = obsidianFileUri(note);
  assert.match(uri, /^obsidian:\/\/open\?vault=/);
  assert.ok(!uri.includes('.md'), '拡張子は除去されること');
  assert.ok(uri.includes('Diary/'), 'スラッシュ区切りは維持されること');
  assert.ok(uri.includes(encodeURIComponent('📔 2024-08-24 テスト タイトル')), 'パスの各セグメントはエンコードされること');
});
