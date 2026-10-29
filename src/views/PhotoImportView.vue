<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { listClothing, removeClothingImage, updateClothingImage, uploadClothingImage } from '../lib/clothing'
import { matchPhotos, parsePhotoManifest, type PhotoMatch, type PhotoMatchStatus } from '../lib/photo-import'

const router = useRouter()
const session = useSession()
const manifestText = ref('')
const files = ref<File[]>([])
const matches = ref<PhotoMatch[]>([])
const selectedRows = ref<number[]>([])
const previewSection = ref<HTMLElement | null>(null)
const visibleCount = ref(30)
const preparing = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const failures = ref<string[]>([])
const processedCount = ref(0)
const savedCount = ref(0)
let sourceRevision = 0

const readyMatches = computed(() => matches.value.filter(match => match.status === 'ready'))
const selectedCount = computed(() => readyMatches.value.filter(match => selectedRows.value.includes(match.row.sourceIndex)).length)
const visibleMatches = computed(() => matches.value.slice(0, visibleCount.value))
const statusCounts = computed(() => {
  const counts: Record<PhotoMatchStatus, number> = {
    ready: 0,
    'missing-file': 0,
    'missing-item': 0,
    'ambiguous-item': 0,
    'already-has-image': 0,
    'duplicate-row': 0,
  }
  for (const match of matches.value) counts[match.status] += 1
  return counts
})

watch([manifestText, files], () => {
  sourceRevision += 1
  matches.value = []
  selectedRows.value = []
  failures.value = []
  savedCount.value = 0
  processedCount.value = 0
}, { flush: 'sync' })

function statusLabel(status: PhotoMatchStatus): string {
  switch (status) {
    case 'ready': return '紐付け可能'
    case 'missing-file': return '画像ファイルがありません'
    case 'missing-item': return '対応する登録済み商品がありません'
    case 'ambiguous-item': return '同じ購入情報の商品が複数あります'
    case 'already-has-image': return 'すでに写真があります'
    case 'duplicate-row': return '対応表に同じ購入行が複数あります'
  }
}

function chooseFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const chosen = Array.from(input.files ?? [])
  input.value = ''
  errorMessage.value = ''
  files.value = []
  if (chosen.length > 500) {
    errorMessage.value = '画像は一度に500ファイルまで選んでください。'
    return
  }
  const invalid = chosen.find(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)
  if (invalid) {
    errorMessage.value = 'JPEG・PNG・WebP形式、1枚10MB以下の画像を選んでください。'
    return
  }
  const names = chosen.map(file => file.name)
  if (new Set(names).size !== names.length) {
    errorMessage.value = '同じファイル名の画像があります。重複しない名前にしてください。'
    return
  }
  files.value = chosen
}

async function prepare() {
  const userId = session.value?.user.id
  if (!userId || preparing.value || saving.value) return
  errorMessage.value = ''
  failures.value = []
  preparing.value = true
  const revision = sourceRevision
  try {
    const rows = parsePhotoManifest(manifestText.value)
    if (!files.value.length) throw new Error('対応表に記載した画像ファイルを選んでください。')
    const items = await listClothing(userId)
    if (revision !== sourceRevision) return
    matches.value = matchPhotos(rows, items, files.value.map(file => file.name))
    selectedRows.value = matches.value.filter(match => match.status === 'ready').map(match => match.row.sourceIndex)
    visibleCount.value = 30
    await nextTick()
    previewSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (error) {
    matches.value = []
    errorMessage.value = error instanceof Error ? error.message : '画像の対応を確認できませんでした。'
  } finally {
    preparing.value = false
  }
}

async function save() {
  const userId = session.value?.user.id
  if (!userId || saving.value || preparing.value) return
  const chosen = readyMatches.value.filter(match => selectedRows.value.includes(match.row.sourceIndex))
  if (!chosen.length) {
    errorMessage.value = '反映する写真を選んでください。'
    return
  }
  const fileByName = new Map(files.value.map(file => [file.name, file]))
  errorMessage.value = ''
  failures.value = []
  processedCount.value = 0
  savedCount.value = 0
  saving.value = true
  let next = 0
  async function worker() {
    while (next < chosen.length) {
      const match = chosen[next++]!
      const file = fileByName.get(match.row.fileName)
      if (!file || !match.itemId) {
        failures.value.push(`${match.row.sourceIndex}行目: 画像または商品が見つかりません。`)
        processedCount.value += 1
        continue
      }
      try {
        const path = await uploadClothingImage(userId!, file)
        try {
          await updateClothingImage(match.itemId, userId!, path)
          savedCount.value += 1
        } catch (error) {
          await removeClothingImage(path).catch(() => undefined)
          throw error
        }
      } catch (error) {
        failures.value.push(`${match.row.sourceIndex}行目: ${error instanceof Error ? error.message : '写真を反映できませんでした。'}`)
      } finally {
        processedCount.value += 1
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(4, chosen.length) }, () => worker()))
    const previousSelection = new Set(selectedRows.value)
    matches.value = matchPhotos(parsePhotoManifest(manifestText.value), await listClothing(userId), files.value.map(file => file.name))
    selectedRows.value = matches.value.filter(match => match.status === 'ready' && previousSelection.has(match.row.sourceIndex)).map(match => match.row.sourceIndex)
    if (!failures.value.length) {
      errorMessage.value = `${savedCount.value}件の写真を反映しました。`
    }
  } catch (error) {
    errorMessage.value = `保存後の確認に失敗しました。${error instanceof Error ? error.message : ''}`
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="page-shell">
    <header class="mb-7 flex items-center gap-4">
      <button type="button" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-800" aria-label="戻る" @click="router.push('/closet')"><AppIcon name="arrow-left" :size="20" /></button>
      <div><p class="eyebrow">MY WARDROBE</p><h1 class="mt-1 text-[24px] font-bold tracking-tight">写真を一括追加</h1></div>
    </header>

    <section class="surface-card space-y-4 p-5">
      <div>
        <h2 class="text-base font-bold">購入履歴の写真を照合</h2>
        <p class="mt-2 text-xs leading-6 text-neutral-600">商品番号・元のカラー・サイズ・購入日で登録済みの洋服を特定します。対応表と画像ファイルを確認し、写真のない商品だけに反映します。</p>
      </div>
      <div>
        <label for="photo-manifest" class="field-label">画像の対応表（タブ区切り）</label>
        <textarea id="photo-manifest" v-model="manifestText" :disabled="saving || preparing" class="field-input min-h-36 resize-y font-mono text-xs" placeholder="商品番号&#9;カラー&#9;サイズ&#9;購入日&#9;画像ファイル名&#10;486082&#9;09 BLACK&#9;MEN L&#9;2026/10/26&#9;jpgoods_09_486082_3x4.jpg" />
        <p class="mt-2 text-[11px] leading-5 text-neutral-500">先頭行は「商品番号・カラー・サイズ・購入日・画像ファイル名」です。対応表と画像は確認中も端末内にあり、反映ボタンを押すまでSupabaseに送信しません。</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <label for="photo-files" class="secondary-button cursor-pointer">画像ファイルを選ぶ</label>
        <input id="photo-files" type="file" class="sr-only" accept="image/jpeg,image/png,image/webp" multiple :disabled="saving || preparing" @change="chooseFiles" />
        <span class="text-xs text-neutral-500">{{ files.length }} ファイル選択中</span>
      </div>
      <button type="button" class="primary-button" :disabled="preparing || saving || !manifestText.trim() || !files.length" @click="prepare">{{ preparing ? '照合中...' : '写真の対応を確認' }}</button>
    </section>

    <section v-if="matches.length" ref="previewSection" class="mt-7 scroll-mt-4">
      <h2 class="text-base font-bold">写真の候補 {{ matches.length }} 件</h2>
      <p class="mt-1 text-xs leading-5 text-neutral-600">反映可能 {{ statusCounts.ready }} 件 · 選択中 {{ selectedCount }} 件 · 照合できない・既存写真あり {{ matches.length - statusCounts.ready }} 件</p>
      <p class="mt-2 text-xs leading-5 text-neutral-600">商品番号が同じでも、カラー・サイズ・購入日が異なる商品には写真を流用しません。</p>
      <div class="mt-4 space-y-3">
        <div v-for="match in visibleMatches" :key="match.row.sourceIndex" class="surface-card p-4">
          <div class="flex items-start gap-3">
            <input v-if="match.status === 'ready'" v-model="selectedRows" type="checkbox" :value="match.row.sourceIndex" :disabled="saving" :aria-label="`${match.row.sourceIndex}行目の写真を反映`" class="mt-1 h-5 w-5 shrink-0 accent-neutral-900" />
            <span v-else class="mt-1 h-5 w-5 shrink-0 rounded border border-neutral-200 bg-neutral-100" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold">{{ match.row.productCode }} · {{ match.row.originalColor }} · {{ match.row.size }}</p>
              <p class="mt-1 truncate text-[11px] text-neutral-500">{{ match.row.purchasedAt }} · {{ match.row.fileName }}</p>
              <p class="mt-1 text-[11px]" :class="match.status === 'ready' ? 'text-emerald-700' : 'text-amber-700'">{{ statusLabel(match.status) }}</p>
            </div>
          </div>
        </div>
      </div>
      <button v-if="visibleCount < matches.length" type="button" class="secondary-button mt-4 w-full" @click="visibleCount += 30">さらに表示（{{ matches.length - visibleCount }} 件）</button>
      <p class="mt-3 text-xs text-neutral-500">表示中 {{ visibleMatches.length }} / {{ matches.length }} 件</p>
    </section>

    <p v-if="errorMessage" role="status" class="mt-6 rounded-xl px-4 py-3 text-xs leading-5" :class="failures.length ? 'bg-red-50 text-red-700' : 'bg-neutral-100 text-neutral-700'">{{ errorMessage }}</p>
    <div v-if="failures.length" class="mt-4 rounded-xl bg-red-50 p-4 text-xs text-red-700"><p class="font-semibold">反映できなかった {{ failures.length }} 件</p><p v-for="failure in failures.slice(0, 20)" :key="failure" class="mt-2">{{ failure }}</p></div>
    <div v-if="matches.length" class="sticky bottom-20 z-10 mt-7 rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
      <p v-if="saving" class="mb-2 text-center text-xs text-neutral-600">{{ processedCount }} / {{ selectedCount }} 件処理中 · {{ savedCount }} 件保存済み</p>
      <button type="button" class="primary-button w-full" :disabled="saving || preparing || selectedCount === 0" @click="save">{{ saving ? '写真を反映中...' : `${selectedCount} 件の写真を反映` }}</button>
    </div>
  </main>
</template>
