export const uniqloCollections = ['UNIQLO U', 'UNIQLO : C'] as const
export type UniqloCollection = (typeof uniqloCollections)[number]

// Product codes alone do not establish which collection an item belongs to.
export function detectUniqloCollection(brand: string, name: string): UniqloCollection | null {
  const sources = [brand, name].map(value => value.normalize('NFKC'))
  const isU = sources.some(value => /(?:uniqlo|ユニクロ)\s*[:：]?\s*u(?=$|[\s　・:：/（）()])/i.test(value))
  const isC = sources.some(value => /(?:uniqlo|ユニクロ)\s*[:：]?\s*c(?=$|[\s　・:：/（）()])/i.test(value))
  if (isU === isC) return null
  return isU ? 'UNIQLO U' : 'UNIQLO : C'
}
