import type { ClothingItem } from '../types/clothing'
import { supabase } from './supabase'

export interface OutfitPair {
  id: string
  title: string
  created_at: string
  top: ClothingItem
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
}

function client() {
  if (!supabase) throw new Error('Supabaseが設定されていません。')
  return supabase
}

export async function listOutfitPairs(userId: string): Promise<OutfitPair[]> {
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
    .select('outfit_id, clothing_item_id, role')
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
    const top = clothing.get(pairLinks.find(link => link.role === 'top')?.clothing_item_id ?? '')
    const bottom = clothing.get(pairLinks.find(link => link.role === 'bottom')?.clothing_item_id ?? '')
    return top && bottom ? [{ ...outfit, top, bottom }] : []
  })
}

export async function createOutfitPair(
  userId: string,
  title: string,
  topId: string,
  bottomId: string,
): Promise<void> {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) throw new Error('コーデ名を入力してください。')
  if (!topId || !bottomId || topId === bottomId) throw new Error('異なるトップスとボトムスを選んでください。')

  const { data: selectedData, error: selectedError } = await client()
    .from('clothing_items')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('id', [topId, bottomId])
  if (selectedError) throw selectedError
  if (selectedData?.length !== 2) throw new Error('選択した洋服を確認できません。')

  const { data: outfit, error: outfitError } = await client()
    .from('outfits')
    .insert({ user_id: userId, title: trimmedTitle })
    .select('id')
    .single()
  if (outfitError) throw outfitError

  const { error: linksError } = await client()
    .from('outfit_items')
    .insert([
      { outfit_id: outfit.id, clothing_item_id: topId, user_id: userId, role: 'top' },
      { outfit_id: outfit.id, clothing_item_id: bottomId, user_id: userId, role: 'bottom' },
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

export async function deleteOutfitPair(id: string, userId: string): Promise<void> {
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
