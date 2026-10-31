import assert from 'node:assert/strict'
import { test } from 'node:test'
import { itemMatchesSeason, outfitPairKey, seasonForDate, suggestLowViewOutfits } from '../src/lib/low-view-outfits.ts'

function item(id, category, viewCount, extra = {}) {
  return {
    id, name: id, category, created_at: '2026-01-01T00:00:00Z',
    is_active: true, is_favorite: true, seasons: [], view_count: viewCount, ...extra,
  }
}

test('閲覧の少ない上下アイテムを優先し、候補内で使い回さない', () => {
  const clothes = [
    item('top2', 'トップス', 2), item('bottom2', 'ボトムス', 3),
    item('top0', 'アウター', 0), item('bottom0', 'ボトムス', 0),
    item('top1', 'トップス', 1), item('bottom1', 'ボトムス', 1),
    item('sock', 'レッグウェア', 0),
  ]
  const pairs = suggestLowViewOutfits(clothes, new Set(), 3)
  assert.deepEqual(pairs.map(pair => [pair.top.id, pair.bottom.id]), [
    ['top0', 'bottom0'], ['top1', 'bottom1'], ['top2', 'bottom2'],
  ])
})

test('登録解除済みと保存済みの組み合わせを除外する', () => {
  const clothes = [
    item('upper', 'トップス', 0),
    item('inactive', 'ボトムス', 0, { is_active: false }),
    item('lower1', 'ボトムス', 0),
    item('lower2', 'ボトムス', 1),
  ]
  const excluded = new Set([outfitPairKey('upper', 'lower1')])
  assert.deepEqual(suggestLowViewOutfits(clothes, excluded).map(pair => pair.bottom.id), ['lower2'])
})

test('上下が不足する場合は空、件数上限も守る', () => {
  assert.deepEqual(suggestLowViewOutfits([item('top', 'トップス', 0)]), [])
  assert.deepEqual(suggestLowViewOutfits([
    item('a', 'トップス', 0), item('b', 'トップス', 0),
    item('c', 'ボトムス', 0), item('d', 'ボトムス', 0),
  ], new Set(), 1).length, 1)
})

test('お気に入りに関係なく閲覧回数の少ないアイテムを優先する', () => {
  const pairs = suggestLowViewOutfits([
    item('not-favorite-top', 'トップス', 0, { is_favorite: false }),
    item('favorite-top', 'トップス', 5),
    item('not-favorite-bottom', 'ボトムス', 0, { is_favorite: false }),
    item('favorite-bottom', 'ボトムス', 5),
  ])
  assert.deepEqual(pairs.map(pair => [pair.top.id, pair.bottom.id]), [
    ['not-favorite-top', 'not-favorite-bottom'], ['favorite-top', 'favorite-bottom'],
  ])
})

test('日付の月から現在の季節を判定する', () => {
  assert.equal(seasonForDate(new Date(2026, 1, 28)), '冬')
  assert.equal(seasonForDate(new Date(2026, 2, 1)), '春')
  assert.equal(seasonForDate(new Date(2026, 5, 1)), '夏')
  assert.equal(seasonForDate(new Date(2026, 8, 1)), '秋')
  assert.equal(seasonForDate(new Date(2026, 11, 1)), '冬')
})

test('現在の季節と季節未設定だけを提案候補にする', () => {
  assert.equal(itemMatchesSeason(item('all-year', 'トップス', 0), '秋'), true)
  assert.equal(itemMatchesSeason(item('autumn', 'トップス', 0, { seasons: ['秋'] }), '秋'), true)
  assert.equal(itemMatchesSeason(item('summer', 'トップス', 0, { seasons: ['夏'] }), '秋'), false)

  const pairs = suggestLowViewOutfits([
    item('summer-top', 'トップス', 0, { seasons: ['夏'] }),
    item('autumn-top', 'トップス', 3, { seasons: ['秋'] }),
    item('all-year-bottom', 'ボトムス', 1),
    item('winter-bottom', 'ボトムス', 0, { seasons: ['冬'] }),
  ], new Set(), 3, '秋')
  assert.deepEqual(pairs.map(pair => [pair.top.id, pair.bottom.id]), [['autumn-top', 'all-year-bottom']])
})
