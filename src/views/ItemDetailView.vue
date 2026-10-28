<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { deleteClothing, getClothing, signedClothingImage } from '../lib/clothing'
import type { ClothingItem } from '../types/clothing'

const route = useRoute()
const router = useRouter()
const session = useSession()
const item = ref<ClothingItem | null>(null)
const imageUrl = ref<string | null>(null)
const loading = ref(true)
const deleting = ref(false)
const errorMessage = ref('')
const itemId = computed(() => String(route.params.id ?? ''))
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
    await router.replace('/closet')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '削除に失敗しました。'
  } finally {
    deleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="page-shell">
    <header class="mb-5 flex items-center justify-between">
      <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-800" aria-label="一覧に戻る" @click="router.push('/closet')"><AppIcon name="arrow-left" :size="20" /></button>
      <p class="eyebrow">ITEM DETAILS</p>
      <div class="w-10" />
    </header>

    <div v-if="loading" class="space-y-5" aria-label="読み込み中"><div class="aspect-[4/5] animate-pulse rounded-2xl bg-neutral-200" /><div class="h-6 w-2/3 animate-pulse rounded bg-neutral-200" /><div class="h-28 animate-pulse rounded-2xl bg-neutral-200" /></div>
    <div v-else-if="!item" class="surface-card px-6 py-10 text-center"><p role="alert" class="text-sm text-red-700">{{ errorMessage }}</p><button type="button" class="secondary-button mt-6" @click="router.push('/closet')">一覧に戻る</button></div>
    <template v-else>
      <div class="aspect-[4/5] overflow-hidden rounded-2xl bg-[#ecece9]">
        <img v-if="imageUrl" :src="imageUrl" :alt="item.name" class="h-full w-full object-cover" />
        <div v-else class="flex h-full flex-col items-center justify-center gap-3 text-neutral-300"><AppIcon name="shirt" :size="56" /><span class="text-xs">NO PHOTO</span></div>
      </div>

      <section class="mt-7">
        <p class="eyebrow">{{ item.brand }}</p>
        <h1 class="mt-2 text-[26px] font-bold leading-snug tracking-tight">{{ item.name }}</h1>
        <div class="mt-4 flex flex-wrap gap-2">
          <span class="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600">{{ item.category }}</span>
          <span class="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600">{{ item.color }}</span>
          <span v-if="item.size" class="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600">{{ item.size }}</span>
        </div>
      </section>

      <section class="surface-card mt-7 divide-y divide-neutral-100 px-5">
        <div class="flex items-start justify-between gap-5 py-4"><span class="shrink-0 text-xs text-neutral-400">ブランド</span><span class="text-right text-sm font-semibold">{{ item.brand }}</span></div>
        <div class="flex items-start justify-between gap-5 py-4"><span class="shrink-0 text-xs text-neutral-400">カテゴリ</span><span class="text-right text-sm font-semibold">{{ item.category }}</span></div>
        <div class="flex items-start justify-between gap-5 py-4"><span class="shrink-0 text-xs text-neutral-400">カラー</span><span class="text-right text-sm font-semibold">{{ item.color }}</span></div>
        <div v-if="item.size" class="flex items-start justify-between gap-5 py-4"><span class="shrink-0 text-xs text-neutral-400">サイズ</span><span class="text-right text-sm font-semibold">{{ item.size }}</span></div>
        <div v-if="item.seasons.length" class="flex items-start justify-between gap-5 py-4"><span class="shrink-0 text-xs text-neutral-400">季節</span><span class="text-right text-sm font-semibold">{{ item.seasons.join('・') }}</span></div>
        <div v-if="item.style_tags.length" class="flex items-start justify-between gap-5 py-4"><span class="shrink-0 text-xs text-neutral-400">スタイル</span><span class="text-right text-sm font-semibold">{{ item.style_tags.join('・') }}</span></div>
        <div v-if="item.product_code" class="flex items-start justify-between gap-5 py-4"><span class="shrink-0 text-xs text-neutral-400">商品番号</span><span class="break-all text-right text-sm font-semibold">{{ item.product_code }}</span></div>
        <div v-if="productLink" class="flex items-start justify-between gap-5 py-4"><span class="shrink-0 text-xs text-neutral-400">商品ページ</span><a :href="productLink" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 break-all text-right text-sm font-semibold text-neutral-900 underline underline-offset-4">リンクを開く<AppIcon name="arrow-right" :size="15" /></a></div>
      </section>

      <section v-if="item.memo" class="surface-card mt-4 p-5"><h2 class="text-xs font-semibold text-neutral-400">メモ</h2><p class="mt-3 whitespace-pre-wrap text-sm leading-7 text-neutral-700">{{ item.memo }}</p></section>
      <p v-if="errorMessage" role="alert" class="mt-5 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{{ errorMessage }}</p>

      <div class="mt-8 grid grid-cols-[1fr_auto] gap-3">
        <button type="button" class="primary-button" @click="router.push(`/closet/${item.id}/edit`)"><AppIcon name="edit" :size="18" />編集する</button>
        <button type="button" class="secondary-button px-4 text-red-600" :disabled="deleting" aria-label="洋服を削除" @click="remove"><AppIcon name="trash" :size="19" /></button>
      </div>
    </template>
  </main>
</template>
