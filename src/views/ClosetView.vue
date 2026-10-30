<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import SearchView from './SearchView.vue'
import { useSession } from '../lib/auth-context'
import { deleteClothing, listClothing, signedClothingImages } from '../lib/clothing'
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
const selectionMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const deletingSelected = ref(false)
const selectionError = ref('')
const selectionNotice = ref('')
const visibleCount = ref(32)
const loadMoreAnchor = ref<HTMLElement | null>(null)
let loadObserver: IntersectionObserver | null = null
let pressTimer: ReturnType<typeof setTimeout> | null = null
let pressStartX = 0
let pressStartY = 0
let suppressedClickId = ''

const selectedCount = computed(() => selectedIds.value.size)
const searchOpen = computed(() => route.query.search === '1')
const filterQueryKeys = ['q', 'category', 'subcategory', 'sleeve', 'brand', 'collection', 'color', 'favorites', 'sort'] as const
const filterQuerySignature = computed(() => JSON.stringify(filterQueryKeys.map(key => route.query[key])))

function clearPressTimer() {
  if (pressTimer) clearTimeout(pressTimer)
  pressTimer = null
}

function cancelSelection() {
  clearPressTimer()
  selectionMode.value = false
  selectedIds.value = new Set()
  selectionError.value = ''
}

function startSelection(id?: string) {
  if (deletingSelected.value) return
  selectionMode.value = true
  addMenuOpen.value = false
  selectedIds.value = id ? new Set([id]) : new Set()
  selectionError.value = ''
  selectionNotice.value = ''
}

function beginPress(event: PointerEvent, id: string) {
  // A new pointer gesture means a previous long press did not produce a click.
  suppressedClickId = ''
  if (selectionMode.value || deletingSelected.value || event.button !== 0) return
  clearPressTimer()
  pressStartX = event.clientX
  pressStartY = event.clientY
  pressTimer = setTimeout(() => {
    pressTimer = null
    startSelection(id)
    suppressedClickId = id
  }, 550)
}

function movePress(event: PointerEvent) {
  if (Math.abs(event.clientX - pressStartX) > 12 || Math.abs(event.clientY - pressStartY) > 12) clearPressTimer()
}

function toggleSelected(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
  selectionError.value = ''
}

function openItem(id: string) {
  const ignoreLongPressClick = suppressedClickId === id
  suppressedClickId = ''
  if (ignoreLongPressClick) return
  if (selectionMode.value) {
    if (!deletingSelected.value) toggleSelected(id)
    return
  }
  void router.push({ path: `/closet/${id}`, query: route.query })
}

function onContextMenu(id: string) {
  clearPressTimer()
  if (!selectionMode.value) {
    startSelection(id)
    suppressedClickId = id
  }
}

async function removeSelected() {
  const userId = session.value?.user.id
  const ids = [...selectedIds.value]
  if (!userId || !ids.length || deletingSelected.value) return
  if (!window.confirm(`選択した${ids.length}着をクローゼットから削除しますか？`)) return

  deletingSelected.value = true
  selectionError.value = ''
  selectionNotice.value = ''
  const succeeded: string[] = []
  const failed: string[] = []
  for (const id of ids) {
    try {
      await deleteClothing(id, userId)
      succeeded.push(id)
    } catch {
      failed.push(id)
    }
  }
  if (succeeded.length) {
    const removed = new Set(succeeded)
    items.value = items.value.filter(item => !removed.has(item.id))
    selectionNotice.value = `${succeeded.length}着を削除しました。`
  }
  if (failed.length) {
    selectedIds.value = new Set(failed)
    selectionError.value = `${failed.length}着を削除できませんでした。再度お試しください。`
  } else {
    cancelSelection()
  }
  deletingSelected.value = false
}

function queryValue(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

const hasSearch = computed(() => filterQueryKeys.some(key => route.query[key] !== undefined))

const filteredItems = computed(() => filterClothingItems(items.value, criteriaFromQuery(route.query)))

const sortedItems = computed(() => {
  const requestedSort = queryValue('sort')
  const sort = clothingSortOptions.some(option => option.value === requestedSort)
    ? requestedSort as ClothingSort
    : 'newest'
  return sortClothing(filteredItems.value, sort)
})
const visibleItems = computed(() => sortedItems.value.slice(0, visibleCount.value))

watch(filterQuerySignature, () => {
  visibleCount.value = 32
  cancelSelection()
})

function openSearch() {
  void router.push({ path: '/closet', query: { ...route.query, search: '1' } })
}

function closeSearch() {
  const query = { ...route.query }
  delete query.search
  void router.replace({ path: '/closet', query })
}

function applySearch(query: Record<string, string>) {
  void router.replace({ path: '/closet', query }).then(async () => {
    await nextTick()
    window.scrollTo(0, 0)
  })
}

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
    cancelSelection()
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
onUnmounted(() => {
  clearPressTimer()
  loadObserver?.disconnect()
})
</script>

<template>
  <main class="page-shell" :inert="searchOpen">
    <header class="mb-4 flex justify-end">
      <h1 class="sr-only">クローゼット</h1>
      <div class="flex shrink-0 gap-2">
        <button type="button" class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-800" aria-label="検索を開く" aria-controls="closet-search-dialog" aria-haspopup="dialog" :aria-expanded="searchOpen" @click="openSearch"><AppIcon name="search" :size="20" /></button>
        <button type="button" class="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-950 text-white shadow-md shadow-neutral-900/10 transition hover:bg-neutral-700" aria-label="アイテムを追加" aria-controls="closet-add-menu" :aria-expanded="addMenuOpen" @click="addMenuOpen = !addMenuOpen"><AppIcon name="plus" :size="23" /></button>
      </div>
    </header>

    <div v-if="addMenuOpen" id="closet-add-menu" role="group" aria-label="追加方法" class="surface-card mb-5 space-y-1 p-2">
      <button type="button" class="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-neutral-100" @click="openAdd('/closet/new')">洋服を1着登録</button>
      <button type="button" class="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-neutral-100" @click="openAdd('/closet/import')">購入履歴からまとめて追加</button>
      <button type="button" class="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-neutral-100" @click="openAdd('/closet/photos/import')">購入履歴の写真を追加</button>
    </div>

    <p v-if="hasSearch && !loading" class="mb-4 text-xs text-neutral-500">検索結果 {{ sortedItems.length }} 着</p>

    <div v-if="!loading && !errorMessage && sortedItems.length" class="mb-4">
      <div v-if="selectionMode" class="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3">
        <span class="mr-auto text-xs font-semibold">{{ selectedCount }} 着を選択中</span>
        <button type="button" class="min-h-10 rounded-lg px-3 text-xs font-semibold text-neutral-600" :disabled="deletingSelected" @click="cancelSelection">キャンセル</button>
        <button type="button" class="inline-flex min-h-10 items-center gap-1 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white disabled:opacity-40" :disabled="!selectedCount || deletingSelected" @click="removeSelected"><AppIcon name="trash" :size="15" />{{ deletingSelected ? '削除中...' : `${selectedCount} 着を削除` }}</button>
      </div>
      <button v-else type="button" class="flex min-h-9 items-center gap-1 text-xs font-semibold text-neutral-500" @click="startSelection()"><AppIcon name="check" :size="15" />複数選択</button>
      <p v-if="selectionError" role="alert" class="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{{ selectionError }}</p>
      <p v-if="selectionNotice" role="status" class="mt-2 text-xs text-neutral-600">{{ selectionNotice }}</p>
    </div>

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
        <button v-for="item in visibleItems" :key="item.id" type="button" :title="item.name" class="block min-w-0 select-none text-left touch-pan-y" :disabled="deletingSelected" :aria-label="selectionMode ? `${item.name}を${selectedIds.has(item.id) ? '選択解除' : '選択'}` : `${item.brand} ${item.name}の詳細を開く`" :aria-pressed="selectionMode ? selectedIds.has(item.id) : undefined" @pointerdown="beginPress($event, item.id)" @pointermove="movePress" @pointerup="clearPressTimer" @pointercancel="clearPressTimer" @pointerleave="clearPressTimer" @contextmenu.prevent="onContextMenu(item.id)" @click="openItem(item.id)">
          <div class="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#ecece9]" :class="selectionMode && selectedIds.has(item.id) ? 'ring-2 ring-neutral-950 ring-offset-1' : ''">
            <img v-if="imageUrls[item.id]" :src="imageUrls[item.id]" :alt="item.name" class="h-full w-full object-contain" loading="lazy" />
            <div v-else class="flex h-full flex-col items-center justify-center gap-1 text-neutral-300"><AppIcon name="shirt" :size="25" /><span class="text-[8px]">NO PHOTO</span></div>
            <span v-if="selectionMode" class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-950" aria-hidden="true"><AppIcon v-if="selectedIds.has(item.id)" name="check" :size="13" /></span>
          </div>
          <p class="mt-1 truncate text-[10px] font-medium text-neutral-700">{{ item.name }}</p>
        </button>
      </div>
      <div v-if="visibleItems.length < sortedItems.length" ref="loadMoreAnchor" class="h-px" aria-hidden="true" />
    </template>
  </main>
  <SearchView v-if="searchOpen" :items="items" :loading="loading" :error-message="errorMessage" @close="closeSearch" @apply="applySearch" @retry="load" />
</template>
