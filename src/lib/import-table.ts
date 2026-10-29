import { categories, colors } from '../types/clothing.ts'

export type ImportRow = {
  name: string
  category: string
  color: string
  originalColor: string
  size: string
  productCode: string
  productUrl: string
  purchasedAt: string
}

type Column = Exclude<keyof ImportRow, 'originalColor'>

const columnAliases: Record<Column, string[]> = {
  name: ['商品名', '品名', 'name', 'productname', 'itemname'],
  category: ['カテゴリ', 'カテゴリー', 'category'],
  color: ['カラー', '色', 'color', 'colour'],
  size: ['サイズ', 'size'],
  productCode: ['商品番号', '品番', 'productcode', 'itemcode', 'sku'],
  productUrl: ['商品URL', 'URL', 'producturl', 'link'],
  purchasedAt: ['購入日', '購入日時', 'purchasedat', 'purchasedate', 'orderdate'],
}

function normalizeHeader(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/[\s_\-/]/g, '')
}

function detectDelimiter(text: string): ',' | '\t' {
  let quoted = false
  let commas = 0
  let tabs = 0
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i]
    if (character === '"') {
      if (quoted && text[i + 1] === '"') i += 1
      else quoted = !quoted
    } else if (!quoted) {
      if (character === '\n' || character === '\r') break
      if (character === ',') commas += 1
      if (character === '\t') tabs += 1
    }
  }
  if (commas === 0 && tabs === 0) throw new Error('CSVまたはTSVのヘッダー行を入力してください。')
  return tabs > commas ? '\t' : ','
}

function parseDelimited(text: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let afterQuote = false

  function finishCell() {
    row.push(cell)
    cell = ''
    afterQuote = false
  }

  function finishRow() {
    finishCell()
    if (row.some(value => value.trim())) rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i += 1) {
    const character = text[i]
    if (quoted) {
      if (character === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (character === '"') {
        quoted = false
        afterQuote = true
      } else {
        cell += character
      }
    } else if (character === delimiter) {
      finishCell()
    } else if (character === '\n' || character === '\r') {
      finishRow()
      if (character === '\r' && text[i + 1] === '\n') i += 1
    } else if (afterQuote) {
      if (character !== ' ' && character !== '\t') {
        throw new Error('引用符の後に不要な文字があります。CSV/TSVの形式を確認してください。')
      }
    } else if (character === '"') {
      if (cell.trim()) throw new Error('引用符の位置が正しくありません。CSV/TSVの形式を確認してください。')
      cell = ''
      quoted = true
    } else {
      cell += character
    }
  }

  if (quoted) throw new Error('引用符が閉じられていません。CSV/TSVの形式を確認してください。')
  if (row.length || cell || afterQuote) finishRow()
  return rows
}

function normalizeCategory(value: string, name: string): string {
  const candidate = value.normalize('NFKC').trim()
  if (categories.some(category => category === candidate)) return candidate
  const key = candidate.toLowerCase()
  const aliases: Record<string, string> = {
    tops: 'トップス', top: 'トップス',
    bottoms: 'ボトムス', bottom: 'ボトムス', pants: 'ボトムス',
    outerwear: 'アウター', outer: 'アウター',
    dresses: 'ワンピース', dress: 'ワンピース',
    shoes: 'シューズ', shoe: 'シューズ',
    bags: 'バッグ', bag: 'バッグ',
    accessories: '小物', accessory: '小物',
    other: 'その他',
  }
  if (aliases[key]) return aliases[key]

  const text = `${candidate} ${name}`.normalize('NFKC').toLowerCase()
  if (/シューズ|スニーカー|サンダル|ブーツ|靴|shoes?|sneakers?|sandals?|boots?/.test(text)) return 'シューズ'
  if (/バッグ|バックパック|リュック|bags?|backpacks?/.test(text)) return 'バッグ'
  if (/帽子|キャップ|ベルト|靴下|ソックス|マフラー|手袋|ネクタイ|サングラス|ストール|アンブレラ|傘|マスク|scarves?|socks?|caps?/.test(text)) return '小物'
  if (/プルパーカ/.test(text)) return 'トップス'
  if (/ワンピース|ドレス|dresses?/.test(text)) return 'ワンピース'
  if (/パンツ|ジーンズ|デニム|スカート|レギンス|ショーツ|リラコ|ステテコ|チノ|タイツ|ボクサーブリーフ|pants?|jeans?|skirts?|leggings?/.test(text)) return 'ボトムス'
  if (/ジャケット|コート|ブルゾン|ダウン|パーカ|jacket|coat|blouson/.test(text)) return 'アウター'
  if (/シャツ|ブラウス|セーター|ニット|スウェット|ポロ|タンクトップ|インナー|カーディガン|ブラ(?!ンケット)|キャミソール|ボディスーツ|(?:^|[^a-z])(?:ut|t)(?:$|[^a-z])|shirt|sweater|knit|blouse|hoodie/.test(text)) return 'トップス'
  return 'その他'
}

function normalizeColor(value: string): string {
  const candidate = value.normalize('NFKC').trim()
  if (colors.some(color => color === candidate)) return candidate
  const key = candidate.replace(/^\d{2}\s*/, '').replace(/[\s_-]+/g, '').toLowerCase()
  const patterns: Array<[RegExp, string]> = [
    [/ブラック|black|^blk$/, 'ブラック'],
    [/ホワイト|白|white/, 'ホワイト'],
    [/グレー|灰|gr[ae]y|charcoal/, 'グレー'],
    [/ベージュ|beige|ナチュラル|natural/, 'ベージュ'],
    [/ブラウン|茶|brown/, 'ブラウン'],
    [/ネイビー|navy/, 'ネイビー'],
    [/ブルー|青|blue/, 'ブルー'],
    [/グリーン|緑|green|オリーブ|olive/, 'グリーン'],
    [/レッド|赤|red/, 'レッド'],
    [/ピンク|pink/, 'ピンク'],
    [/イエロー|黄|yellow/, 'イエロー'],
    [/オレンジ|orange/, 'オレンジ'],
    [/パープル|紫|purple/, 'パープル'],
    [/ワイン|wine/, 'ワイン'],
  ]
  for (const [pattern, color] of patterns) {
    if (pattern.test(key)) return color
  }
  return 'その他'
}

function columnIndices(header: string[]): Partial<Record<Column, number>> {
  const indices: Partial<Record<Column, number>> = {}
  for (let index = 0; index < header.length; index += 1) {
    const normalized = normalizeHeader(header[index] ?? '')
    const column = (Object.keys(columnAliases) as Column[]).find(key =>
      columnAliases[key].some(alias => normalizeHeader(alias) === normalized),
    )
    if (!column) continue
    if (indices[column] !== undefined) throw new Error(`「${header[index]}」の列が重複しています。`)
    indices[column] = index
  }
  if (indices.name === undefined) throw new Error('ヘッダーに「商品名」列が必要です。')
  return indices
}

export function parseImportTable(input: string): ImportRow[] {
  const text = input.replace(/^\uFEFF/, '')
  if (!text.trim()) throw new Error('購入履歴のCSVまたはTSVを入力してください。')
  if (text.length > 2_000_000) throw new Error('ファイルが大きすぎます。500件以下に分けて取り込んでください。')
  const rows = parseDelimited(text, detectDelimiter(text))
  const [header, ...dataRows] = rows
  if (!header) throw new Error('ヘッダー行が見つかりません。')
  const indices = columnIndices(header)
  if (!dataRows.length) throw new Error('登録する商品がありません。')
  if (dataRows.length > 500) throw new Error('一度に取り込めるのは500件までです。')

  return dataRows.map((values, index) => {
    if (values.length > header.length) throw new Error(`${index + 1}件目の列数がヘッダーより多いです。`)
    const field = (column: Column) => values[indices[column] ?? -1]?.trim() ?? ''
    const name = field('name')
    if (!name) throw new Error(`${index + 1}件目の商品名が空です。`)
    if (name.length > 120) throw new Error(`${index + 1}件目の商品名は120文字以内にしてください。`)
    const size = field('size')
    if (size.length > 30) throw new Error(`${index + 1}件目のサイズは30文字以内にしてください。`)
    const productCode = field('productCode')
    if (productCode.length > 100) throw new Error(`${index + 1}件目の商品番号は100文字以内にしてください。`)
    const productUrl = field('productUrl')
    if (productUrl) {
      try {
        const url = new URL(productUrl)
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('invalid URL')
      } catch {
        throw new Error(`${index + 1}件目の商品URLは http:// または https:// から始めてください。`)
      }
    }
    const originalColor = field('color')
    return {
      name,
      category: normalizeCategory(field('category'), name),
      color: normalizeColor(originalColor),
      originalColor,
      size,
      productCode,
      productUrl,
      purchasedAt: field('purchasedAt'),
    }
  })
}
