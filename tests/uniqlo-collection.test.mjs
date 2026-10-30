import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectUniqloCollection } from '../src/lib/uniqlo-collection.ts'

test('明示されたユニクロU/Cだけを分類する', () => {
  assert.equal(detectUniqloCollection('UNIQLO U', 'クルーネックT'), 'UNIQLO U')
  assert.equal(detectUniqloCollection('UNIQLO', 'ユニクロU クルーネックT'), 'UNIQLO U')
  assert.equal(detectUniqloCollection('UNIQLO', 'UNIQLO : C セーター'), 'UNIQLO : C')
  assert.equal(detectUniqloCollection('UNIQLO', 'ユニクロC ジャケット'), 'UNIQLO : C')
  assert.equal(detectUniqloCollection('UNIQLO', 'UネックT'), null)
  assert.equal(detectUniqloCollection('UNIQLO', 'UNIQLO UネックT'), null)
  assert.equal(detectUniqloCollection('UNIQLO', 'UVカットパーカ'), null)
  assert.equal(detectUniqloCollection('UNIQLO', '通常のTシャツ'), null)
})
