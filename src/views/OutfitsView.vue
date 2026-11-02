<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { signedClothingImages } from '../lib/clothing'
import { outfitRoleLabel } from '../lib/outfit-selection'
import { deleteOutfit, listOutfits, type OutfitSet } from '../lib/outfits'

const session = useSession()
const outfits = ref<OutfitSet[]>([])
const imageUrls = ref<Record<string, string>>({})
const loading = ref(true)
const deletingId = ref('')
const errorMessage = ref('')
const visibleCount = ref(10)
let imageSigning = false
let imageSigningQueued = false

const visibleOutfits = computed(() => outfits.value.slice(0, visibleCount.value))

function savedDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date)
}

function pieceSummary(outfit: OutfitSet): string {
  const labels = []
  if (outfit.outers.length) labels.push(`アウター ${outfit.outers.length}`)
  if (outfit.inners.length) labels.push(`インナー ${outfit.inners.length}`)
  if (outfit.bottom) labels.push('ボトムス 1')
  return labels.join(' ・ ')
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
      const pending = [...new Set(visibleOutfits.value
        .flatMap(outfit => outfit.pieces.map(piece => piece.item.image_path))
        .filter((path): path is string => Boolean(path)))]
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

watch(visibleOutfits, signVisibleImages)

async function load() {
  const userId = session.value?.user.id
  if (!userId) return
  loading.value = true
  errorMessage.value = ''
  try {
    outfits.value = await listOutfits(userId)
    visibleCount.value = 10
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'コーデを読み込めませんでした。'
  } finally {
    loading.value = false
  }
}

async function remove(outfit: OutfitSet) {
  const userId = session.value?.user.id
  if (!userId || deletingId.value) return
  if (!window.confirm(`コーデ${outfit.list_number}を削除しますか？洋服は削除されません。`)) return
  deletingId.value = outfit.id
  errorMessage.value = ''
  try {
    await deleteOutfit(outfit.id, userId)
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
  <main class="page-shell page-shell--compact">
    <h1 class="sr-only">保存したコーデ</h1>

    <div v-if="loading" class="space-y-4" aria-label="コーデを読み込み中">
      <div v-for="index in 2" :key="index" class="h-72 animate-pulse rounded-2xl bg-neutral-200" />
    </div>
    <template v-else>
      <p v-if="errorMessage" role="alert" class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{{ errorMessage }}</p>
      <div class="flex items-center justify-between">
        <p class="text-xs text-neutral-500">保存したコーデ</p>
        <span class="text-xs text-neutral-400">{{ outfits.length }} リスト</span>
      </div>

      <div v-if="!outfits.length" class="surface-card mt-4 px-5 py-10 text-center">
        <AppIcon name="hanger" :size="32" class="mx-auto text-neutral-300" />
        <p class="mt-3 text-sm font-semibold">まだコーデがありません</p>
        <p class="mt-2 text-xs leading-6 text-neutral-500">アイテム詳細のハンガーボタンから、新しいコーデを作成できます。</p>
        <RouterLink to="/closet" class="secondary-button mt-5">クローゼットを見る<AppIcon name="arrow-right" :size="17" /></RouterLink>
      </div>

      <article v-for="outfit in visibleOutfits" :key="outfit.id" class="surface-card mt-4 p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-sm font-bold">コーデ{{ outfit.list_number }}</h2>
            <p class="mt-1 text-[11px] text-neutral-400">{{ savedDate(outfit.created_at) }}</p>
          </div>
          <button type="button" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50" :disabled="Boolean(deletingId)" :aria-label="`コーデ${outfit.list_number}を削除`" @click="remove(outfit)"><AppIcon name="trash" :size="17" /></button>
        </div>
        <p class="mt-1 text-[10px] text-neutral-400">{{ pieceSummary(outfit) }}</p>
        <div class="mt-3 grid grid-cols-3 gap-3">
          <div v-for="piece in outfit.pieces" :key="`${piece.role}-${piece.position}-${piece.item.id}`" class="min-w-0">
            <div class="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#ecece9]">
              <img v-if="piece.item.image_path && imageUrls[piece.item.image_path]" :src="imageUrls[piece.item.image_path]" :alt="piece.item.name" class="h-full w-full object-contain" loading="lazy" />
              <div v-else class="flex h-full items-center justify-center text-neutral-300"><AppIcon name="shirt" :size="35" /></div>
              <span class="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-1 text-[9px] font-semibold">{{ outfitRoleLabel(piece.role, piece.position) }}</span>
            </div>
            <RouterLink v-if="piece.item.is_active" :to="`/closet/${piece.item.id}`" class="mt-2 block truncate text-xs font-semibold text-neutral-900 underline-offset-2 hover:underline">{{ piece.item.name }}</RouterLink>
            <p v-else class="mt-2 truncate text-xs font-semibold text-neutral-500">{{ piece.item.name }} <span class="text-[10px]">（登録解除済み）</span></p>
          </div>
        </div>
      </article>
      <button v-if="visibleOutfits.length < outfits.length" type="button" class="secondary-button mt-4 w-full" @click="visibleCount += 10">さらに表示（{{ outfits.length - visibleOutfits.length }} リスト）</button>
    </template>
  </main>
</template>
