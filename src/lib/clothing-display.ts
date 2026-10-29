import type { ClothingItem } from '../types/clothing.ts'

export const clothingSortOptions = [
  { value: 'newest', label: '登録が新しい順' },
  { value: 'oldest', label: '登録が古い順' },
  { value: 'purchase_newest', label: '購入日が新しい順' },
  { value: 'purchase_oldest', label: '購入日が古い順' },
  { value: 'name', label: '商品名順' },
  { value: 'brand', label: 'ブランド順' },
  { value: 'favorites_first', label: 'お気に入りを先に表示' },
] as const

export type ClothingSort = (typeof clothingSortOptions)[number]['value']

export function formatClothingSize(size: string | null): string {
  if (!size) return ''
  return size.normalize('NFKC').trim().replace(/^(?:(?:MEN|WOMEN|UNISEX|KIDS|BABY|GIRLS|BOYS)\s+)+/i, '')
}

function isoDate(year: string, month: string, day: string): string | null {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() + 1 !== m || date.getUTCDate() !== d) return null
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

export function normalizePurchaseDate(value: string): string | null {
  const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  return match ? isoDate(match[1]!, match[2]!, match[3]!) : null
}

export function stripPurchaseDateFromMemo(memo: string | null): string {
  if (!memo) return ''
  return memo
    .replace(/購入日\s*[:：]\s*\d{4}[/-]\d{1,2}[/-]\d{1,2}/g, '')
    .replace(/^\s*\/\s*|\s*\/\s*$/g, '')
    .replace(/\s*\/\s*\/\s*/g, ' / ')
    .trim()
}

export function purchaseDateFor(item: ClothingItem): string | null {
  const stored = item.purchased_at?.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (stored) return isoDate(stored[1]!, stored[2]!, stored[3]!)
  const memoDate = item.memo?.match(/購入日\s*[:：]\s*(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  return memoDate ? isoDate(memoDate[1]!, memoDate[2]!, memoDate[3]!) : null
}

export function sortClothing(items: ClothingItem[], order: ClothingSort): ClothingItem[] {
  const newest = (a: ClothingItem, b: ClothingItem) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)
  const purchase = (a: ClothingItem, b: ClothingItem, ascending: boolean) => {
    const first = purchaseDateFor(a)
    const second = purchaseDateFor(b)
    if (!first) return second ? 1 : newest(a, b)
    if (!second) return -1
    return (ascending ? first.localeCompare(second) : second.localeCompare(first)) || newest(a, b)
  }

  return [...items].sort((a, b) => {
    switch (order) {
      case 'oldest': return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
      case 'purchase_newest': return purchase(a, b, false)
      case 'purchase_oldest': return purchase(a, b, true)
      case 'name': return a.name.localeCompare(b.name, 'ja') || newest(a, b)
      case 'brand': return a.brand.localeCompare(b.brand, 'ja') || a.name.localeCompare(b.name, 'ja') || newest(a, b)
      case 'favorites_first': return Number(b.is_favorite) - Number(a.is_favorite) || newest(a, b)
      default: return newest(a, b)
    }
  })
}
