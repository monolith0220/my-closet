import type { ClothingItem } from '../types/clothing.ts'

export type SleeveLength = '半袖' | '長袖'

// Only classify a sleeve length when the product name states it clearly.
export function sleeveLengthFor(item: Pick<ClothingItem, 'name'>): SleeveLength | null {
  const name = item.name.normalize('NFKC').toLowerCase()
  const shortSleeve = /半[袖そで]|[35]分袖|ショートスリーブ|short[ -]?sleeve/.test(name)
  const longSleeve = /長[袖そで]|(?:9|10)分袖|ロングスリーブ|long[ -]?sleeve/.test(name)
  if (shortSleeve === longSleeve) return null
  return shortSleeve ? '半袖' : '長袖'
}
