export const categories = [
  'トップス',
  'ボトムス',
  'アウター',
  'ワンピース',
  'シューズ',
  'バッグ',
  '小物',
  'その他',
] as const

export const colors = [
  'ブラック',
  'ホワイト',
  'グレー',
  'ベージュ',
  'ブラウン',
  'ネイビー',
  'ブルー',
  'グリーン',
  'レッド',
  'ピンク',
  'イエロー',
  'オレンジ',
  'パープル',
  'ワイン',
  'その他',
] as const

export const seasons = ['春', '夏', '秋', '冬'] as const
export type Season = (typeof seasons)[number]

export interface ClothingItem {
  id: string
  user_id: string
  name: string
  brand: string
  category: string
  color: string
  size: string | null
  seasons: string[]
  style_tags: string[]
  product_code: string | null
  product_url: string | null
  image_path: string | null
  registration_method: string
  memo: string | null
  is_active: boolean
  created_at: string
}

export interface ClothingInput {
  name: string
  brand: string
  category: string
  color: string
  size: string | null
  seasons: string[]
  style_tags: string[]
  product_code: string | null
  product_url: string | null
  image_path: string | null
  registration_method: 'manual' | 'uniqlo_history_import'
  memo: string | null
}
