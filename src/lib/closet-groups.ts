import type { ClothingItem } from '../types/clothing.ts'

export const closetGroups = ['アウター', 'トップス', 'ボトムス', 'レッグウェア', 'アクセサリー', 'その他'] as const
export type ClosetGroup = (typeof closetGroups)[number]

type ItemForGrouping = Pick<ClothingItem, 'name' | 'category'> & Partial<Pick<ClothingItem, 'category_group'>>

export function closetGroupFor(item: ItemForGrouping): ClosetGroup {
  if (closetGroups.includes(item.category_group as ClosetGroup)) return item.category_group as ClosetGroup
  const name = item.name.normalize('NFKC')
  if (/靴下|ソックス|タイツ|ストッキング|レギンス|レッグウォーマー|フットカバー|socks?|tights?|leggings?/i.test(name)) {
    return 'レッグウェア'
  }
  if (item.category === 'アウター' && /ボタンダウン/.test(name) && /シャツ/.test(name) && !/ジャケット|コート|ブルゾン/.test(name)) {
    return 'トップス'
  }
  switch (item.category) {
    case 'アウター':
    case 'トップス':
    case 'ボトムス':
    case 'レッグウェア':
    case 'アクセサリー':
      return item.category
    case '小物':
    case 'バッグ':
    case 'シューズ':
      return 'アクセサリー'
    default:
      return /帽子|キャップ|ベルト|マフラー|手袋|ネクタイ|サングラス|ストール|アンブレラ|傘|マスク|バッグ|リュック|シューズ|スニーカー|サンダル/i.test(name)
        ? 'アクセサリー'
        : 'その他'
  }
}
