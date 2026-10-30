import assert from 'node:assert/strict'
import { test } from 'node:test'
import { outfitPairKey, suggestLowViewOutfits } from '../src/lib/low-view-outfits.ts'

function item(id, category, viewCount, extra = {}) {
  return {
    id, name: id, category, created_at: '2026-01-01T00:00:00Z',
    is_active: true, is_favorite: true, view_count: viewCount, ...extra,
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

test('お気に入りだけを提案候補にする', () => {
  const pairs = suggestLowViewOutfits([
    item('not-favorite-top', 'トップス', 0, { is_favorite: false }),
    item('favorite-top', 'トップス', 5),
    item('not-favorite-bottom', 'ボトムス', 0, { is_favorite: false }),
    item('favorite-bottom', 'ボトムス', 5),
  ])
  assert.deepEqual(pairs.map(pair => [pair.top.id, pair.bottom.id]), [['favorite-top', 'favorite-bottom']])
})
