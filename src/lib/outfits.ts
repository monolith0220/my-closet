import type { ClothingItem } from '../types/clothing'
import { closetGroupFor } from './closet-groups'
import { outfitRoleForGroup, type OutfitItemRole, validateOutfitSelection } from './outfit-selection'
import { supabase } from './supabase'

export interface OutfitPiece {
  item: ClothingItem
  role: OutfitItemRole
  position: number
}

export interface OutfitSet {
  id: string
  title: string
  list_number: number
  created_at: string
  pieces: OutfitPiece[]
  outers: ClothingItem[]
  inners: ClothingItem[]
  tops: ClothingItem[]
  bottom: ClothingItem | null
}

export interface OutfitListReference {
  id: string
  list_number: number
}

interface OutfitRow {
  id: string
  title: string
  list_number: number
  created_at: string
}

interface OutfitItemRow {
  outfit_id: string
  clothing_item_id: string
  role: OutfitItemRole
  position: number
}

function client() {
  if (!supabase) throw new Error('Supabaseが設定されていません。')
  return supabase
}

function roleForItem(item: ClothingItem): OutfitItemRole {
  const role = outfitRoleForGroup(closetGroupFor(item))
  if (!role) throw new Error('コーデにはアウター・トップス・ボトムスを登録できます。')
  return role
}

function buildOutfit(outfit: OutfitRow, links: OutfitItemRow[], clothing: Map<string, ClothingItem>): OutfitSet | null {
  const pieces = links
    .filter(link => link.outfit_id === outfit.id)
    .sort((first, second) => {
      const roleOrder: Record<OutfitItemRole, number> = { outer: 0, inner: 1, bottom: 2 }
      return roleOrder[first.role] - roleOrder[second.role] || first.position - second.position
    })
    .map(link => {
      const item = clothing.get(link.clothing_item_id)
      return item ? { item, role: link.role, position: link.position } : null
    })
    .filter((piece): piece is OutfitPiece => Boolean(piece))

  if (!pieces.length) return null
  const outers = pieces.filter(piece => piece.role === 'outer').map(piece => piece.item)
  const inners = pieces.filter(piece => piece.role === 'inner').map(piece => piece.item)
  return {
    ...outfit,
    pieces,
    outers,
    inners,
    tops: [...outers, ...inners],
    bottom: pieces.find(piece => piece.role === 'bottom')?.item ?? null,
  }
}

export async function listOutfits(userId: string): Promise<OutfitSet[]> {
  const { data: outfitsData, error: outfitsError } = await client()
    .from('outfits')
    .select('id, title, list_number, created_at')
    .eq('user_id', userId)
    .order('list_number', { ascending: true })
  if (outfitsError) throw outfitsError
  const outfits = (outfitsData ?? []) as OutfitRow[]
  if (!outfits.length) return []

  const { data: linksData, error: linksError } = await client()
    .from('outfit_items')
    .select('outfit_id, clothing_item_id, role, position')
    .eq('user_id', userId)
    .in('outfit_id', outfits.map(outfit => outfit.id))
    .in('role', ['outer', 'inner', 'bottom'])
  if (linksError) throw linksError
  const links = (linksData ?? []) as OutfitItemRow[]
  const clothingIds = [...new Set(links.map(link => link.clothing_item_id))]
  if (!clothingIds.length) return []

  // Include inactive items so an older saved outfit can still be shown and removed.
  const { data: clothingData, error: clothingError } = await client()
    .from('clothing_items')
    .select('*')
    .eq('user_id', userId)
    .in('id', clothingIds)
  if (clothingError) throw clothingError
  const clothing = new Map(((clothingData ?? []) as ClothingItem[]).map(item => [item.id, item]))

  return outfits
    .map(outfit => buildOutfit(outfit, links, clothing))
    .filter((outfit): outfit is OutfitSet => Boolean(outfit))
}

async function ownedActiveItem(userId: string, clothingItemId: string): Promise<ClothingItem> {
  const { data, error } = await client()
    .from('clothing_items')
    .select('*')
    .eq('id', clothingItemId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()
  if (error || !data) throw new Error('選択した洋服を確認できません。')
  return data as ClothingItem
}

export async function addClothingToOutfit(
  userId: string,
  outfitId: string,
  clothingItemId: string,
): Promise<void> {
  const [{ data: outfit, error: outfitError }, item] = await Promise.all([
    client().from('outfits').select('id').eq('id', outfitId).eq('user_id', userId).single(),
    ownedActiveItem(userId, clothingItemId),
  ])
  if (outfitError || !outfit) throw new Error('登録先のコーデを確認できません。')

  const role = roleForItem(item)
  const { data: duplicate, error: duplicateError } = await client()
    .from('outfit_items')
    .select('id')
    .eq('outfit_id', outfitId)
    .eq('user_id', userId)
    .eq('clothing_item_id', clothingItemId)
    .maybeSingle()
  if (duplicateError) throw duplicateError
  if (duplicate) throw new Error('このアイテムはすでに選択したコーデに登録されています。')

  const { data: sameRole, error: positionError } = await client()
    .from('outfit_items')
    .select('position')
    .eq('outfit_id', outfitId)
    .eq('user_id', userId)
    .eq('role', role)
    .order('position', { ascending: false })
    .limit(1)
  if (positionError) throw positionError
  if (role === 'bottom' && sameRole?.length) throw new Error('このコーデにはボトムスがすでに登録されています。')
  const position = role === 'bottom' ? 0 : (sameRole?.[0]?.position ?? -1) + 1

  const { error } = await client().from('outfit_items').insert({
    outfit_id: outfitId,
    clothing_item_id: clothingItemId,
    user_id: userId,
    role,
    position,
  })
  if (error) throw error
}

export async function createOutfitWithItem(userId: string, clothingItemId: string): Promise<OutfitListReference> {
  const { data: outfit, error: outfitError } = await client()
    .from('outfits')
    .insert({ user_id: userId, title: 'コーデ' })
    .select('id, list_number')
    .single()
  if (outfitError) throw outfitError

  try {
    await addClothingToOutfit(userId, outfit.id, clothingItemId)
    return outfit as OutfitListReference
  } catch (error) {
    await client().from('outfits').delete().eq('id', outfit.id).eq('user_id', userId)
    throw error
  }
}

export async function createOutfit(
  userId: string,
  title: string,
  topIds: string[],
  bottomId: string,
): Promise<OutfitListReference> {
  const tops = validateOutfitSelection(topIds, bottomId)
  const selectedIds = [...tops, bottomId]

  const { data: selectedData, error: selectedError } = await client()
    .from('clothing_items')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('id', selectedIds)
  if (selectedError) throw selectedError
  if (selectedData?.length !== selectedIds.length) throw new Error('選択した洋服を確認できません。')
  const itemById = new Map((selectedData as ClothingItem[]).map(item => [item.id, item]))
  const topItems = tops.map(id => itemById.get(id)).filter((item): item is ClothingItem => Boolean(item))
  const bottom = itemById.get(bottomId)
  if (!bottom || roleForItem(bottom) !== 'bottom') throw new Error('下に着るものにはボトムスを選んでください。')

  const roleCounts: Record<'outer' | 'inner', number> = { outer: 0, inner: 0 }
  const topLinks = topItems.map(item => {
    const role = roleForItem(item)
    if (role !== 'outer' && role !== 'inner') throw new Error('上に着るものにはアウターまたはトップスを選んでください。')
    const position = roleCounts[role]++
    return { clothingItemId: item.id, role, position }
  })

  const { data: outfit, error: outfitError } = await client()
    .from('outfits')
    .insert({ user_id: userId, title: title.trim() || 'コーデ' })
    .select('id, list_number')
    .single()
  if (outfitError) throw outfitError

  const { error: linksError } = await client()
    .from('outfit_items')
    .insert([
      ...topLinks.map(link => ({
        outfit_id: outfit.id,
        clothing_item_id: link.clothingItemId,
        user_id: userId,
        role: link.role,
        position: link.position,
      })),
      { outfit_id: outfit.id, clothing_item_id: bottomId, user_id: userId, role: 'bottom', position: 0 },
    ])
  if (!linksError) return outfit as OutfitListReference

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
