import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchPhotos, parsePhotoManifest } from '../src/lib/photo-import.ts'

const header = '商品番号\tカラー\tサイズ\t購入日\t画像ファイル名\n'

function item(id, date, color = '09 BLACK', imagePath = null) {
  return {
    id,
    product_code: '486082',
    size: 'MEN L',
    memo: `購入日: ${date} / ユニクロカラー: ${color}`,
    registration_method: 'uniqlo_history_import',
    image_path: imagePath,
  }
}

test('購入日と元カラーで同一商品の別購入を区別する', () => {
  const rows = parsePhotoManifest(header +
    '486082\t09 BLACK\tMEN L\t2026/10/26\tfirst.jpg\n' +
    '486082\t09 BLACK\tMEN L\t2025/10/26\tsecond.jpg\n')
  const matches = matchPhotos(rows, [item('new', '2026/10/26'), item('old', '2025/10/26')], ['first.jpg', 'second.jpg'])
  assert.deepEqual(matches.map(match => [match.status, match.itemId]), [['ready', 'new'], ['ready', 'old']])
})

test('対応する画像や商品がない場合、既存写真がある場合は更新しない', () => {
  const rows = parsePhotoManifest(header +
    '486082\t09 BLACK\tMEN L\t2026/10/26\tmissing.jpg\n' +
    '486082\t57 OLIVE\tMEN L\t2026/10/26\tolive.jpg\n' +
    '486082\t09 BLACK\tMEN L\t2025/10/26\told.jpg\n')
  const matches = matchPhotos(rows, [item('new', '2026/10/26'), item('old', '2025/10/26', '09 BLACK', 'saved.jpg')], ['olive.jpg', 'old.jpg'])
  assert.deepEqual(matches.map(match => match.status), ['missing-file', 'missing-item', 'already-has-image'])
})

test('同じ購入行や照合先の重複を推測して紐付けない', () => {
  const rows = parsePhotoManifest(header +
    '486082\t09 BLACK\tMEN L\t2026/10/26\tfirst.jpg\n' +
    '486082\t09 BLACK\tMEN L\t2026/10/26\tsecond.jpg\n' +
    '486082\t09 BLACK\tMEN L\t2025/10/26\told.jpg\n')
  const matches = matchPhotos(rows, [item('one', '2026/10/26'), item('old-one', '2025/10/26'), item('old-two', '2025/10/26')], ['first.jpg', 'second.jpg', 'old.jpg'])
  assert.deepEqual(matches.map(match => match.status), ['duplicate-row', 'duplicate-row', 'ambiguous-item'])
})

test('表の見出し、必須項目、件数を検証する', () => {
  assert.throws(() => parsePhotoManifest('商品名\tカラー\n服\t黒'), /先頭行/)
  assert.throws(() => parsePhotoManifest(header + '486082\t09 BLACK\tMEN L\t2026/10/26\t\n'), /5項目/)
  assert.throws(() => parsePhotoManifest(header + '486082\t09 BLACK\tMEN L\t2026/10/26\ta.jpg\n'.repeat(501)), /500件まで/)
})
