import type { ClothingItem } from '../types/clothing.ts'
import { closetGroupFor, type ClosetGroup } from './closet-groups.ts'

export const closetSubcategories = {
  アウター: ['ブルゾン', 'ジャケット', 'ダウン', 'コート', 'パーカ', 'その他'],
  トップス: ['Tシャツ', 'シャツ・ブラウス', 'ニット', 'スウェット', 'カーディガン', 'インナー', 'その他'],
  ボトムス: ['パンツ', 'デニム', 'ショートパンツ', 'スカート', 'インナー', 'ルームウェア', 'その他'],
  レッグウェア: ['ソックス', 'タイツ', 'レギンス', 'レッグウォーマー', 'その他'],
  アクセサリー: ['バッグ', 'シューズ', '帽子', 'ベルト', 'ファッション小物', 'その他'],
  その他: ['ワンピース', 'ルームウェア', '雑貨', 'その他'],
} as const satisfies Record<ClosetGroup, readonly string[]>

type ItemForGrouping = Pick<ClothingItem, 'name' | 'category'> &
  Partial<Pick<ClothingItem, 'category_group' | 'subcategory'>>

// Specific garment names take precedence over broader words such as ジャケット and パンツ.
export function closetSubcategoryFor(item: ItemForGrouping, group: ClosetGroup = closetGroupFor(item)): string {
  if ((closetSubcategories[group] as readonly string[]).includes(item.subcategory ?? '')) return item.subcategory!
  const name = item.name.normalize('NFKC').toLowerCase()

  switch (group) {
    case 'アウター':
      if (/ダウン|(?:^|[^a-z])down(?:$|[^a-z])/.test(name)) return 'ダウン'
      if (/コート|coat/.test(name)) return 'コート'
      if (/ジャケット|jacket/.test(name)) return 'ジャケット'
      if (/ブルゾン|ブレーカー|blouson|ma-?1/.test(name)) return 'ブルゾン'
      if (/パーカ|パーカー|フーディ|hoodie|parka/.test(name)) return 'パーカ'
      return 'その他'

    case 'トップス':
      if (/カーディガン|cardigan/.test(name)) return 'カーディガン'
      if (/スウェット|トレーナー|フーディ|パーカ|パーカー|sweat|hoodie/.test(name)) return 'スウェット'
      if (/ブラ(?:トップ|ジャー)?(?=$|[\/\s(（])|キャミソール|タンクトップ|ボディスーツ|肌着|下着|インナー|inner|underwear/.test(name)) return 'インナー'
      if (/tシャツ|ティーシャツ|t[ -]?shirt|カットソー|(?:^|[^a-z])tee(?:$|[^a-z])|(?:^|[^a-z])(?:ut|t)(?=$|[\/\s(（])/.test(name)) return 'Tシャツ'
      if (/シャツ|ブラウス|ポロ|shirt|blouse|polo/.test(name)) return 'シャツ・ブラウス'
      if (/ニット|セーター|knit|sweater/.test(name)) return 'ニット'
      return 'その他'

    case 'ボトムス':
      if (/ボクサー|ブリーフ|トランクス|肌着|下着|underwear/.test(name)) return 'インナー'
      if (/リラコ|ステテコ|ルーム|loungewear/.test(name)) return 'ルームウェア'
      if (/ショートパンツ|ハーフパンツ|ショーツ|shorts?/.test(name)) return 'ショートパンツ'
      if (/スカート|skirt/.test(name)) return 'スカート'
      if (/デニム|ジーンズ|denim|jeans/.test(name)) return 'デニム'
      if (/パンツ|スラックス|チノ|ジョガー|pants?|trousers?/.test(name)) return 'パンツ'
      return 'その他'

    case 'レッグウェア':
      if (/レッグウォーマー|leg[ -]?warmers?/.test(name)) return 'レッグウォーマー'
      if (/レギンス|leggings?/.test(name)) return 'レギンス'
      if (/タイツ|ストッキング|tights?|stockings?/.test(name)) return 'タイツ'
      if (/靴下|ソックス|フットカバー|socks?/.test(name)) return 'ソックス'
      return 'その他'

    case 'アクセサリー':
      if (item.category === 'バッグ' || /バッグ|バックパック|リュック|サコッシュ|bags?|backpacks?/.test(name)) return 'バッグ'
      if (item.category === 'シューズ' || /シューズ|スニーカー|サンダル|ブーツ|靴|shoes?|sneakers?|sandals?|boots?/.test(name)) return 'シューズ'
      if (/帽子|キャップ|ハット|hat|caps?/.test(name)) return '帽子'
      if (/ベルト|belt/.test(name)) return 'ベルト'
      if (/マフラー|ストール|スカーフ|手袋|ネクタイ|サングラス|メガネ|マスク|傘|アンブレラ|scarf|gloves?|tie|sunglasses|mask|umbrella/.test(name)) return 'ファッション小物'
      return 'その他'

    case 'その他':
      if (item.category === 'ワンピース' || /ワンピース|ドレス|dresses?/.test(name)) return 'ワンピース'
      if (/ルーム|パジャマ|リラコ|loungewear|pajama/.test(name)) return 'ルームウェア'
      if (/ブランケット|タオル|クッション|毛布|blanket|towel|cushion/.test(name)) return '雑貨'
      return 'その他'
  }
}

export function sortClothingBySubcategory<T extends ItemForGrouping>(items: T[], group: ClosetGroup): T[] {
  const order: readonly string[] = closetSubcategories[group]
  return [...items].sort((first, second) =>
    order.indexOf(closetSubcategoryFor(first, group)) - order.indexOf(closetSubcategoryFor(second, group)),
  )
}
