import assert from 'node:assert/strict'
import { test } from 'node:test'
import { criteriaFromQuery, filterClothingItems } from '../src/lib/closet-search.ts'

const ids = {
  short: '11111111-1111-4111-8111-111111111111',
  long: '22222222-2222-4222-8222-222222222222',
  bottom: '33333333-3333-4333-8333-333333333333',
}

function item(id, name, category, extra = {}) {
  return {
    id, user_id: 'user', name, category, brand: 'UNIQLO', color: 'ブラック',
    size: 'MEN M', product_code: null, image_path: null, is_favorite: false, collection: null,
    ...extra,
  }
}

const clothes = [
  item(ids.short, 'クルーネックTシャツ（半袖）', 'トップス', { is_favorite: true }),
  item(ids.long, 'クルーネックTシャツ（長袖）', 'トップス'),
  item(ids.bottom, 'ワイドパンツ', 'ボトムス'),
]

test('検索条件をURLから読み取り、種類と袖丈を同時に適用する', () => {
  const criteria = criteriaFromQuery({ category: 'トップス', subcategory: 'Tシャツ', sleeve: '半袖', q: 'クルーネック' })
  assert.deepEqual(filterClothingItems(clothes, criteria).map(row => row.id), [ids.short])
})

test('お気に入りで絞り込む', () => {
  const criteria = criteriaFromQuery({ favorites: '1' })
  assert.deepEqual(filterClothingItems(clothes, criteria).map(row => row.id), [ids.short])
})

test('ユニクロU/Cのラインで絞り込む', () => {
  const tagged = [clothes[0], { ...clothes[1], collection: 'UNIQLO U' }, { ...clothes[2], collection: 'UNIQLO : C' }]
  assert.deepEqual(filterClothingItems(tagged, criteriaFromQuery({ collection: 'UNIQLO U' })).map(row => row.id), [ids.long])
  assert.deepEqual(filterClothingItems(tagged, criteriaFromQuery({ collection: 'UNIQLO : C' })).map(row => row.id), [ids.bottom])
})

test('無効なカテゴリや配列のURL値を無視する', () => {
  const criteria = criteriaFromQuery({ category: '不正', q: ['パンツ'], sleeve: '不正' })
  assert.equal(criteria.category, '')
  assert.equal(criteria.q, '')
  assert.equal(criteria.sleeve, 'すべて')
  assert.equal(filterClothingItems(clothes, criteria).length, 3)
})
