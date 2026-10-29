<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { listClothing, signedClothingImages } from '../lib/clothing'
import { closetGroupFor } from '../lib/closet-groups'
import { formatClothingSize } from '../lib/clothing-display'
import { createOutfitPair, deleteOutfitPair, listOutfitPairs, type OutfitPair } from '../lib/outfits'
import type { ClothingItem } from '../types/clothing'

const session = useSession()
const items = ref<ClothingItem[]>([])
const outfits = ref<OutfitPair[]>([])
const imageUrls = ref<Record<string, string>>({})
let imageSigning = false
let imageSigningQueued = false
const loading = ref(true)
const saving = ref(false)
const deletingId = ref('')
const errorMessage = ref('')
const formError = ref('')
const title = ref('')
const upperId = ref('')
const lowerId = ref('')
const upperQuery = ref('')
const lowerQuery = ref('')
const visibleCount = ref(10)

const upperItems = computed(() => items.value.filter(item => ['トップス', 'アウター'].includes(closetGroupFor(item))))
const lowerItems = computed(() => items.value.filter(item => closetGroupFor(item) === 'ボトムス'))
const selectedUpper = computed(() => upperItems.value.find(item => item.id === upperId.value) ?? null)
const selectedLower = computed(() => lowerItems.value.find(item => item.id === lowerId.value) ?? null)
const filteredUpperItems = computed(() => matchingItems(upperItems.value, upperQuery.value, upperId.value))
const filteredLowerItems = computed(() => matchingItems(lowerItems.value, lowerQuery.value, lowerId.value))
const visibleOutfits = computed(() => outfits.value.slice(0, visibleCount.value))

function matchingItems(candidates: ClothingItem[], query: string, selectedId: string): ClothingItem[] {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return candidates
  const matches = candidates.filter(item =>
    [item.name, item.brand, item.color, item.size ?? ''].join(' ').toLocaleLowerCase().includes(term),
  )
  const selected = candidates.find(item => item.id === selectedId)
  return selected && !matches.some(item => item.id === selected.id) ? [selected, ...matches] : matches
}

function optionLabel(item: ClothingItem): string {
  const size = formatClothingSize(item.size)
  return [item.brand, item.name, item.color, size].filter(Boolean).join(' · ')
}

function savedDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date)
}

async function signVisibleImages() {
  if (imageSigning) {
    imageSigningQueued = true
    return
  }
  imageSigning = true
  try {
    do {
      imageSigningQueued = false
      const clothing = [
        ...visibleOutfits.value.flatMap(outfit => [outfit.top, outfit.bottom]),
        selectedUpper.value,
        selectedLower.value,
      ]
      const pending = [...new Set(clothing.map(item => item?.image_path).filter((path): path is string => Boolean(path)))]
        .filter(path => !imageUrls.value[path])
      if (!pending.length) continue
      try {
        imageUrls.value = { ...imageUrls.value, ...await signedClothingImages(pending) }
      } catch {
        // Clothing names remain visible if a private image link cannot be signed.
      }
    } while (imageSigningQueued)
  } finally {
    imageSigning = false
  }
}

watch([visibleOutfits, selectedUpper, selectedLower], signVisibleImages)

async function load() {
  const userId = session.value?.user.id
  if (!userId) return
  loading.value = true
  errorMessage.value = ''
  try {
    const [clothing, saved] = await Promise.all([listClothing(userId), listOutfitPairs(userId)])
    items.value = clothing
    outfits.value = saved
    visibleCount.value = 10
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'コーデを読み込めませんでした。'
  } finally {
    loading.value = false
  }
}

async function save() {
  const userId = session.value?.user.id
  if (!userId || saving.value) return
  formError.value = ''
  if (!selectedUpper.value || !selectedLower.value) {
    formError.value = '上に着るものと下に着るものを1着ずつ選んでください。'
    return
  }
  saving.value = true
  try {
    const fallbackTitle = `${selectedUpper.value.name} × ${selectedLower.value.name}`
    await createOutfitPair(userId, title.value.trim() || fallbackTitle, selectedUpper.value.id, selectedLower.value.id)
    outfits.value = await listOutfitPairs(userId)
    visibleCount.value = 10
    title.value = ''
    upperId.value = ''
    lowerId.value = ''
    upperQuery.value = ''
    lowerQuery.value = ''
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'コーデを保存できませんでした。'
  } finally {
    saving.value = false
  }
}

async function remove(outfit: OutfitPair) {
  const userId = session.value?.user.id
  if (!userId || deletingId.value) return
  if (!window.confirm(`「${outfit.title}」を削除しますか？洋服は削除されません。`)) return
  deletingId.value = outfit.id
  errorMessage.value = ''
  try {
    await deleteOutfitPair(outfit.id, userId)
    outfits.value = outfits.value.filter(saved => saved.id !== outfit.id)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'コーデを削除できませんでした。'
  } finally {
    deletingId.value = ''
  }
}

onMounted(load)
</script>

<template>
  <main class="page-shell">
    <header>
      <p class="eyebrow">MY OUTFITS</p>
      <h1 class="mt-2 text-[29px] font-bold tracking-tight">上下コーデ</h1>
      <p class="mt-2 text-xs text-neutral-500">クローゼットの洋服を組み合わせて保存します。</p>
    </header>

    <div v-if="loading" class="mt-8 space-y-4" aria-label="コーデを読み込み中">
      <div class="h-72 animate-pulse rounded-2xl bg-neutral-200" />
      <div class="h-44 animate-pulse rounded-2xl bg-neutral-100" />
    </div>
    <template v-else>
      <p v-if="errorMessage" role="alert" class="mt-5 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{{ errorMessage }}</p>
      <section class="surface-card mt-7 p-5">
        <h2 class="text-base font-bold">新しい組み合わせ</h2>
        <p class="mt-1 text-xs leading-5 text-neutral-500">上はトップス・アウター、下はボトムスから選べます。</p>
        <form class="mt-5 space-y-5" @submit.prevent="save">
          <div>
            <label for="outfit-title" class="field-label">コーデ名</label>
            <input id="outfit-title" v-model="title" type="text" class="field-input" maxlength="120" placeholder="例：休日の定番（省略可）" />
          </div>
          <div>
            <label for="upper-item" class="field-label">上に着るもの <span class="text-red-500">*</span></label>
            <input v-model="upperQuery" type="search" class="field-input mb-2" placeholder="名前・ブランド・色で絞り込む" aria-label="上に着るものを検索" />
            <select id="upper-item" v-model="upperId" class="field-select" required>
              <option value="" disabled>選択してください（{{ upperItems.length }} 着）</option>
              <option v-for="candidate in filteredUpperItems" :key="candidate.id" :value="candidate.id">{{ optionLabel(candidate) }}</option>
            </select>
            <p v-if="upperQuery" class="mt-1 text-[11px] text-neutral-500">候補 {{ filteredUpperItems.length }} 着</p>
            <div v-if="selectedUpper" class="mt-3 flex items-center gap-3 rounded-xl bg-neutral-50 p-2">
              <div class="flex h-16 w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#ecece9] text-neutral-300">
                <img v-if="selectedUpper.image_path && imageUrls[selectedUpper.image_path]" :src="imageUrls[selectedUpper.image_path]" :alt="selectedUpper.name" class="h-full w-full object-contain" />
                <AppIcon v-else name="shirt" :size="25" />
              </div>
              <div class="min-w-0"><p class="truncate text-[10px] font-semibold text-neutral-400">{{ selectedUpper.brand }}</p><p class="mt-1 text-xs font-semibold leading-5">{{ selectedUpper.name }}</p></div>
            </div>
          </div>
          <div>
            <label for="lower-item" class="field-label">下に着るもの <span class="text-red-500">*</span></label>
            <input v-model="lowerQuery" type="search" class="field-input mb-2" placeholder="名前・ブランド・色で絞り込む" aria-label="下に着るものを検索" />
            <select id="lower-item" v-model="lowerId" class="field-select" required>
              <option value="" disabled>選択してください（{{ lowerItems.length }} 着）</option>
              <option v-for="candidate in filteredLowerItems" :key="candidate.id" :value="candidate.id">{{ optionLabel(candidate) }}</option>
            </select>
            <p v-if="lowerQuery" class="mt-1 text-[11px] text-neutral-500">候補 {{ filteredLowerItems.length }} 着</p>
            <div v-if="selectedLower" class="mt-3 flex items-center gap-3 rounded-xl bg-neutral-50 p-2">
              <div class="flex h-16 w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#ecece9] text-neutral-300">
                <img v-if="selectedLower.image_path && imageUrls[selectedLower.image_path]" :src="imageUrls[selectedLower.image_path]" :alt="selectedLower.name" class="h-full w-full object-contain" />
                <AppIcon v-else name="shirt" :size="25" />
              </div>
              <div class="min-w-0"><p class="truncate text-[10px] font-semibold text-neutral-400">{{ selectedLower.brand }}</p><p class="mt-1 text-xs font-semibold leading-5">{{ selectedLower.name }}</p></div>
            </div>
          </div>
          <p v-if="formError" role="alert" class="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{{ formError }}</p>
          <button type="submit" class="primary-button w-full" :disabled="saving || !upperItems.length || !lowerItems.length"><AppIcon name="plus" :size="18" />{{ saving ? '保存中...' : 'この組み合わせを保存' }}</button>
          <p v-if="!upperItems.length || !lowerItems.length" class="text-center text-xs text-neutral-500">上と下の洋服を登録するとコーデを作れます。</p>
        </form>
      </section>

      <section class="mt-8">
        <div class="flex items-center justify-between"><h2 class="text-sm font-bold">保存したコーデ</h2><span class="text-xs text-neutral-400">{{ outfits.length }} セット</span></div>
        <div v-if="!outfits.length" class="surface-card mt-4 px-5 py-10 text-center"><AppIcon name="hanger" :size="32" class="mx-auto text-neutral-300" /><p class="mt-3 text-sm font-semibold">まだコーデがありません</p><p class="mt-2 text-xs text-neutral-500">上と下の洋服を選んで保存してください。</p></div>
        <article v-for="outfit in visibleOutfits" :key="outfit.id" class="surface-card mt-4 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0"><h3 class="break-words text-sm font-bold">{{ outfit.title }}</h3><p class="mt-1 text-[11px] text-neutral-400">{{ savedDate(outfit.created_at) }}</p></div>
            <button type="button" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50" :disabled="Boolean(deletingId)" :aria-label="`${outfit.title}を削除`" @click="remove(outfit)"><AppIcon name="trash" :size="17" /></button>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-3">
            <div v-for="part in [{ role: '上', piece: outfit.top }, { role: '下', piece: outfit.bottom }]" :key="part.role" class="min-w-0">
              <div class="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#ecece9]">
                <img v-if="part.piece.image_path && imageUrls[part.piece.image_path]" :src="imageUrls[part.piece.image_path]" :alt="part.piece.name" class="h-full w-full object-contain" loading="lazy" />
                <div v-else class="flex h-full items-center justify-center text-neutral-300"><AppIcon name="shirt" :size="35" /></div>
                <span class="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold">{{ part.role }}</span>
              </div>
              <RouterLink v-if="part.piece.is_active" :to="`/closet/${part.piece.id}`" class="mt-2 block truncate text-xs font-semibold text-neutral-900 underline-offset-2 hover:underline">{{ part.piece.name }}</RouterLink>
              <p v-else class="mt-2 truncate text-xs font-semibold text-neutral-500">{{ part.piece.name }} <span class="text-[10px]">（登録解除済み）</span></p>
            </div>
          </div>
        </article>
        <button v-if="visibleOutfits.length < outfits.length" type="button" class="secondary-button mt-4 w-full" @click="visibleCount += 10">さらに表示（{{ outfits.length - visibleOutfits.length }} セット）</button>
      </section>
    </template>
  </main>
</template>
