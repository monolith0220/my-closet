import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sleeveLengthFor } from '../src/lib/sleeve-length.ts'

test('商品名に明示された半袖と長袖を判定する', () => {
  assert.equal(sleeveLengthFor({ name: 'エアリズムTシャツ（半袖）' }), '半袖')
  assert.equal(sleeveLengthFor({ name: 'コットンシャツ（長袖）' }), '長袖')
  assert.equal(sleeveLengthFor({ name: 'オーバーサイズT／5分袖' }), '半袖')
  assert.equal(sleeveLengthFor({ name: 'Long Sleeve T-Shirt' }), '長袖')
})

test('記載がないか両方記載された商品は決めつけない', () => {
  assert.equal(sleeveLengthFor({ name: 'エアリズムVネックT' }), null)
  assert.equal(sleeveLengthFor({ name: '半袖・長袖セット' }), null)
})
