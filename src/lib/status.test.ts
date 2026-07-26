import test from 'node:test';
import assert from 'node:assert/strict';
import { statusSlug } from './status.ts';

test('絵文字プレフィックス付きのstatus値を英小文字スラッグに正規化する', () => {
  assert.equal(statusSlug('✍️ In Progress'), 'in-progress');
  assert.equal(statusSlug('✅ Done'), 'done');
});

test('未知のstatus値でも自動でスラッグ化できる', () => {
  assert.equal(statusSlug('🗄 Archived'), 'archived');
  assert.equal(statusSlug('保留'), '保留');
});

test('絵文字なし・余分な空白があっても同じスラッグに揃う', () => {
  assert.equal(statusSlug('Done'), statusSlug('✅ Done'));
  assert.equal(statusSlug('  In  Progress '), 'in-progress');
});
