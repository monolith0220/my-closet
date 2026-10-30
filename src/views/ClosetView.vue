<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { listClothing, signedClothingImages } from '../lib/clothing'
import { clothingSortOptions, sortClothing, type ClothingSort } from '../lib/clothing-display'
import { criteriaFromQuery, filterClothingItems } from '../lib/closet-search'
import type { ClothingItem } from '../types/clothing'

const route = useRoute()
const router = useRouter()
const session = useSession()
const items = ref<ClothingItem[]>([])
const imageUrls = ref<Record<string, string>>({})
const imageRequests = new Set<string>()
const loading = ref(true)
const errorMessage = ref('')
const addMenuOpen = ref(false)
const visibleCount = ref(32)
const loadMoreAnchor = ref<HTMLElement | null>(null)
let loadObserver: IntersectionObserver | null = null

function queryValue(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

const hasSearch = computed(() =>
  ['q', 'category', 'subcategory', 'sleeve', 'brand', 'color', 'favorites', 'sort']
    .some(key => route.query[key] !== undefined),
)

const filteredItems = computed(() => filterClothingItems(items.value, criteriaFromQuery(route.query)))

const sortedItems = computed(() => {
  const requestedSort = queryValue('sort')
  const sort = clothingSortOptions.some(option => option.value === requestedSort)
    ? requestedSort as ClothingSort
    : 'newest'
  return sortClothing(filteredItems.value, sort)
})
const visibleItems = computed(() => sortedItems.value.slice(0, visibleCount.value))

watch(() => route.query, () => { visibleCount.value = 32 })

watch(visibleItems, async visible => {
  const pending = visible.filter(item => item.image_path && !imageUrls.value[item.id] && !imageRequests.has(item.id))
  if (!pending.length) return
  for (const item of pending) imageRequests.add(item.id)
  try {
    const urls = await signedClothingImages(pending.map(item => item.image_path!))
    const byId: Record<string, string> = {}
    for (const item of pending) {
      if (item.image_path && urls[item.image_path]) byId[item.id] = urls[item.image_path]
    }
    imageUrls.value = { ...imageUrls.value, ...byId }
  } catch {
    // Item names and details remain available when a private image cannot be signed.
  } finally {
    for (const item of pending) imageRequests.delete(item.id)
  }
})

watch(loadMoreAnchor, (next, previous) => {
  if (previous) loadObserver?.unobserve(previous)
  if (next) loadObserver?.observe(next)
})

async function load() {
  const userId = session.value?.user.id
  if (!userId) return
  loading.value = true
  errorMessage.value = ''
  try {
    items.value = await listClothing(userId)
    imageUrls.value = {}
    visibleCount.value = 32
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '洋服を読み込めませんでした。'
  } finally {
    loading.value = false
  }
}

function openAdd(path: string) {
  addMenuOpen.value = false
  router.push(path)
}

onMounted(() => {
  loadObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && visibleCount.value < sortedItems.value.length) {
      visibleCount.value += 32
    }
  }, { rootMargin: '300px' })
  if (loadMoreAnchor.value) loadObserver.observe(loadMoreAnchor.value)
  void load()
})
onUnmounted(() => loadObserver?.disconnect())
</script>

<template>
  <main class="page-shell">
    <header class="mb-6 flex items-start justify-between gap-4">
      <div>
        <p class="eyebrow">MY WARDROBE</p>
        <h1 class="mt-2 text-[29px] font-bold tracking-tight">クローゼット</h1>
      </div>
      <div class="flex shrink-0 gap-2">
        <button type="button" class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-800" aria-label="検索画面を開く" @click="router.push({ path: '/search', query: route.query })"><AppIcon name="search" :size="20" /></button>
        <button type="button" class="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-950 text-white shadow-md shadow-neutral-900/10 transition hover:bg-neutral-700" aria-label="アイテムを追加" aria-controls="closet-add-menu" :aria-expanded="addMenuOpen" @click="addMenuOpen = !addMenuOpen"><AppIcon name="plus" :size="23" /></button>
      </div>
    </header>

    <div v-if="addMenuOpen" id="closet-add-menu" role="group" aria-label="追加方法" class="surface-card mb-5 space-y-1 p-2">
      <button type="button" class="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-neutral-100" @click="openAdd('/closet/new')">洋服を1着登録</button>
      <button type="button" class="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-neutral-100" @click="openAdd('/closet/import')">購入履歴からまとめて追加</button>
      <button type="button" class="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-neutral-100" @click="openAdd('/closet/photos/import')">購入履歴の写真を追加</button>
    </div>

    <p v-if="hasSearch && !loading" class="mb-4 text-xs text-neutral-500">検索結果 {{ sortedItems.length }} 着</p>

    <div v-if="loading" class="grid grid-cols-4 gap-2" aria-label="洋服を読み込み中">
      <div v-for="i in 8" :key="i" class="overflow-hidden rounded-xl bg-white"><div class="aspect-[4/5] animate-pulse bg-neutral-200" /><div class="h-3 animate-pulse bg-neutral-100" /></div>
    </div>
    <div v-else-if="errorMessage" role="alert" class="surface-card px-5 py-8 text-center">
      <p class="text-sm text-red-700">{{ errorMessage }}</p>
      <button type="button" class="secondary-button mt-5" @click="load">再読み込み</button>
    </div>
    <div v-else-if="sortedItems.length === 0" class="surface-card px-6 py-14 text-center">
      <AppIcon name="hanger" :size="30" class="mx-auto text-neutral-300" />
      <h2 class="mt-4 text-sm font-bold">{{ hasSearch ? '該当するアイテムがありません' : 'クローゼットはまだ空です' }}</h2>
      <p class="mt-2 text-xs text-neutral-500">{{ hasSearch ? '検索画面で条件を変えてください。' : '追加ボタンから最初の一着を登録できます。' }}</p>
    </div>
    <template v-else>
      <div class="grid grid-cols-4 gap-x-2 gap-y-4" aria-label="クローゼットのアイテム">
        <RouterLink v-for="item in visibleItems" :key="item.id" :to="{ path: `/closet/${item.id}`, query: route.query }" :title="item.name" class="block min-w-0" :aria-label="`${item.brand} ${item.name}の詳細を開く`">
          <div class="aspect-[4/5] overflow-hidden rounded-xl bg-[#ecece9]">
            <img v-if="imageUrls[item.id]" :src="imageUrls[item.id]" :alt="item.name" class="h-full w-full object-contain" loading="lazy" />
            <div v-else class="flex h-full flex-col items-center justify-center gap-1 text-neutral-300"><AppIcon name="shirt" :size="25" /><span class="text-[8px]">NO PHOTO</span></div>
          </div>
          <p class="mt-1 truncate text-[10px] font-medium text-neutral-700">{{ item.name }}</p>
        </RouterLink>
      </div>
      <div v-if="visibleItems.length < sortedItems.length" ref="loadMoreAnchor" class="h-px" aria-hidden="true" />
    </template>
  </main>
</template>
