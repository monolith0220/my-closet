import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseImportTable } from '../src/lib/import-table.ts'

test('日本語CSVの引用符、改行、色、カテゴリを読み取る', () => {
  const csv = '\uFEFF商品名,カテゴリ,カラー,サイズ,商品番号,商品URL,購入日\r\n' +
    '"エアリズム""コットン"",Tシャツ",,"09 BLACK",M,478339,"https://www.uniqlo.com/jp/ja/products/E478339-000/00",2026/10/29\r\n' +
    '"行をまたぐ\n商品名",ボトムス,62 BLUE,L,,,\r\n'
  const rows = parseImportTable(csv)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    name: 'エアリズム"コットン",Tシャツ',
    category: 'トップス',
    color: 'ブラック',
    originalColor: '09 BLACK',
    size: 'M',
    productCode: '478339',
    productUrl: 'https://www.uniqlo.com/jp/ja/products/E478339-000/00',
    purchasedAt: '2026/10/29',
  })
  assert.equal(rows[1].name, '行をまたぐ\n商品名')
  assert.equal(rows[1].category, 'ボトムス')
  assert.equal(rows[1].color, 'ブルー')
  assert.equal(rows[1].originalColor, '62 BLUE')
})

test('英語ヘッダーのTSVと元の色名の保持', () => {
  const tsv = 'Name\tCategory\tColor\tSize\tProduct Code\tProduct URL\tPurchased At\r\n' +
    '感動ジャケット\t\tNAVY\tL\t123456\t\t2026-10-28\r\n' +
    '謎の商品\t\t30 NATURAL\t\t\t\t\r\n' +
    'オリーブシャツ\t\t57 OLIVE\tM\t\t\t\r\n' +
    '不明な色の服\t\tMYSTERY\t\t\t\t\r\n'
  const rows = parseImportTable(tsv)
  assert.equal(rows[0].category, 'アウター')
  assert.equal(rows[0].color, 'ネイビー')
  assert.equal(rows[0].purchasedAt, '2026-10-28')
  assert.equal(rows[1].category, 'その他')
  assert.equal(rows[1].color, 'ベージュ')
  assert.equal(rows[1].originalColor, '30 NATURAL')
  assert.equal(rows[2].color, 'グリーン')
  assert.equal(rows[2].originalColor, '57 OLIVE')
  assert.equal(rows[3].color, 'その他')
  assert.equal(rows[3].originalColor, 'MYSTERY')
})

test('商品名列とデータ行は必須', () => {
  assert.throws(() => parseImportTable('商品番号,カラー\n123456,黒'), /商品名.*必要/)
  assert.throws(() => parseImportTable('商品名,カラー\n'), /登録する商品がありません/)
  assert.throws(() => parseImportTable('商品名,カラー\n,黒'), /商品名が空/)
})

test('壊れた引用符、URL、列数を拒否する', () => {
  assert.throws(() => parseImportTable('商品名,カラー\n"閉じない,黒'), /引用符が閉じられていません/)
  assert.throws(() => parseImportTable('商品名,商品URL\nシャツ,javascript:alert(1)'), /商品URLは http/)
  assert.throws(() => parseImportTable('商品名,カラー\nシャツ,黒,余分'), /列数/)
})

test('一度に500件まで許可する', () => {
  const header = '商品名,カラー\n'
  assert.equal(parseImportTable(header + 'シャツ,黒\n'.repeat(500)).length, 500)
  assert.throws(() => parseImportTable(header + 'シャツ,黒\n'.repeat(501)), /500件まで/)
})

test('ユニクロの実際の商品名と色を分類する', () => {
  const rows = parseImportTable(
    '商品名,カラー\n' +
    'エアリズムVネックT,71 PURPLE\n' +
    'メリノVネックカーディガン,26 ORANGE\n' +
    'スフレヤーンロングプルパーカ,19 WINE\n' +
    'ライトウェイトパーカ,09 BLACK\n' +
    'サンリオキャラクターズ リラコ,01 OFF WHITE\n' +
    'ヒートテックタイツ,03 GRAY\n' +
    'ワイヤレスブラ,10 PINK\n' +
    'スポーツサングラス,09 BLACK\n' +
    'マンガUT 集英社創業100周年,00 WHITE\n' +
    'ライトウォームパデッド2WAYブランケット,08 DARK GRAY\n',
  )
  assert.deepEqual(rows.map(row => row.category), [
    'トップス', 'トップス', 'トップス', 'アウター', 'ボトムス',
    'ボトムス', 'トップス', '小物', 'トップス', 'その他',
  ])
  assert.deepEqual(rows.slice(0, 3).map(row => row.color), ['パープル', 'オレンジ', 'ワイン'])
})

test('ボタンダウンシャツをアウターと誤分類しない', () => {
  const rows = parseImportTable('商品名,カラー\nスーパーノンアイロンシャツ/ボタンダウン,09 BLACK\n')
  assert.equal(rows[0].category, 'トップス')
})
