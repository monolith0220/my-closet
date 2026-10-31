import type { ClothingItem, Season } from '../types/clothing.ts'
import { closetGroupFor } from './closet-groups.ts'

type SuggestionItem = Pick<ClothingItem, 'id' | 'name' | 'category' | 'created_at' | 'is_active' | 'seasons'> & {
  view_count?: number
}

export interface LowViewOutfit<T extends SuggestionItem = ClothingItem> {
  top: T
  bottom: T
}

export function outfitPairKey(topId: string, bottomId: string): string {
  return topId + ':' + bottomId
}

export function seasonForDate(date = new Date()): Season {
  const month = date.getMonth() + 1
  if (month >= 3 && month <= 5) return '春'
  if (month >= 6 && month <= 8) return '夏'
  if (month >= 9 && month <= 11) return '秋'
  return '冬'
}

export function itemMatchesSeason(item: Pick<SuggestionItem, 'seasons'>, season: Season): boolean {
  return !item.seasons.length || item.seasons.includes(season)
}

function compareItems<T extends SuggestionItem>(first: T, second: T): number {
  const firstViews = Number.isFinite(first.view_count) ? Math.max(0, first.view_count ?? 0) : 0
  const secondViews = Number.isFinite(second.view_count) ? Math.max(0, second.view_count ?? 0) : 0
  return firstViews - secondViews ||
    first.created_at.localeCompare(second.created_at) ||
    first.id.localeCompare(second.id)
}

// Each suggestion uses a different upper and lower item to keep the first set varied.
export function suggestLowViewOutfits<T extends SuggestionItem>(
  items: T[],
  excludedPairs: ReadonlySet<string> = new Set<string>(),
  limit = 3,
  season: Season = seasonForDate(),
): LowViewOutfit<T>[] {
  if (limit <= 0) return []
  const tops = items.filter(item => item.is_active && itemMatchesSeason(item, season) && ['トップス', 'アウター'].includes(closetGroupFor(item)))
    .sort(compareItems)
  const bottoms = items.filter(item => item.is_active && itemMatchesSeason(item, season) && closetGroupFor(item) === 'ボトムス')
    .sort(compareItems)
  const usedBottoms = new Set<string>()
  const suggestions: LowViewOutfit<T>[] = []

  for (const top of tops) {
    const bottom = bottoms.find(item =>
      !usedBottoms.has(item.id) && !excludedPairs.has(outfitPairKey(top.id, item.id)),
    )
    if (!bottom) continue
    suggestions.push({ top, bottom })
    usedBottoms.add(bottom.id)
    if (suggestions.length === limit) break
  }
  return suggestions
}
