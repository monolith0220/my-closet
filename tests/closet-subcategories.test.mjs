import assert from 'node:assert/strict'
import { test } from 'node:test'
import { closetGroupFor, closetGroups } from '../src/lib/closet-groups.ts'
import { closetSubcategories, closetSubcategoryFor } from '../src/lib/closet-subcategories.ts'

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
