export function uniqueTopIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map(id => id.trim()).filter(Boolean))]
}

export type OutfitItemRole = 'outer' | 'inner' | 'bottom'

export function outfitRoleForGroup(group: string): OutfitItemRole | null {
  if (group === 'アウター') return 'outer'
  if (group === 'トップス') return 'inner'
  if (group === 'ボトムス') return 'bottom'
  return null
}

export function outfitRoleLabel(role: OutfitItemRole, position: number): string {
  const number = position + 1
  if (role === 'outer') return `アウター${number}`
  if (role === 'inner') return `インナー${number}`
  return `ボトムス1`
}

export function validateOutfitSelection(topIds: readonly string[], bottomId: string): string[] {
  const tops = uniqueTopIds(topIds)
  const bottom = bottomId.trim()
  if (!tops.length || !bottom) throw new Error('上に着るものと下に着るものを選んでください。')
  if (tops.includes(bottom)) throw new Error('上と下には異なるアイテムを選んでください。')
  return tops
}
