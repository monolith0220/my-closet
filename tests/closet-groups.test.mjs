import assert from 'node:assert/strict'
import { test } from 'node:test'
import { closetGroupFor, closetGroups, sortClothingByGroup } from '../src/lib/closet-groups.ts'

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

test('条件なしのクローゼットは大分類順を優先し、分類内の順番を保つ', () => {
  const items = [
    { id: 'other', name: 'ワンピース', category: 'その他' },
    { id: 'top-new', name: 'Tシャツ', category: 'トップス' },
    { id: 'outer', name: 'コート', category: 'アウター' },
    { id: 'bottom', name: 'パンツ', category: 'ボトムス' },
    { id: 'top-old', name: 'シャツ', category: 'トップス' },
    { id: 'legwear', name: 'ソックス', category: '小物' },
    { id: 'accessory', name: 'ベルト', category: '小物' },
  ]

  assert.deepEqual(sortClothingByGroup(items).map(item => item.id), [
    'outer', 'top-new', 'top-old', 'bottom', 'legwear', 'accessory', 'other',
  ])
})
