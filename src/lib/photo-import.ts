import type { ClothingItem } from '../types/clothing.ts'

export type PhotoManifestRow = {
  sourceIndex: number
  productCode: string
  originalColor: string
  size: string
  purchasedAt: string
  fileName: string
}

export type PhotoMatchStatus =
  | 'ready'
  | 'missing-file'
  | 'missing-item'
  | 'ambiguous-item'
  | 'already-has-image'
  | 'duplicate-row'

export type PhotoMatch = {
  row: PhotoManifestRow
  status: PhotoMatchStatus
  itemId: string | null
}

const headers = ['商品番号', 'カラー', 'サイズ', '購入日', '画像ファイル名']

export function photoKey(code: string, color: string, size: string, date: string): string {
  return JSON.stringify([code, color, size, date].map(value => value.normalize('NFKC').trim()))
}

export function parsePhotoManifest(input: string): PhotoManifestRow[] {
  const lines = input.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim())
  if (!lines.length) throw new Error('画像の対応表を貼り付けてください。')
  const header = lines.shift()!.split('\t').map(value => value.trim())
  if (header.length !== headers.length || header.some((value, index) => value !== headers[index])) {
    throw new Error(`先頭行を「${headers.join('\t')}」にしてください。`)
  }
  if (!lines.length) throw new Error('画像の対応表に商品がありません。')
  if (lines.length > 500) throw new Error('一度に対応できるのは500件までです。')
  return lines.map((line, index) => {
    const cells = line.split('\t').map(value => value.trim())
    if (cells.length !== headers.length || cells.some(value => !value)) {
      throw new Error(`${index + 2}行目の5項目を確認してください。`)
    }
    return {
      sourceIndex: index + 2,
      productCode: cells[0]!,
      originalColor: cells[1]!,
      size: cells[2]!,
      purchasedAt: cells[3]!,
      fileName: cells[4]!,
    }
  })
}

function originalImportValue(memo: string | null, label: string): string | null {
  return memo?.split(' / ').find(part => part.startsWith(`${label}: `))?.slice(label.length + 2) ?? null
}

export function matchPhotos(
  rows: PhotoManifestRow[],
  items: ClothingItem[],
  fileNames: readonly string[],
): PhotoMatch[] {
  const files = new Set(fileNames)
  const itemByKey = new Map<string, ClothingItem[]>()
  const rowCountByKey = new Map<string, number>()
  for (const item of items) {
    if (item.registration_method !== 'uniqlo_history_import') continue
    const date = originalImportValue(item.memo, '購入日')
    const color = originalImportValue(item.memo, 'ユニクロカラー')
    if (!item.product_code || !date || !color || !item.size) continue
    const key = photoKey(item.product_code, color, item.size, date)
    itemByKey.set(key, [...(itemByKey.get(key) ?? []), item])
  }
  for (const row of rows) {
    const key = photoKey(row.productCode, row.originalColor, row.size, row.purchasedAt)
    rowCountByKey.set(key, (rowCountByKey.get(key) ?? 0) + 1)
  }
  return rows.map(row => {
    const key = photoKey(row.productCode, row.originalColor, row.size, row.purchasedAt)
    const candidates = itemByKey.get(key) ?? []
    const itemId = candidates.length === 1 ? candidates[0]!.id : null
    const status: PhotoMatchStatus =
      (rowCountByKey.get(key) ?? 0) > 1 ? 'duplicate-row' :
      candidates.length > 1 ? 'ambiguous-item' :
      !candidates.length ? 'missing-item' :
      candidates[0]!.image_path ? 'already-has-image' :
      !files.has(row.fileName) ? 'missing-file' : 'ready'
    return { row, status, itemId }
  })
}
