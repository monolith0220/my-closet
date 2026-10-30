import type { ClothingInput, ClothingItem } from '../types/clothing'
import { supabase } from './supabase'

const bucket = 'clothing-images'

function client() {
  if (!supabase) throw new Error('Supabaseが設定されていません。')
  return supabase
}

export async function listClothing(userId: string): Promise<ClothingItem[]> {
  const { data, error } = await client()
    .from('clothing_items')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ClothingItem[]
}

export async function getClothing(id: string, userId: string): Promise<ClothingItem> {
  const { data, error } = await client()
    .from('clothing_items')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()
  if (error) throw error
  return data as ClothingItem
}

export async function createClothing(userId: string, input: ClothingInput): Promise<ClothingItem> {
  const { data, error } = await client()
    .from('clothing_items')
    .insert({ ...input, user_id: userId })
    .select('*')
    .single()
  if (error) throw error
  return data as ClothingItem
}

export async function createClothingBatch(userId: string, inputs: ClothingInput[]): Promise<ClothingItem[]> {
  if (inputs.length === 0) throw new Error('登録する商品がありません。')
  if (inputs.length > 500) throw new Error('一度に登録できるのは500件までです。')
  const { data, error } = await client()
    .from('clothing_items')
    .insert(inputs.map(input => ({ ...input, user_id: userId })))
    .select('*')
  if (error) throw error
  return (data ?? []) as ClothingItem[]
}

export async function updateClothing(
  id: string,
  userId: string,
  input: ClothingInput,
): Promise<ClothingItem> {
  const { data, error } = await client()
    .from('clothing_items')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .select('*')
    .single()
  if (error) throw error
  return data as ClothingItem
}

export async function deleteClothing(id: string, userId: string): Promise<void> {
  const { data, error } = await client()
    .from('clothing_items')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .select('id')
    .single()
  if (error) throw error
  if (!data) throw new Error('洋服が見つかりません。')
}

export async function setClothingFavorite(id: string, userId: string, isFavorite: boolean): Promise<void> {
  const { data, error } = await client()
    .from('clothing_items')
    .update({ is_favorite: isFavorite })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .select('id')
    .single()
  if (error) throw error
  if (!data) throw new Error('洋服が見つかりません。')
}

export async function setClothingRating(id: string, userId: string, rating: number): Promise<void> {
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
    throw new Error('レーティングは0から5の整数で指定してください。')
  }
  const { data, error } = await client()
    .from('clothing_items')
    .update({ rating })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .select('id')
    .single()
  if (error) throw error
  if (!data) throw new Error('洋服が見つかりません。')
}

export async function setClothingCategory(
  id: string,
  userId: string,
  categoryGroup: string,
  subcategory: string,
): Promise<void> {
  const { data, error } = await client()
    .from('clothing_items')
    .update({ category_group: categoryGroup, subcategory })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .select('id')
    .single()
  if (error) throw error
  if (!data) throw new Error('洋服が見つかりません。')
}

export async function recordClothingView(id: string): Promise<number> {
  const { data, error } = await client().rpc('increment_clothing_view_count', { p_item_id: id })
  if (error) throw error
  if (typeof data !== 'number') throw new Error('洋服が見つかりません。')
  return data
}

export async function uploadClothingImage(userId: string, file: File): Promise<string> {
  const supported = ['image/jpeg', 'image/png', 'image/webp']
  if (!supported.includes(file.type)) throw new Error('JPEG、PNG、WebP形式の写真を選択してください。')
  if (file.size > 10 * 1024 * 1024) throw new Error('写真は10MB以下にしてください。')

  const extension =
    ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[file.type] ?? 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await client().storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error
  return path
}

export async function removeClothingImage(path: string): Promise<void> {
  const { error } = await client().storage.from(bucket).remove([path])
  if (error) throw error
}

export async function updateClothingImage(id: string, userId: string, path: string): Promise<void> {
  const { data, error } = await client()
    .from('clothing_items')
    .update({ image_path: path })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('image_path', null)
    .select('id')
    .single()
  if (error) throw error
  if (!data) throw new Error('洋服が見つからないか、すでに写真があります。')
}

export async function signedClothingImage(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data, error } = await client().storage.from(bucket).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function signedClothingImages(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {}
  const { data, error } = await client().storage.from(bucket).createSignedUrls(paths, 60 * 60)
  if (error) throw error
  const urls: Record<string, string> = {}
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) urls[entry.path] = entry.signedUrl
  }
  return urls
}
