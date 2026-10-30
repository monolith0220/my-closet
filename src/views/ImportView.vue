<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { createClothingBatch, listClothing } from '../lib/clothing'
import { formatClothingSize, normalizePurchaseDate } from '../lib/clothing-display'
import { detectUniqloCollection } from '../lib/uniqlo-collection'
import { parseImportTable, type ImportRow } from '../lib/import-table'
import { categories, colors, type ClothingInput, type ClothingItem } from '../types/clothing'

interface ImportDraft extends ImportRow {
  sourceIndex: number
  selected: boolean
}

type DuplicateStatus = { source: 'closet' | 'same-row' | null; repeatedProduct: boolean }

const router = useRouter()
const session = useSession()
const importText = ref('')
const drafts = ref<ImportDraft[]>([])
const existingItemKeys = shallowRef<Set<string>>(new Set())
const previewSection = ref<HTMLElement | null>(null)
const reviewedOwnership = ref(false)
const preparing = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const search = ref('')
const yearFilter = ref('')
const sizeGroupFilter = ref('')
const attentionOnly = ref(false)
const visibleCount = ref(30)

const selectedCount = computed(() => drafts.value.filter(row => row.selected).length)
const duplicateStates = computed(() => classifyDuplicates(drafts.value, existingItemKeys.value))
const duplicateCount = computed(() => [...duplicateStates.value.values()].filter(status => status.source).length)
const repeatedProductCount = computed(() => {
  const keys = new Set<string>()
  for (const row of drafts.value) {
    if (duplicateStates.value.get(row.sourceIndex)?.repeatedProduct) {
      keys.add(itemKey(row.name, row.productCode, row.originalColor || row.color, row.size))
    }
  }
  return keys.size
})
const otherCategoryCount = computed(() => drafts.value.filter(row => row.category === 'その他').length)
const otherColorCount = computed(() => drafts.value.filter(row => row.color === 'その他').length)
const attentionCount = computed(() => drafts.value.filter(row =>
  row.category === 'その他' || row.color === 'その他' || Boolean(duplicateStates.value.get(row.sourceIndex)?.repeatedProduct),
).length)
const invalidCount = computed(() => drafts.value.filter(row => row.selected && rowIssue(row)).length)
const years = computed(() => [...new Set(drafts.value.map(row => row.purchasedAt.slice(0, 4)).filter(Boolean))].sort().reverse())
const sizeGroup = (size: string) => size.match(/^(MEN|WOMEN|KIDS|BABY)\b/i)?.[1]?.toUpperCase() || 'その他'
const sizeGroups = computed(() => [...new Set(drafts.value.map(row => sizeGroup(row.size)))])
const filteredDrafts = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return drafts.value.filter(row =>
    (!term || [row.name, row.productCode, row.originalColor, row.size].join(' ').toLocaleLowerCase().includes(term)) &&
    (!yearFilter.value || row.purchasedAt.startsWith(yearFilter.value)) &&
    (!sizeGroupFilter.value || sizeGroup(row.size) === sizeGroupFilter.value) &&
    (!attentionOnly.value || row.category === 'その他' || row.color === 'その他' || Boolean(duplicateStates.value.get(row.sourceIndex)?.repeatedProduct)),
  )
})
const visibleDrafts = computed(() => filteredDrafts.value.slice(0, visibleCount.value))

function optional(value: string): string | null {
  return value.trim() || null
}

function itemKey(name: string, code: string | null, color: string, size: string | null): string {
  const identity = code?.trim() || name.trim().toLocaleLowerCase()
  return [identity, color.trim().toLocaleLowerCase(), size?.trim().toLocaleLowerCase() || ''].join('|')
}

function existingKeys(items: ClothingItem[]): Set<string> {
  return new Set(items.map(item => itemKey(item.name, item.product_code, item.color, item.size)))
}

function exactRowKey(row: ImportRow): string {
  return JSON.stringify([
    row.name.trim(), row.category, row.color, row.originalColor.trim(), row.size.trim(),
    row.productCode.trim(), row.productUrl.trim(), row.purchasedAt.trim(),
  ])
}

function classifyDuplicates(rows: readonly ImportDraft[], existing: Set<string>): Map<number, DuplicateStatus> {
  const seenRows = new Set<string>()
  const productCounts = new Map<string, number>()
  const statuses = new Map<number, DuplicateStatus>()
  for (const row of rows) {
    const key = itemKey(row.name, row.productCode, row.originalColor || row.color, row.size)
    productCounts.set(key, (productCounts.get(key) ?? 0) + 1)
  }
  for (const row of rows) {
    const productKey = itemKey(row.name, row.productCode, row.color, row.size)
    const repeatedKey = itemKey(row.name, row.productCode, row.originalColor || row.color, row.size)
    const rowKey = exactRowKey(row)
    const source = existing.has(productKey) ? 'closet' : seenRows.has(rowKey) ? 'same-row' : null
    statuses.set(row.sourceIndex, { source, repeatedProduct: (productCounts.get(repeatedKey) ?? 0) > 1 })
    seenRows.add(rowKey)
  }
  return statuses
}

function duplicateStatus(row: ImportDraft): DuplicateStatus {
  return duplicateStates.value.get(row.sourceIndex) ?? { source: null, repeatedProduct: false }
}

watch(importText, () => {
  drafts.value = []
  reviewedOwnership.value = false
}, { flush: 'sync' })

watch(duplicateStates, statuses => {
  for (const row of drafts.value) {
    if (statuses.get(row.sourceIndex)?.source) row.selected = false
  }
}, { flush: 'sync' })

function rowIssue(row: ImportDraft): string | null {
  if (!row.name.trim()) return '商品名を入力してください。'
  if (!categories.includes(row.category as typeof categories[number])) return 'カテゴリを選択してください。'
  if (!colors.includes(row.color as typeof colors[number])) return 'カラーを選択してください。'
  if (row.purchasedAt.trim() && !normalizePurchaseDate(row.purchasedAt)) return '購入日を確認してください。'
  if (row.productUrl.trim()) {
    try {
      const url = new URL(row.productUrl.trim())
      if (!['http:', 'https:'].includes(url.protocol)) return '商品URLを確認してください。'
    } catch {
      return '商品URLを確認してください。'
    }
  }
  return null
}

async function readFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 1024 * 1024) {
    errorMessage.value = 'ファイルは1MB以下にしてください。'
    input.value = ''
    return
  }
  importText.value = await file.text()
  drafts.value = []
  errorMessage.value = ''
  input.value = ''
}

async function prepare() {
  const userId = session.value?.user.id
  if (!userId || preparing.value) return
  errorMessage.value = ''
  preparing.value = true
  drafts.value = []
  reviewedOwnership.value = false
  const sourceText = importText.value
  try {
    const rows = parseImportTable(sourceText)
    const keys = existingKeys(await listClothing(userId))
    if (importText.value !== sourceText) return
    existingItemKeys.value = keys
    const candidates = rows.map((row, index) => ({ ...row, sourceIndex: index + 1, selected: true }))
    const statuses = classifyDuplicates(candidates, keys)
    for (const row of candidates) row.selected = !statuses.get(row.sourceIndex)?.source
    drafts.value = candidates
    search.value = ''
    yearFilter.value = ''
    sizeGroupFilter.value = ''
    attentionOnly.value = false
    visibleCount.value = 30
    await nextTick()
    previewSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (error) {
    drafts.value = []
    errorMessage.value = error instanceof Error ? error.message : '読み込みに失敗しました。'
  } finally {
    preparing.value = false
  }
}

function selectAll(value: boolean) {
  for (const row of drafts.value) row.selected = value
}

function selectVisible(value: boolean) {
  for (const row of visibleDrafts.value) row.selected = value
}

function toInput(row: ImportDraft): ClothingInput {
  const memo = [
    row.purchasedAt.trim() ? `購入日: ${row.purchasedAt.trim()}` : '',
    row.originalColor.trim() ? `ユニクロカラー: ${row.originalColor.trim()}` : '',
  ].filter(Boolean).join(' / ')
  return {
    name: row.name.trim(),
    brand: 'UNIQLO',
    collection: detectUniqloCollection('UNIQLO', row.name),
    category: row.category,
    color: row.color,
    size: optional(row.size),
    purchased_at: row.purchasedAt.trim() ? normalizePurchaseDate(row.purchasedAt) : null,
    seasons: [],
    style_tags: [],
    product_code: optional(row.productCode),
    product_url: optional(row.productUrl),
    image_path: null,
    registration_method: 'uniqlo_history_import',
    memo: memo || null,
  }
}

async function save() {
  const userId = session.value?.user.id
  if (!userId || saving.value || preparing.value) return
  errorMessage.value = ''
  if (!reviewedOwnership.value) {
    errorMessage.value = '返品・手放した商品を確認してください。'
    return
  }
  const chosen = drafts.value.filter(row => row.selected)
  if (!chosen.length) {
    errorMessage.value = '追加する商品を選択してください。'
    return
  }
  const invalid = chosen.find(row => rowIssue(row))
  if (invalid) {
    errorMessage.value = `${invalid.sourceIndex}行目: ${rowIssue(invalid)}`
    return
  }
  saving.value = true
  try {
    await createClothingBatch(userId, chosen.map(toInput))
    await router.replace('/closet')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '一括追加に失敗しました。'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="page-shell">
    <header class="mb-7 flex items-center gap-4">
      <button type="button" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-800" aria-label="戻る" @click="router.push('/closet')"><AppIcon name="arrow-left" :size="20" /></button>
      <div><p class="eyebrow">MY WARDROBE</p><h1 class="mt-1 text-[24px] font-bold tracking-tight">購入履歴を一括追加</h1></div>
    </header>

    <section class="surface-card space-y-4 p-5">
      <div>
        <h2 class="text-base font-bold">商品データを読み込む</h2>
        <p class="mt-2 text-xs leading-6 text-neutral-600">ユニクロの購入履歴を確認し、商品情報をCSVまたはタブ区切りの表として貼り付けてください。氏名・住所・注文番号は不要です。</p>
        <a href="https://www.uniqlo.com/jp/ja/member/orders/products" target="_blank" rel="noopener noreferrer" class="mt-2 inline-flex text-xs font-semibold text-neutral-900 underline">ユニクロの商品一覧を開く</a>
      </div>
      <div>
        <label for="import-text" class="field-label">商品一覧の表</label>
        <textarea id="import-text" v-model="importText" class="field-input min-h-36 resize-y font-mono text-xs" placeholder="商品名,カテゴリ,カラー,サイズ,商品番号,商品URL,購入日&#10;3Dモックネックセーター,トップス,ブラック,L,486082,https://www.uniqlo.com/jp/ja/products/E486082-000/00,2026/10/26" />
        <p class="mt-2 text-[11px] leading-5 text-neutral-500">先頭行に「商品名,カテゴリ,カラー,サイズ,商品番号,商品URL,購入日」を入れてください。カテゴリとカラーは確認画面で修正できます。追加ボタンを押すまで商品データはSupabaseへ送信されません。</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <label for="import-file" class="secondary-button cursor-pointer">CSV・TSVファイルを選ぶ</label>
        <input id="import-file" class="sr-only" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" @change="readFile" />
        <button type="button" class="primary-button" :disabled="preparing || !importText.trim()" @click="prepare">{{ preparing ? '確認中...' : '候補を確認' }}</button>
      </div>
    </section>

    <section v-if="drafts.length" ref="previewSection" class="mt-7 scroll-mt-4">
      <div class="mb-4">
        <h2 class="text-base font-bold">登録候補 {{ drafts.length }} 件</h2>
        <p class="mt-1 text-xs leading-5 text-neutral-600">選択中 {{ selectedCount }} 件<span v-if="duplicateCount"> · 重複候補 {{ duplicateCount }} 件</span><span v-if="invalidCount"> · 要修正 {{ invalidCount }} 件</span></p>
        <p v-if="repeatedProductCount" class="mt-1 text-xs leading-5 text-amber-700">同じ商品番号・カラー・サイズの別購入候補 {{ repeatedProductCount }} 組</p>
        <p v-if="otherCategoryCount || otherColorCount" class="mt-1 text-xs leading-5 text-amber-700">分類を確認：カテゴリ「その他」{{ otherCategoryCount }} 件 · カラー「その他」{{ otherColorCount }} 件</p>
        <p class="mt-2 text-xs leading-5 text-neutral-600">返品・交換や、もう所有していない商品はチェックを外してください。写真は後から追加できます。</p>
      </div>
      <input v-model="search" type="search" class="field-input mb-3" placeholder="候補内を検索" aria-label="登録候補を検索" />
      <div class="mb-3 grid grid-cols-2 gap-3">
        <div><label for="import-year" class="field-label">購入年</label><select id="import-year" v-model="yearFilter" class="field-select"><option value="">すべて</option><option v-for="year in years" :key="year" :value="year">{{ year }}年</option></select></div>
        <div><label for="import-size-group" class="field-label">サイズ区分</label><select id="import-size-group" v-model="sizeGroupFilter" class="field-select"><option value="">すべて</option><option v-for="group in sizeGroups" :key="group" :value="group">{{ group }}</option></select></div>
      </div>
      <label v-if="attentionCount" class="mb-4 flex cursor-pointer items-center gap-2 text-xs font-semibold text-amber-800"><input v-model="attentionOnly" type="checkbox" class="h-5 w-5 accent-neutral-900" />要確認の候補だけ表示（{{ attentionCount }} 件）</label>
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" class="secondary-button min-h-10 px-3 text-xs" @click="selectVisible(true)">表示中 {{ visibleDrafts.length }} 件を選択</button>
        <button type="button" class="secondary-button min-h-10 px-3 text-xs" @click="selectVisible(false)">表示中 {{ visibleDrafts.length }} 件を解除</button>
        <button type="button" class="text-button px-2 text-xs" @click="selectAll(true)">全件選択</button>
        <button type="button" class="text-button px-2 text-xs" @click="selectAll(false)">全件解除</button>
      </div>

      <div class="space-y-3">
        <div v-for="row in visibleDrafts" :key="row.sourceIndex" class="surface-card p-4" :class="!row.selected ? 'opacity-60' : ''">
          <div class="flex items-start gap-3">
            <input v-model="row.selected" type="checkbox" :aria-label="`${row.name || row.sourceIndex + '行目'}を追加`" class="mt-1.5 h-5 w-5 shrink-0 accent-neutral-900" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold">{{ row.name || '商品名なし' }}</p>
              <p class="mt-1 text-[11px] text-neutral-500">{{ row.productCode || '商品番号なし' }} · {{ row.originalColor || row.color }}<span v-if="row.size"> · {{ formatClothingSize(row.size) }}</span><span v-if="row.purchasedAt"> · {{ row.purchasedAt }}</span></p>
              <p v-if="duplicateStatus(row).source === 'closet'" class="mt-1 text-[11px] font-semibold text-amber-700">クローゼットに同じ商品が登録済みの可能性があります</p>
              <p v-else-if="duplicateStatus(row).source === 'same-row'" class="mt-1 text-[11px] font-semibold text-amber-700">この表に完全に同じ行があります</p>
              <p v-if="duplicateStatus(row).repeatedProduct && duplicateStatus(row).source !== 'same-row'" class="mt-1 text-[11px] font-semibold text-amber-700">同じ商品番号・カラー・サイズの候補があります。購入日を確認してください</p>
              <p v-if="row.category === 'その他' || row.color === 'その他'" class="mt-1 text-[11px] font-semibold text-amber-700">カテゴリ・カラーの「その他」を確認してください</p>
              <p v-if="row.selected && rowIssue(row)" class="mt-1 text-[11px] font-semibold text-red-700">{{ rowIssue(row) }}</p>
            </div>
          </div>
          <details class="mt-3 border-t border-neutral-100 pt-3">
            <summary class="cursor-pointer text-xs font-semibold text-neutral-700">内容を確認・編集</summary>
            <div class="mt-4 space-y-3">
              <div><label :for="`import-name-${row.sourceIndex}`" class="field-label">商品名</label><input :id="`import-name-${row.sourceIndex}`" v-model="row.name" class="field-input" maxlength="120" /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label :for="`import-category-${row.sourceIndex}`" class="field-label">カテゴリ</label><select :id="`import-category-${row.sourceIndex}`" v-model="row.category" class="field-select"><option v-for="choice in categories" :key="choice" :value="choice">{{ choice }}</option></select></div>
                <div><label :for="`import-color-${row.sourceIndex}`" class="field-label">カラー</label><select :id="`import-color-${row.sourceIndex}`" v-model="row.color" class="field-select"><option v-for="choice in colors" :key="choice" :value="choice">{{ choice }}</option></select></div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div><label :for="`import-size-${row.sourceIndex}`" class="field-label">サイズ</label><input :id="`import-size-${row.sourceIndex}`" v-model="row.size" class="field-input" maxlength="30" /></div>
                <div><label :for="`import-code-${row.sourceIndex}`" class="field-label">商品番号</label><input :id="`import-code-${row.sourceIndex}`" v-model="row.productCode" class="field-input" maxlength="100" /></div>
              </div>
              <div><label :for="`import-url-${row.sourceIndex}`" class="field-label">商品URL</label><input :id="`import-url-${row.sourceIndex}`" v-model="row.productUrl" class="field-input" type="url" /></div>
              <div><label :for="`import-date-${row.sourceIndex}`" class="field-label">購入日</label><input :id="`import-date-${row.sourceIndex}`" v-model="row.purchasedAt" class="field-input" maxlength="30" /></div>
            </div>
          </details>
        </div>
      </div>
      <button v-if="visibleCount < filteredDrafts.length" type="button" class="secondary-button mt-4 w-full" @click="visibleCount += 30">さらに表示（{{ filteredDrafts.length - visibleCount }} 件）</button>
      <p class="mt-4 text-xs text-neutral-500">表示中 {{ visibleDrafts.length }} / {{ filteredDrafts.length }} 件</p>
    </section>

    <p v-if="errorMessage" role="alert" class="mt-6 rounded-xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">{{ errorMessage }}</p>
    <div v-if="drafts.length" class="sticky bottom-20 z-10 mt-7 rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
      <label class="mb-3 flex cursor-pointer items-center gap-2 text-xs font-semibold text-neutral-700"><input v-model="reviewedOwnership" type="checkbox" class="h-5 w-5 shrink-0 accent-neutral-900" />返品・手放した商品を確認しました</label>
      <button type="button" class="primary-button w-full" :disabled="saving || !reviewedOwnership || selectedCount === 0 || invalidCount > 0" @click="save">{{ saving ? '追加中...' : `${selectedCount} 件をクローゼットに追加` }}</button>
    </div>
  </main>
</template>
