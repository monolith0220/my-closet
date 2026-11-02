import type { ClothingItem } from '../types/clothing'
import { validateOutfitSelection } from './outfit-selection'
import { supabase } from './supabase'

export interface OutfitSet {
  id: string
  title: string
  created_at: string
  tops: ClothingItem[]
  bottom: ClothingItem
}

interface OutfitRow {
  id: string
  title: string
  created_at: string
}

interface OutfitItemRow {
  outfit_id: string
  clothing_item_id: string
  role: string
  position: number
}

function client() {
  if (!supabase) throw new Error('Supabaseが設定されていません。')
  return supabase
}

export async function listOutfits(userId: string): Promise<OutfitSet[]> {
  const { data: outfitsData, error: outfitsError } = await client()
    .from('outfits')
    .select('id, title, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (outfitsError) throw outfitsError
  const outfits = (outfitsData ?? []) as OutfitRow[]
  if (!outfits.length) return []

  const { data: linksData, error: linksError } = await client()
    .from('outfit_items')
    .select('outfit_id, clothing_item_id, role, position')
    .eq('user_id', userId)
    .in('outfit_id', outfits.map(outfit => outfit.id))
    .in('role', ['top', 'bottom'])
  if (linksError) throw linksError
  const links = (linksData ?? []) as OutfitItemRow[]
  const clothingIds = [...new Set(links.map(link => link.clothing_item_id))]
  if (!clothingIds.length) return []

  // Include inactive items so an older saved pair can still be shown and removed.
  const { data: clothingData, error: clothingError } = await client()
    .from('clothing_items')
    .select('*')
    .eq('user_id', userId)
    .in('id', clothingIds)
  if (clothingError) throw clothingError
  const clothing = new Map(((clothingData ?? []) as ClothingItem[]).map(item => [item.id, item]))

  return outfits.flatMap(outfit => {
    const pairLinks = links.filter(link => link.outfit_id === outfit.id)
    const tops = pairLinks
      .filter(link => link.role === 'top')
      .sort((first, second) => first.position - second.position)
      .map(link => clothing.get(link.clothing_item_id))
      .filter((item): item is ClothingItem => Boolean(item))
    const bottom = clothing.get(pairLinks.find(link => link.role === 'bottom')?.clothing_item_id ?? '')
    return tops.length && bottom ? [{ ...outfit, tops, bottom }] : []
  })
}

export async function createOutfit(
  userId: string,
  title: string,
  topIds: string[],
  bottomId: string,
): Promise<void> {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) throw new Error('コーデ名を入力してください。')
  const tops = validateOutfitSelection(topIds, bottomId)
  const selectedIds = [...tops, bottomId]

  const { data: selectedData, error: selectedError } = await client()
    .from('clothing_items')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('id', selectedIds)
  if (selectedError) throw selectedError
  if (selectedData?.length !== selectedIds.length) throw new Error('選択した洋服を確認できません。')

  const { data: outfit, error: outfitError } = await client()
    .from('outfits')
    .insert({ user_id: userId, title: trimmedTitle })
    .select('id')
    .single()
  if (outfitError) throw outfitError

  const { error: linksError } = await client()
    .from('outfit_items')
    .insert([
      ...tops.map((clothingItemId, position) => ({
        outfit_id: outfit.id,
        clothing_item_id: clothingItemId,
        user_id: userId,
        role: 'top',
        position,
      })),
      { outfit_id: outfit.id, clothing_item_id: bottomId, user_id: userId, role: 'bottom', position: 0 },
    ])
  if (!linksError) return

  const { error: cleanupError } = await client()
    .from('outfits')
    .delete()
    .eq('id', outfit.id)
    .eq('user_id', userId)
  if (cleanupError) throw new Error('コーデの保存に失敗し、作成途中のデータが残った可能性があります。再読み込みしてください。')
  throw linksError
}

export async function deleteOutfit(id: string, userId: string): Promise<void> {
  const { data, error } = await client()
    .from('outfits')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .single()
  if (error) throw error
  if (!data) throw new Error('コーデが見つかりません。')
}
