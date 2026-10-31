import assert from 'node:assert/strict'
import { test } from 'node:test'
import { closetGroupFor, closetGroups } from '../src/lib/closet-groups.ts'
import { closetSubcategories, closetSubcategoryFor, sortClothingBySubcategory } from '../src/lib/closet-subcategories.ts'

test('すべての大分類に重複のない小分類と「その他」がある', () => {
  assert.deepEqual(closetSubcategories.アウター, ['ブルゾン', 'ジャケット', 'ダウン', 'コート', 'パーカ', 'その他'])
  for (const group of closetGroups) {
    assert.ok(closetSubcategories[group].length > 1)
    assert.ok(closetSubcategories[group].includes('その他'))
    assert.equal(new Set(closetSubcategories[group]).size, closetSubcategories[group].length)
  }
})

test('アウターはダウンを優先して指定の5種類に分類する', () => {
  const cases = [
    ['ショートブルゾン', 'ブルゾン'],
    ['感動ジャケット', 'ジャケット'],
    ['ハイブリッドダウンMA-1ブルゾン', 'ダウン'],
    ['ブロックテックコート', 'コート'],
    ['ライトウェイトパーカ', 'パーカ'],
    ['パフテックジャケット', 'ジャケット'],
    ['パフテックベスト', 'その他'],
    ['フリースベスト', 'その他'],
  ]
  for (const [name, expected] of cases) {
    assert.equal(closetSubcategoryFor({ name, category: 'アウター' }), expected, name)
  }
})

test('ほかの大分類も商品名と旧カテゴリから小分類を付ける', () => {
  const cases = [
    [{ name: 'エアリズムコットンTシャツ', category: 'トップス' }, 'Tシャツ'],
    [{ name: 'エアリズムVネックT', category: 'トップス' }, 'Tシャツ'],
    [{ name: 'クロップドUT', category: 'トップス' }, 'Tシャツ'],
    [{ name: 'クルーネックＴ（半袖）', category: 'トップス' }, 'Tシャツ'],
    [{ name: 'ワイヤレスブラ', category: 'トップス' }, 'インナー'],
    [{ name: '前あきブラ', category: 'トップス' }, 'インナー'],
    [{ name: 'エアリズムボディスーツ', category: 'トップス' }, 'インナー'],
    [{ name: 'オックスフォードシャツ', category: 'トップス' }, 'シャツ・ブラウス'],
    [{ name: 'コットンブラウス', category: 'トップス' }, 'シャツ・ブラウス'],
    [{ name: 'ニットカーディガン', category: 'トップス' }, 'カーディガン'],
    [{ name: 'スウェットシャツ', category: 'トップス' }, 'スウェット'],
    [{ name: 'デニムショートパンツ', category: 'ボトムス' }, 'ショートパンツ'],
    [{ name: 'ウルトラストレッチジーンズ', category: 'ボトムス' }, 'デニム'],
    [{ name: 'スポーツハーフソックス', category: '小物' }, 'ソックス'],
    [{ name: 'ヒートテックタイツ', category: 'ボトムス' }, 'タイツ'],
    [{ name: 'ドローストリングショルダーバッグ', category: 'バッグ' }, 'バッグ'],
    [{ name: 'スニーカー', category: 'シューズ' }, 'シューズ'],
    [{ name: 'リネンワンピース', category: 'ワンピース' }, 'ワンピース'],
    [{ name: '不明なアイテム', category: 'その他' }, 'その他'],
  ]
  for (const [item, expected] of cases) {
    const group = closetGroupFor(item)
    const subcategory = closetSubcategoryFor(item)
    assert.equal(subcategory, expected, item.name)
    assert.ok(closetSubcategories[group].includes(subcategory), item.name)
  }
})

test('明示した大分類と小分類を自動判定より優先する', () => {
  const explicit = { name: 'スウェットパンツ', category: 'ボトムス', category_group: 'その他', subcategory: 'ルームウェア' }
  assert.equal(closetGroupFor(explicit), 'その他')
  assert.equal(closetSubcategoryFor(explicit), 'ルームウェア')

  const invalid = { name: 'デニムパンツ', category: 'ボトムス', category_group: '不正', subcategory: '不正' }
  assert.equal(closetGroupFor(invalid), 'ボトムス')
  assert.equal(closetSubcategoryFor(invalid), 'デニム')
})

test('大分類だけの表示は小分類ごとに並べる', () => {
  const items = [
    { id: 'sweat-1', name: 'スウェット', category: 'トップス' },
    { id: 'tee-1', name: 'Tシャツ', category: 'トップス' },
    { id: 'shirt-1', name: 'オックスフォードシャツ', category: 'トップス' },
    { id: 'tee-2', name: 'クルーネックTシャツ', category: 'トップス' },
  ]
  assert.deepEqual(sortClothingBySubcategory(items, 'トップス').map(item => item.id), [
    'tee-1', 'tee-2', 'shirt-1', 'sweat-1',
  ])
})
