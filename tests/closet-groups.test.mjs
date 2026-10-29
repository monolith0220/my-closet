import assert from 'node:assert/strict'
import { test } from 'node:test'
import { closetGroupFor, closetGroups } from '../src/lib/closet-groups.ts'

test('クローゼットの分類は6グループに固定する', () => {
  assert.deepEqual(closetGroups, ['アウター', 'トップス', 'ボトムス', 'レッグウェア', 'アクセサリー', 'その他'])
})

test('靴下・タイツ・レギンスを元カテゴリより優先してレッグウェアにする', () => {
  assert.equal(closetGroupFor({ name: 'スポーツハーフソックス', category: '小物' }), 'レッグウェア')
  assert.equal(closetGroupFor({ name: 'ヒートテックタイツ', category: 'ボトムス' }), 'レッグウェア')
  assert.equal(closetGroupFor({ name: 'エアリズムレギンス', category: 'その他' }), 'レッグウェア')
})

test('旧カテゴリをアクセサリーとその他にまとめる', () => {
  for (const category of ['小物', 'バッグ', 'シューズ']) {
    assert.equal(closetGroupFor({ name: '商品', category }), 'アクセサリー')
  }
  assert.equal(closetGroupFor({ name: 'ベルト', category: 'その他' }), 'アクセサリー')
  assert.equal(closetGroupFor({ name: 'ワンピース', category: 'ワンピース' }), 'その他')
  assert.equal(closetGroupFor({ name: 'オックスフォードシャツ/ボタンダウン', category: 'アウター' }), 'トップス')
  assert.equal(closetGroupFor({ name: 'オーバーシャツジャケット', category: 'アウター' }), 'アウター')
  assert.equal(closetGroupFor({ name: 'シャツブルゾン', category: 'アウター' }), 'アウター')
})
