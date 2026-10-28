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

export async function signedClothingImage(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data, error } = await client().storage.from(bucket).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}
