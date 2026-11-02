import { supabase } from './supabase'

interface GeneratedOutfitImageResponse {
  image_url: string
  image_path: string
  cached: boolean
}

export async function generateOutfitImage(itemIds: string[], regenerate = false): Promise<GeneratedOutfitImageResponse> {
  if (!supabase) throw new Error('Supabaseが設定されていません。')
  const { data, error } = await supabase.functions.invoke<GeneratedOutfitImageResponse>('generate-outfit-image', {
    body: { item_ids: itemIds, regenerate },
  })
  if (error) {
    const context = 'context' in error ? error.context as Response | undefined : undefined
    if (context) {
      try {
        const body = await context.clone().json() as { error?: string }
        if (body.error) throw new Error(body.error)
      } catch (contextError) {
        if (contextError instanceof Error && contextError.message !== 'Unexpected end of JSON input') throw contextError
      }
    }
    throw new Error(error.message || 'AIイメージを生成できませんでした。')
  }
  if (!data?.image_url) throw new Error('AIイメージを取得できませんでした。')
  return data
}
