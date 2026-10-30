<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { clothingSortOptions, type ClothingSort } from '../lib/clothing-display'
import { closetGroups, type ClosetGroup } from '../lib/closet-groups'
import { closetSubcategories } from '../lib/closet-subcategories'
import { criteriaFromQuery, filterClothingItems, type SleeveFilter } from '../lib/closet-search'
import { uniqloCollections } from '../lib/uniqlo-collection'
import { colors, type ClothingItem } from '../types/clothing'

const route = useRoute()
const props = defineProps<{
  items: ClothingItem[]
  loading: boolean
  errorMessage: string
}>()
const emit = defineEmits<{
  close: []
  apply: [query: Record<string, string>]
  retry: []
}>()
const closeButton = ref<HTMLButtonElement | null>(null)

const initial = criteriaFromQuery(route.query)
const search = ref(initial.q)
const category = ref<ClosetGroup | ''>(initial.category)
const subcategory = ref(initial.category && (closetSubcategories[initial.category] as readonly string[]).includes(initial.subcategory)
  ? initial.subcategory : '')
const sleeve = ref<SleeveFilter>(initial.sleeve)
const brand = ref(initial.brand)
const collection = ref(initial.collection)
const color = ref(initial.color)
const favorites = ref(initial.favorites)
const sort = ref<ClothingSort>(clothingSortOptions.some(option => option.value === route.query.sort)
  ? route.query.sort as ClothingSort : 'newest')

const brands = computed(() => [...new Set(props.items.map(item => item.brand).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'ja')))
const subcategories = computed(() => category.value ? closetSubcategories[category.value] : [])
const results = computed(() => filterClothingItems(props.items, {
  q: search.value,
  category: category.value,
  subcategory: subcategory.value,
  sleeve: sleeve.value,
  brand: brand.value,
  collection: collection.value,
  color: color.value,
  favorites: favorites.value,
}))

watch(() => route.query, query => {
  const criteria = criteriaFromQuery(query)
  search.value = criteria.q
  category.value = criteria.category
  subcategory.value = criteria.category && (closetSubcategories[criteria.category] as readonly string[]).includes(criteria.subcategory)
    ? criteria.subcategory : ''
  sleeve.value = criteria.category === 'トップス' ? criteria.sleeve : 'すべて'
  brand.value = criteria.brand
  collection.value = criteria.collection
  color.value = criteria.color
  favorites.value = criteria.favorites
  sort.value = clothingSortOptions.some(option => option.value === query.sort)
    ? query.sort as ClothingSort : 'newest'
})

function changeCategory() {
  subcategory.value = ''
  sleeve.value = 'すべて'
}

function clearFilters() {
  search.value = ''
  category.value = ''
  subcategory.value = ''
  sleeve.value = 'すべて'
  brand.value = ''
  collection.value = ''
  color.value = ''
  favorites.value = false
  sort.value = 'newest'
}

function showResults() {
  if (props.loading || props.errorMessage || !results.value.length) return
  const query: Record<string, string> = {}
  if (search.value.trim()) query.q = search.value.trim()
  if (category.value) query.category = category.value
  if (subcategory.value) query.subcategory = subcategory.value
  if (category.value === 'トップス' && sleeve.value !== 'すべて') query.sleeve = sleeve.value
  if (brand.value) query.brand = brand.value
  if (collection.value) query.collection = collection.value
  if (color.value) query.color = color.value
  if (favorites.value) query.favorites = '1'
  if (sort.value !== 'newest') query.sort = sort.value
  emit('apply', query)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

let previousBodyOverflow = ''
onMounted(() => {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKeydown)
  closeButton.value?.focus({ preventScroll: true })
})
onUnmounted(() => {
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="fixed inset-x-0 top-0 z-20 flex justify-center bg-neutral-950/40 px-3 pb-3" style="bottom: calc(66px + env(safe-area-inset-bottom, 0px)); padding-top: calc(12px + env(safe-area-inset-top, 0px))" @click.self="emit('close')">
    <div id="closet-search-dialog" role="dialog" aria-label="検索" class="h-full min-h-0 w-full max-w-[560px] overflow-y-auto overscroll-contain rounded-2xl bg-[#f7f7f5] shadow-2xl">
      <div class="px-5 pb-6 pt-4">
        <header class="sticky top-0 z-10 -mx-5 -mt-4 mb-3 flex justify-end bg-[#f7f7f5] px-5 pb-2 pt-4">
          <button ref="closeButton" type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-neutral-700 outline-none focus-visible:ring-2 focus-visible:ring-neutral-300" aria-label="検索を閉じる" @click="emit('close')"><AppIcon name="close" :size="20" /></button>
        </header>

        <div class="relative">
          <AppIcon name="search" :size="19" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input v-model="search" type="search" class="field-input pl-11" placeholder="商品名・ブランド・色で検索" aria-label="洋服を検索" />
        </div>

        <section class="surface-card mt-4 p-4" aria-label="検索条件">
          <div class="grid grid-cols-2 gap-3">
            <div><label for="search-category" class="field-label">大分類</label><select id="search-category" v-model="category" class="field-select" @change="changeCategory"><option value="">すべて</option><option v-for="choice in closetGroups" :key="choice" :value="choice">{{ choice }}</option></select></div>
            <div><label for="search-subcategory" class="field-label">小分類</label><select id="search-subcategory" v-model="subcategory" class="field-select" :disabled="!category"><option value="">すべて</option><option v-for="choice in subcategories" :key="choice" :value="choice">{{ choice }}</option></select></div>
            <div><label for="search-brand" class="field-label">ブランド</label><select id="search-brand" v-model="brand" class="field-select"><option value="">すべて</option><option v-for="choice in brands" :key="choice" :value="choice">{{ choice }}</option></select></div>
            <div><label for="search-color" class="field-label">カラー</label><select id="search-color" v-model="color" class="field-select"><option value="">すべて</option><option v-for="choice in colors" :key="choice" :value="choice">{{ choice }}</option></select></div>
          </div>
          <div class="mt-3"><label for="search-collection" class="field-label">ユニクロライン</label><select id="search-collection" v-model="collection" class="field-select"><option value="">すべて</option><option v-for="choice in uniqloCollections" :key="choice" :value="choice">{{ choice }}</option></select></div>
          <div v-if="category === 'トップス'" class="mt-3"><label for="search-sleeve" class="field-label">袖丈</label><select id="search-sleeve" v-model="sleeve" class="field-select"><option value="すべて">すべて</option><option value="半袖">半袖</option><option value="長袖">長袖</option><option value="不明">不明</option></select></div>
          <label class="mt-4 inline-flex min-h-11 items-center gap-3 text-xs font-semibold text-neutral-700"><input v-model="favorites" type="checkbox" class="h-4 w-4 accent-neutral-950" />お気に入りのみ</label>
          <button type="button" class="text-button mt-2 block text-xs" @click="clearFilters">条件をクリア</button>
        </section>

        <section class="surface-card mt-5 p-4" aria-label="表示設定">
          <label for="search-sort" class="field-label">並び順</label>
          <select id="search-sort" v-model="sort" class="field-select"><option v-for="choice in clothingSortOptions" :key="choice.value" :value="choice.value">{{ choice.label }}</option></select>
        </section>

        <section class="sticky bottom-0 z-10 -mx-5 mt-6 border-t border-neutral-200 bg-[#f7f7f5] px-5 py-4 text-center" aria-label="検索結果">
          <p v-if="loading" class="text-sm text-neutral-500">読み込み中...</p>
          <div v-else-if="errorMessage" role="alert" class="surface-card px-5 py-8"><p class="text-sm text-red-700">{{ errorMessage }}</p><button type="button" class="secondary-button mt-5" @click="emit('retry')">再読み込み</button></div>
          <template v-else>
            <p class="text-sm font-semibold">{{ results.length }} 着が該当します</p>
            <p v-if="!results.length" class="mt-2 text-xs text-neutral-500">条件を変えて検索してください。</p>
            <button type="button" class="primary-button mt-4 w-full" :disabled="!results.length" @click="showResults">{{ results.length }} 着をクローゼットに表示<AppIcon name="arrow-right" :size="17" /></button>
          </template>
        </section>
      </div>
    </div>
  </div>
</template>
