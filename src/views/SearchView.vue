<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { listClothing, signedClothingImages } from '../lib/clothing'
import { clothingSortOptions, formatClothingSize, sortClothing, type ClothingSort } from '../lib/clothing-display'
import { closetGroupFor, closetGroups, type ClosetGroup } from '../lib/closet-groups'
import { closetSubcategories, closetSubcategoryFor } from '../lib/closet-subcategories'
import { sleeveLengthFor, type SleeveLength } from '../lib/sleeve-length'
import type { ClothingItem } from '../types/clothing'
import { colors } from '../types/clothing'

const session = useSession()
const items = ref<ClothingItem[]>([])
const imageUrls = ref<Record<string, string>>({})
const imageRequests = new Set<string>()
const loading = ref(true)
const errorMessage = ref('')
const search = ref('')
const category = ref<ClosetGroup | ''>('')
const subcategory = ref('')
type SleeveFilter = SleeveLength | 'すべて' | '不明'
const sleeveFilter = ref<SleeveFilter>('すべて')
const brand = ref('')
const color = ref('')
const favoritesOnly = ref(false)
const sortOrder = ref<ClothingSort>('newest')
const visibleCount = ref(32)

const brands = computed(() => [...new Set(items.value.map(item => item.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')))
const subcategories = computed(() => category.value ? closetSubcategories[category.value] : [])
const filteredItems = computed(() => {
  const term = search.value.trim().normalize('NFKC').toLocaleLowerCase()
  return items.value.filter(item => {
    const group = closetGroupFor(item)
    const small = closetSubcategoryFor(item, group)
    const text = [item.name, item.brand, item.category, group, small, item.color, item.size ?? '', item.product_code ?? ''].join(' ').normalize('NFKC').toLocaleLowerCase()
    return (!term || text.includes(term)) &&
      (!category.value || group === category.value) &&
      (!subcategory.value || small === subcategory.value) &&
      (category.value !== 'トップス' || sleeveFilter.value === 'すべて' || (sleeveLengthFor(item) ?? '不明') === sleeveFilter.value) &&
      (!brand.value || item.brand === brand.value) &&
      (!color.value || item.color === color.value) &&
      (!favoritesOnly.value || item.is_favorite)
  })
})
const sortedItems = computed(() => sortClothing(filteredItems.value, sortOrder.value))
const visibleItems = computed(() => sortedItems.value.slice(0, visibleCount.value))

watch(category, () => {
  subcategory.value = ''
  sleeveFilter.value = 'すべて'
})
watch([search, category, subcategory, sleeveFilter, brand, color, favoritesOnly, sortOrder], () => { visibleCount.value = 32 })

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
    // Search results remain usable when an image cannot be signed.
  } finally {
    for (const item of pending) imageRequests.delete(item.id)
  }
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

function clearFilters() {
  search.value = ''
  category.value = ''
  subcategory.value = ''
  sleeveFilter.value = 'すべて'
  brand.value = ''
  color.value = ''
  favoritesOnly.value = false
  sortOrder.value = 'newest'
}

onMounted(load)
</script>

<template>
  <main class="page-shell">
    <header class="mb-7">
      <p class="eyebrow">FIND YOUR CLOTHES</p>
      <h1 class="mt-2 text-[29px] font-bold tracking-tight">検索</h1>
      <p class="mt-2 text-xs text-neutral-500">クローゼットから洋服を探す</p>
    </header>

    <div class="relative">
      <AppIcon name="search" :size="19" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input v-model="search" type="search" class="field-input pl-11" placeholder="商品名・ブランド・色で検索" aria-label="洋服を検索" />
    </div>

    <section class="surface-card mt-4 p-4" aria-label="検索条件">
      <div class="grid grid-cols-2 gap-3">
        <div><label for="search-category" class="field-label">大分類</label><select id="search-category" v-model="category" class="field-select"><option value="">すべて</option><option v-for="choice in closetGroups" :key="choice" :value="choice">{{ choice }}</option></select></div>
        <div><label for="search-subcategory" class="field-label">小分類</label><select id="search-subcategory" v-model="subcategory" class="field-select" :disabled="!category"><option value="">すべて</option><option v-for="choice in subcategories" :key="choice" :value="choice">{{ choice }}</option></select></div>
        <div><label for="search-brand" class="field-label">ブランド</label><select id="search-brand" v-model="brand" class="field-select"><option value="">すべて</option><option v-for="choice in brands" :key="choice" :value="choice">{{ choice }}</option></select></div>
        <div><label for="search-color" class="field-label">カラー</label><select id="search-color" v-model="color" class="field-select"><option value="">すべて</option><option v-for="choice in colors" :key="choice" :value="choice">{{ choice }}</option></select></div>
      </div>
      <div v-if="category === 'トップス'" class="mt-3"><label for="search-sleeve" class="field-label">袖丈</label><select id="search-sleeve" v-model="sleeveFilter" class="field-select"><option value="すべて">すべて</option><option value="半袖">半袖</option><option value="長袖">長袖</option><option value="不明">不明</option></select></div>
      <label class="mt-4 inline-flex min-h-11 items-center gap-3 text-xs font-semibold text-neutral-700"><input v-model="favoritesOnly" type="checkbox" class="h-4 w-4 accent-neutral-950" />お気に入りのみ</label>
      <button type="button" class="text-button mt-2 block text-xs" @click="clearFilters">条件をクリア</button>
    </section>

    <div class="mb-3 mt-7 flex items-end justify-between gap-3">
      <div><h2 class="text-sm font-bold">検索結果</h2><p class="mt-1 text-xs text-neutral-500">{{ loading ? '読み込み中...' : `${sortedItems.length} 着` }}</p></div>
      <div class="min-w-[140px]"><label for="search-sort" class="mb-1 block text-[10px] text-neutral-500">並び順</label><select id="search-sort" v-model="sortOrder" class="field-select py-2 text-xs"><option v-for="choice in clothingSortOptions" :key="choice.value" :value="choice.value">{{ choice.label }}</option></select></div>
    </div>

    <div v-if="loading" class="grid grid-cols-4 gap-1.5" aria-label="検索結果を読み込み中"><div v-for="i in 8" :key="i" class="aspect-[4/5] animate-pulse rounded-lg bg-neutral-200" /></div>
    <div v-else-if="errorMessage" role="alert" class="surface-card px-5 py-8 text-center"><p class="text-sm text-red-700">{{ errorMessage }}</p><button type="button" class="secondary-button mt-5" @click="load">再読み込み</button></div>
    <div v-else-if="!sortedItems.length" class="surface-card px-6 py-12 text-center"><p class="text-sm font-semibold">洋服が見つかりません</p><p class="mt-2 text-xs text-neutral-500">検索条件を変えてみてください。</p><button type="button" class="secondary-button mt-5" @click="clearFilters">条件をクリア</button></div>
    <template v-else>
      <div class="grid grid-cols-4 gap-x-1.5 gap-y-3 sm:gap-x-2" aria-label="検索結果のアイテム">
        <RouterLink v-for="item in visibleItems" :key="item.id" :to="`/closet/${item.id}`" :aria-label="`${item.brand} ${item.name} ${item.color} ${formatClothingSize(item.size)}`" class="group min-w-0">
          <div class="relative aspect-[4/5] overflow-hidden rounded-lg bg-[#ecece9]">
            <img v-if="imageUrls[item.id]" :src="imageUrls[item.id]" :alt="item.name" class="h-full w-full object-contain" loading="lazy" />
            <div v-else class="flex h-full items-center justify-center text-neutral-300"><AppIcon name="shirt" :size="24" /></div>
            <span v-if="item.is_favorite" aria-hidden="true" class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/95 text-[11px] text-red-500">♥</span>
          </div>
          <p class="mt-1 line-clamp-2 min-h-8 break-words text-[10px] font-semibold leading-4 text-neutral-800">{{ item.name }}</p>
          <p v-if="item.size" class="mt-0.5 truncate text-[9px] text-neutral-500">{{ formatClothingSize(item.size) }}</p>
        </RouterLink>
      </div>
      <button v-if="visibleItems.length < sortedItems.length" type="button" class="secondary-button mt-5 w-full" @click="visibleCount += 32">さらに表示（{{ sortedItems.length - visibleItems.length }} 件）</button>
    </template>
  </main>
</template>
