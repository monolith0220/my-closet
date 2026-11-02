import assert from 'node:assert/strict'
import { test } from 'node:test'
import { uniqueTopIds, validateOutfitSelection } from '../src/lib/outfit-selection.ts'

test('複数のトップスを選択順のまま重複なく保存する', () => {
  assert.deepEqual(uniqueTopIds(['top-1', 'top-2', 'top-1', '']), ['top-1', 'top-2'])
  assert.deepEqual(validateOutfitSelection(['top-1', 'top-2'], 'bottom-1'), ['top-1', 'top-2'])
})

test('トップスまたはボトムスがない組み合わせを拒否する', () => {
  assert.throws(() => validateOutfitSelection([], 'bottom-1'), /上に着るもの/)
  assert.throws(() => validateOutfitSelection(['top-1'], ''), /下に着るもの/)
})

test('同じアイテムを上下には指定できない', () => {
  assert.throws(() => validateOutfitSelection(['same'], 'same'), /異なるアイテム/)
})
