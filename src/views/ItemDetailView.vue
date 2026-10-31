<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { deleteClothing, getClothing, recordClothingView, setClothingFavorite, setClothingRating, signedClothingImage } from '../lib/clothing'
import { formatClothingSize, purchaseDateFor, stripPurchaseDateFromMemo } from '../lib/clothing-display'
import { closetGroupFor } from '../lib/closet-groups'
import { closetSubcategoryFor } from '../lib/closet-subcategories'
import type { ClothingItem } from '../types/clothing'

const route = useRoute()
const router = useRouter()
const session = useSession()
const item = ref<ClothingItem | null>(null)
const imageUrl = ref<string | null>(null)
const loading = ref(true)
const deleting = ref(false)
const favoriteBusy = ref(false)
const ratingBusy = ref(false)
const errorMessage = ref('')
const itemId = computed(() => String(route.params.id ?? ''))
const returnLocation = computed(() => route.query.from === 'ai'
  ? { path: '/ai' }
  : { path: '/closet', query: route.query })
const ratingOptions = [1, 2, 3, 4, 5] as const
const itemCategoryGroup = computed(() => item.value ? closetGroupFor(item.value) : 'その他')
const itemSubcategory = computed(() => item.value ? closetSubcategoryFor(item.value, itemCategoryGroup.value) : 'その他')
const canSelectForOutfit = computed(() => ['トップス', 'アウター', 'ボトムス'].includes(itemCategoryGroup.value))
const purchaseDate = computed(() => item.value ? purchaseDateFor(item.value)?.replaceAll('-', '/') ?? null : null)
const visibleMemo = computed(() => stripPurchaseDateFromMemo(item.value?.memo ?? null) || null)
const productLink = computed(() => {
  const raw = item.value?.product_url
  if (!raw) return null
  try {
    const url = new URL(raw)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch { return null }
})

async function load() {
  const userId = session.value?.user.id
  if (!userId) return
  loading.value = true
  errorMessage.value = ''
  try {
    item.value = await getClothing(itemId.value, userId)
    try { item.value.view_count = await recordClothingView(item.value.id) } catch { /* Viewing still works if the private counter is temporarily unavailable. */ }
    if (item.value.image_path) {
      try { imageUrl.value = await signedClothingImage(item.value.image_path) } catch { imageUrl.value = null }
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '洋服を読み込めませんでした。'
  } finally {
    loading.value = false
  }
}

async function remove() {
  const userId = session.value?.user.id
  if (!userId || !item.value || deleting.value) return
  if (!window.confirm(`「${item.value.name}」をクローゼットから削除しますか？`)) return
  deleting.value = true
  errorMessage.value = ''
  try {
    await deleteClothing(item.value.id, userId)
    await router.replace(returnLocation.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '削除に失敗しました。'
  } finally {
    deleting.value = false
  }
}

async function toggleFavorite() {
  const userId = session.value?.user.id
  if (!userId || !item.value || favoriteBusy.value) return
  favoriteBusy.value = true
  errorMessage.value = ''
  try {
    await setClothingFavorite(item.value.id, userId, !item.value.is_favorite)
    item.value.is_favorite = !item.value.is_favorite
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'お気に入りを保存できませんでした。'
  } finally {
    favoriteBusy.value = false
  }
}

async function setRating(value: number) {
  const userId = session.value?.user.id
  if (!userId || !item.value || ratingBusy.value) return
  ratingBusy.value = true
  errorMessage.value = ''
  try {
    await setClothingRating(item.value.id, userId, value)
    item.value.rating = value
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'お気に入り度を保存できませんでした。'
  } finally {
    ratingBusy.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="page-shell">
    <header class="mb-5 flex items-center justify-between">
      <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-800" :aria-label="route.query.from === 'ai' ? '提案に戻る' : '一覧に戻る'" @click="router.push(returnLocation)"><AppIcon name="arrow-left" :size="20" /></button>
      <p class="eyebrow">ITEM DETAILS</p>
      <button v-if="item" type="button" class="flex h-10 w-10 items-center justify-center rounded-full bg-white" :class="item.is_favorite ? 'text-rose-600' : 'text-neutral-500'" :aria-label="item.is_favorite ? 'お気に入りから外す' : 'お気に入りに追加する'" :aria-pressed="item.is_favorite" :disabled="favoriteBusy" @click="toggleFavorite"><AppIcon name="heart" :size="20" :filled="item.is_favorite" /></button>
      <div v-else class="w-10" />
    </header>

    <div v-if="loading" class="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[136px_minmax(0,1fr)]" aria-label="読み込み中">
      <div class="aspect-[4/5] animate-pulse rounded-2xl bg-neutral-200" />
      <div class="space-y-4 pt-1"><div class="h-3 w-1/3 animate-pulse rounded bg-neutral-200" /><div class="h-6 w-full animate-pulse rounded bg-neutral-200" /><div v-for="i in 4" :key="i" class="h-8 animate-pulse rounded bg-neutral-100" /></div>
    </div>
      <div v-else-if="!item" class="surface-card px-6 py-10 text-center"><p role="alert" class="text-sm text-red-700">{{ errorMessage }}</p><button type="button" class="secondary-button mt-6" @click="router.push(returnLocation)">戻る</button></div>
    <template v-else>
      <section class="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[136px_minmax(0,1fr)]" aria-label="アイテムの詳細">
        <div class="aspect-[4/5] overflow-hidden rounded-2xl bg-[#ecece9]">
          <img v-if="imageUrl" :src="imageUrl" :alt="item.name" class="h-full w-full object-contain" />
          <div v-else class="flex h-full flex-col items-center justify-center gap-2 text-neutral-300"><AppIcon name="shirt" :size="36" /><span class="text-[10px]">NO PHOTO</span></div>
        </div>
        <div class="min-w-0">
          <p class="eyebrow">{{ item.brand }}</p>
          <h1 class="mt-2 break-words text-lg font-bold leading-snug tracking-tight sm:text-xl">{{ item.name }}</h1>
          <dl class="mt-4 divide-y divide-neutral-200">
            <div class="py-2"><dt class="text-[11px] text-neutral-400">大分類</dt><dd class="mt-0.5 break-words text-sm font-semibold">{{ itemCategoryGroup }}</dd></div>
            <div class="py-2"><dt class="text-[11px] text-neutral-400">小分類</dt><dd class="mt-0.5 break-words text-sm font-semibold">{{ itemSubcategory }}</dd></div>
            <div v-if="item.collection" class="py-2"><dt class="text-[11px] text-neutral-400">ユニクロライン</dt><dd class="mt-0.5 break-words text-sm font-semibold">{{ item.collection }}</dd></div>
            <div class="py-2"><dt class="text-[11px] text-neutral-400">カラー</dt><dd class="mt-0.5 break-words text-sm font-semibold">{{ item.color }}</dd></div>
            <div v-if="item.size" class="py-2"><dt class="text-[11px] text-neutral-400">サイズ</dt><dd class="mt-0.5 break-words text-sm font-semibold">{{ formatClothingSize(item.size) }}</dd></div>
            <div v-if="purchaseDate" class="py-2"><dt class="text-[11px] text-neutral-400">購入日</dt><dd class="mt-0.5 text-sm font-semibold">{{ purchaseDate }}</dd></div>
            <div v-if="item.seasons.length" class="py-2"><dt class="text-[11px] text-neutral-400">季節</dt><dd class="mt-0.5 break-words text-sm font-semibold">{{ item.seasons.join('・') }}</dd></div>
            <div v-if="item.style_tags.length" class="py-2"><dt class="text-[11px] text-neutral-400">スタイル</dt><dd class="mt-0.5 break-words text-sm font-semibold">{{ item.style_tags.join('・') }}</dd></div>
            <div v-if="productLink" class="py-2"><dt class="text-[11px] text-neutral-400">商品ページ</dt><dd class="mt-0.5"><a :href="productLink" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-sm font-semibold text-neutral-900 underline underline-offset-4">リンクを開く<AppIcon name="arrow-right" :size="15" /></a></dd></div>
          </dl>
        </div>
      </section>

      <section class="surface-card mt-4 p-4" aria-label="お気に入り度">
        <div class="flex items-center justify-between"><h2 class="text-sm font-bold">お気に入り度</h2><span class="text-xs text-neutral-500" aria-live="polite">{{ item.rating ? `${item.rating} / 5` : '未評価' }}</span></div>
        <div class="mt-2 flex items-center gap-1" role="group" aria-label="お気に入り度を設定">
          <button v-for="value in ratingOptions" :key="value" type="button" class="flex h-11 w-11 items-center justify-center rounded-lg text-[30px] leading-none transition hover:bg-amber-50 disabled:opacity-50" :class="value <= item.rating ? 'text-amber-500' : 'text-neutral-300'" :aria-label="`${value}つ星に設定`" :aria-pressed="item.rating === value" :disabled="ratingBusy" @click="setRating(value)">{{ value <= item.rating ? '★' : '☆' }}</button>
        </div>
        <button v-if="item.rating" type="button" class="mt-1 text-xs font-semibold text-neutral-500 underline" :disabled="ratingBusy" @click="setRating(0)">評価を消す</button>
      </section>

      <section v-if="visibleMemo" class="surface-card mt-4 p-5"><h2 class="text-xs font-semibold text-neutral-400">メモ</h2><p class="mt-3 whitespace-pre-wrap text-sm leading-7 text-neutral-700">{{ visibleMemo }}</p></section>
      <p v-if="errorMessage" role="alert" class="mt-5 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{{ errorMessage }}</p>

      <RouterLink v-if="canSelectForOutfit" :to="{ path: '/outfits', query: { clothing_id: item.id } }" class="secondary-button mt-8 w-full"><AppIcon name="hanger" :size="18" />コーデに選ぶ</RouterLink>
      <div class="mt-3 grid grid-cols-[1fr_auto] gap-3">
        <button type="button" class="primary-button" @click="router.push({ path: `/closet/${item.id}/edit`, query: route.query })"><AppIcon name="edit" :size="18" />編集する</button>
        <button type="button" class="secondary-button px-4 text-red-600" :disabled="deleting" aria-label="洋服を削除" @click="remove"><AppIcon name="trash" :size="19" /></button>
      </div>
    </template>
  </main>
</template>
