import type { ClothingItem } from '../types/clothing.ts'
import { closetGroupFor, closetGroups, type ClosetGroup } from './closet-groups.ts'
import { closetSubcategoryFor } from './closet-subcategories.ts'
import { sleeveLengthFor, type SleeveLength } from './sleeve-length.ts'
import { uniqloCollections, type UniqloCollection } from './uniqlo-collection.ts'

export type SleeveFilter = SleeveLength | 'すべて' | '不明'

export interface ClothingSearchCriteria {
  q: string
  category: ClosetGroup | ''
  subcategory: string
  sleeve: SleeveFilter
  brand: string
  collection: UniqloCollection | ''
  color: string
  favorites: boolean
}

export function filterClothingItems(items: ClothingItem[], criteria: ClothingSearchCriteria): ClothingItem[] {
  const term = criteria.q.trim().normalize('NFKC').toLocaleLowerCase()
  return items.filter(item => {
    const group = closetGroupFor(item)
    const small = closetSubcategoryFor(item, group)
    const text = [item.name, item.brand, item.category, group, small, item.color, item.size ?? '', item.product_code ?? '']
      .join(' ').normalize('NFKC').toLocaleLowerCase()
    return (!term || text.includes(term)) &&
      (!criteria.category || group === criteria.category) &&
      (!criteria.subcategory || small === criteria.subcategory) &&
      (criteria.category !== 'トップス' || criteria.sleeve === 'すべて' || (sleeveLengthFor(item) ?? '不明') === criteria.sleeve) &&
      (!criteria.brand || item.brand === criteria.brand) &&
      (!criteria.collection || item.collection === criteria.collection) &&
      (!criteria.color || item.color === criteria.color) &&
      (!criteria.favorites || item.is_favorite)
  })
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function criteriaFromQuery(query: Record<string, unknown>): ClothingSearchCriteria {
  const category = stringValue(query.category)
  const sleeve = stringValue(query.sleeve)
  const collection = stringValue(query.collection)
  return {
    q: stringValue(query.q),
    category: closetGroups.includes(category as ClosetGroup) ? category as ClosetGroup : '',
    subcategory: stringValue(query.subcategory),
    sleeve: sleeve === '半袖' || sleeve === '長袖' || sleeve === '不明' ? sleeve : 'すべて',
    brand: stringValue(query.brand),
    collection: uniqloCollections.includes(collection as UniqloCollection) ? collection as UniqloCollection : '',
    color: stringValue(query.color),
    favorites: query.favorites === '1',
  }
}
