import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clothingSortOptions, formatClothingSize, normalizePurchaseDate, purchaseDateFor, sortClothing, stripPurchaseDateFromMemo } from '../src/lib/clothing-display.ts'

function item(id, overrides = {}) {
  return {
    id,
    user_id: 'user',
    name: id,
    brand: 'UNIQLO',
    category: 'トップス',
    color: 'ブラック',
    size: null,
    seasons: [],
    style_tags: [],
    product_code: null,
    product_url: null,
    image_path: null,
    registration_method: 'manual',
    memo: null,
    purchased_at: null,
    is_favorite: false,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

test('表示サイズから性別・年齢の接頭語だけを外す', () => {
  assert.equal(formatClothingSize('MEN M'), 'M')
  assert.equal(formatClothingSize('WOMEN XL'), 'XL')
  assert.equal(formatClothingSize('ＢＡＢＹ ８０(18ヶ月)'), '80(18ヶ月)')
  assert.equal(formatClothingSize('ONE SIZE'), 'ONE SIZE')
  assert.equal(formatClothingSize(null), '')
})

test('購入日は専用列を優先し、既存のメモからも読み取る', () => {
  assert.equal(normalizePurchaseDate('2026/5/22'), '2026-05-22')
  assert.equal(normalizePurchaseDate('2026-05-22'), '2026-05-22')
  assert.equal(normalizePurchaseDate('2026/2/30'), null)
  assert.equal(purchaseDateFor(item('stored', { purchased_at: '2026-05-22', memo: '購入日: 2024/1/2' })), '2026-05-22')
  assert.equal(purchaseDateFor(item('legacy', { memo: '購入日: 2024/1/2 / ユニクロカラー: 09 BLACK' })), '2024-01-02')
  assert.equal(purchaseDateFor(item('invalid', { memo: '購入日: 2026/2/30' })), null)
})

test('編集時にメモの旧購入日を取り除き、購入日の削除が反映される', () => {
  const memo = stripPurchaseDateFromMemo('購入日: 2024/1/2 / ユニクロカラー: 09 BLACK')
  assert.equal(memo, 'ユニクロカラー: 09 BLACK')
  assert.equal(purchaseDateFor(item('cleared', { purchased_at: null, memo })), null)
  assert.equal(stripPurchaseDateFromMemo('着用メモ / 購入日: 2024/1/2 / 色メモ'), '着用メモ / 色メモ')
})

test('購入日・お気に入り・商品名などの並び順を切り替える', () => {
  const rows = [
    item('old', { name: 'Z', created_at: '2025-01-01T00:00:00Z', memo: '購入日: 2026/2/1' }),
    item('new', { name: 'A', created_at: '2026-01-01T00:00:00Z', purchased_at: '2026-01-01' }),
    item('favorite', { name: 'M', created_at: '2025-06-01T00:00:00Z', is_favorite: true }),
  ]
  assert.deepEqual(sortClothing(rows, 'newest').map(row => row.id), ['new', 'favorite', 'old'])
  assert.deepEqual(sortClothing(rows, 'purchase_newest').map(row => row.id), ['old', 'new', 'favorite'])
  assert.deepEqual(sortClothing(rows, 'favorites_first').map(row => row.id), ['favorite', 'new', 'old'])
  assert.deepEqual(sortClothing(rows, 'name').map(row => row.id), ['new', 'favorite', 'old'])
  assert.equal(rows[0].id, 'old')
  assert.equal(clothingSortOptions.length, 7)
})
