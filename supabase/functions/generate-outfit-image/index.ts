import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  item_ids?: unknown
  regenerate?: unknown
}

interface ClothingReference {
  id: string
  image_path: string | null
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function generationError(status: number, code?: string): string {
  if (status === 401) return 'OpenAI APIキーを確認してください。'
  if (status === 429) return 'AI画像生成の利用上限に達しました。時間を置くか、OpenAIの利用状況を確認してください。'
  if (code === 'moderation_blocked') return 'この組み合わせではAIイメージを生成できませんでした。別のアイテムでお試しください。'
  return 'AIイメージを生成できませんでした。しばらくしてから再度お試しください。'
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'POSTリクエストのみ利用できます。' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const openAiKey = Deno.env.get('OPENAI_API_KEY')
  const authorization = request.headers.get('Authorization')
  if (!supabaseUrl || !anonKey || !authorization) return json({ error: '認証情報を確認できません。' }, 401)
  if (!openAiKey) return json({ error: 'AI画像生成が未設定です。管理者がOPENAI_API_KEYを設定してください。' }, 503)

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return json({ error: 'リクエストの形式が正しくありません。' }, 400)
  }

  const itemIds = Array.isArray(body.item_ids)
    ? [...new Set(body.item_ids.filter((value): value is string => typeof value === 'string' && value.length > 0))]
    : []
  if (itemIds.length < 2 || itemIds.length > 16) {
    return json({ error: 'AIイメージには2〜16着のアイテムを指定してください。' }, 400)
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user
  if (userError || !user) return json({ error: 'ログインを確認できません。' }, 401)

  const { data: clothingData, error: clothingError } = await supabase
    .from('clothing_items')
    .select('id, image_path')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .in('id', itemIds)
  if (clothingError) return json({ error: 'アイテムを確認できませんでした。' }, 500)

  const clothingById = new Map(((clothingData ?? []) as ClothingReference[]).map(item => [item.id, item]))
  const clothing = itemIds.map(id => clothingById.get(id)).filter((item): item is ClothingReference => Boolean(item))
  if (clothing.length !== itemIds.length) return json({ error: '選択したアイテムを確認できません。' }, 400)
  if (clothing.some(item => !item.image_path)) return json({ error: 'AIイメージの生成には、すべてのアイテムに写真が必要です。' }, 400)

  const cacheKey = await sha256(`outfit-flatlay-v1:${itemIds.join(':')}`)
  const fileName = `${cacheKey}.webp`
  const imagePath = `${user.id}/${fileName}`
  const outfitImages = supabase.storage.from('outfit-images')

  if (body.regenerate !== true) {
    const { data: existing } = await outfitImages.list(user.id, { search: fileName, limit: 1 })
    if (existing?.some(file => file.name === fileName)) {
      const { data: signed, error: signedError } = await outfitImages.createSignedUrl(imagePath, 60 * 60)
      if (!signedError && signed?.signedUrl) {
        return json({ image_url: signed.signedUrl, image_path: imagePath, cached: true })
      }
    }
  }

  const form = new FormData()
  form.append('model', 'gpt-image-2.5-flare')
  form.append('prompt', [
    'Create one photorealistic vertical flat-lay outfit image on a clean warm-white studio background.',
    'Use every garment in the reference images exactly once. The images are ordered with upper layers first and the bottom garment last.',
    'Arrange the garments as one coordinated layered outfit set. Preserve each garment’s color, silhouette, material, pattern, and visible design details.',
    'Show garments only: no person, mannequin, hanger, extra clothing, accessories, text, labels, or logos added by the model.',
  ].join(' '))
  form.append('size', '1024x1536')
  form.append('quality', 'medium')
  form.append('output_format', 'webp')
  form.append('output_compression', '82')
  form.append('safety_identifier', (await sha256(`my-closet:${user.id}`)).slice(0, 64))

  for (const [index, item] of clothing.entries()) {
    const { data: image, error: downloadError } = await supabase.storage
      .from('clothing-images')
      .download(item.image_path!)
    if (downloadError || !image) return json({ error: '登録写真を読み込めませんでした。' }, 400)
    const extension = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg'
    form.append('image[]', image, `garment-${index + 1}.${extension}`)
  }

  let openAiResponse: Response
  try {
    openAiResponse = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    })
  } catch (error) {
    console.error('OpenAI image request failed before response', error)
    return json({ error: 'AI画像生成への接続がタイムアウトしました。再度お試しください。' }, 504)
  }

  const requestId = openAiResponse.headers.get('x-request-id')
  const openAiBody = await openAiResponse.json() as {
    data?: Array<{ b64_json?: string }>
    error?: { code?: string; type?: string }
  }
  if (!openAiResponse.ok) {
    console.error('OpenAI image request failed', {
      status: openAiResponse.status,
      requestId,
      code: openAiBody.error?.code,
      type: openAiBody.error?.type,
    })
    return json({ error: generationError(openAiResponse.status, openAiBody.error?.code) }, openAiResponse.status === 401 ? 503 : 502)
  }

  const base64 = openAiBody.data?.[0]?.b64_json
  if (!base64) return json({ error: 'AI画像生成から画像が返されませんでした。' }, 502)
  const imageBytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0))
  const { error: uploadError } = await outfitImages.upload(imagePath, imageBytes, {
    contentType: 'image/webp',
    cacheControl: '3600',
    upsert: true,
  })
  if (uploadError) {
    console.error('Generated image upload failed', uploadError)
    return json({ error: '生成画像を保存できませんでした。' }, 500)
  }

  const { data: signed, error: signedError } = await outfitImages.createSignedUrl(imagePath, 60 * 60)
  if (signedError || !signed?.signedUrl) return json({ error: '生成画像の表示URLを作成できませんでした。' }, 500)
  return json({ image_url: signed.signedUrl, image_path: imagePath, cached: false })
})
