export function uniqueTopIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map(id => id.trim()).filter(Boolean))]
}

export function validateOutfitSelection(topIds: readonly string[], bottomId: string): string[] {
  const tops = uniqueTopIds(topIds)
  const bottom = bottomId.trim()
  if (!tops.length || !bottom) throw new Error('上に着るものと下に着るものを選んでください。')
  if (tops.includes(bottom)) throw new Error('上と下には異なるアイテムを選んでください。')
  return tops
}
