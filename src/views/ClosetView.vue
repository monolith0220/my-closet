<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { listClothing, setClothingFavorite, signedClothingImages } from '../lib/clothing'
import { clothingSortOptions, sortClothing, type ClothingSort } from '../lib/clothing-display'
import { closetGroupFor, closetGroups, type ClosetGroup } from '../lib/closet-groups'
import { closetSubcategories, closetSubcategoryFor } from '../lib/closet-subcategories'
import { sleeveLengthFor, type SleeveLength } from '../lib/sleeve-length'
import type { ClothingItem } from '../types/clothing'

const router = useRouter()
const session = useSession()
const items = ref<ClothingItem[]>([])
const imageUrls = ref<Record<string, string>>({})
const loading = ref(true)
const errorMessage = ref('')
const favoriteError = ref('')
const sortOrder = ref<ClothingSort>('newest')
const favoritesOnly = ref(false)
const activeGroup = ref<ClosetGroup | null>('アウター')
const activeSubcategory = ref('すべて')
type SleeveFilter = SleeveLength | 'すべて' | '不明'
const sleeveFilter = ref<SleeveFilter>('すべて')
const visibleCountByGroup = reactive<Record<ClosetGroup, number>>({
  アウター: 32,
  トップス: 32,
  ボトムス: 32,
  レッグウェア: 32,
  アクセサリー: 32,
  その他: 32,
})
const imageRequests = new Set<string>()
const favoriteBusy = reactive<Record<string, boolean>>({})

const filteredItems = computed(() => sortClothing(items.value.filter(item => !favoritesOnly.value || item.is_favorite), sortOrder.value))
const groupedItems = computed(() => closetGroups.map(name => ({
  name,
  items: filteredItems.value.filter(item => closetGroupFor(item) === name),
})))
const activeGroupItems = computed(() => groupedItems.value.find(group => group.name === activeGroup.value)?.items ?? [])
const subcategoryOptions = computed(() => activeGroup.value ? [
  { name: 'すべて', count: activeGroupItems.value.length },
  ...closetSubcategories[activeGroup.value].map(name => ({
    name,
    count: activeGroupItems.value.filter(item => closetSubcategoryFor(item, activeGroup.value!) === name).length,
  })),
] : [])
const activeSubcategoryItems = computed(() => activeSubcategory.value === 'すべて'
  ? activeGroupItems.value
  : activeGroupItems.value.filter(item => closetSubcategoryFor(item, activeGroup.value!) === activeSubcategory.value))
const sleeveOptions = computed<Array<{ name: SleeveFilter; count: number }>>(() => [
  { name: 'すべて', count: activeSubcategoryItems.value.length },
  ...(['半袖', '長袖', '不明'] as const).map(name => ({
    name,
    count: activeSubcategoryItems.value.filter(item => (sleeveLengthFor(item) ?? '不明') === name).length,
  })),
])
const displayItems = computed(() => activeGroup.value === 'トップス' && sleeveFilter.value !== 'すべて'
  ? activeSubcategoryItems.value.filter(item => (sleeveLengthFor(item) ?? '不明') === sleeveFilter.value)
  : activeSubcategoryItems.value)
const visibleItems = computed(() => activeGroup.value ? displayItems.value.slice(0, visibleCountByGroup[activeGroup.value]) : [])

watch([favoritesOnly, sortOrder], () => {
  for (const group of closetGroups) visibleCountByGroup[group] = 32
  if (!activeGroup.value || !activeGroupItems.value.length) {
    activeGroup.value = groupedItems.value.find(group => group.items.length)?.name ?? null
    activeSubcategory.value = 'すべて'
    sleeveFilter.value = 'すべて'
  } else if (!activeSubcategoryItems.value.length) {
    activeSubcategory.value = 'すべて'
    sleeveFilter.value = 'すべて'
  } else if (!displayItems.value.length) {
    sleeveFilter.value = 'すべて'
  }
})

function toggleGroup(group: ClosetGroup) {
  activeGroup.value = activeGroup.value === group ? null : group
  activeSubcategory.value = 'すべて'
  sleeveFilter.value = 'すべて'
  visibleCountByGroup[group] = 32
}

function toggleSubcategory(name: string) {
  activeSubcategory.value = activeSubcategory.value === name ? 'すべて' : name
  if (activeGroup.value) visibleCountByGroup[activeGroup.value] = 32
  if (!displayItems.value.length) sleeveFilter.value = 'すべて'
}

function toggleSleeve(name: SleeveFilter) {
  sleeveFilter.value = sleeveFilter.value === name ? 'すべて' : name
  if (activeGroup.value) visibleCountByGroup[activeGroup.value] = 32
}

function showMoreActiveGroup() {
  if (activeGroup.value) visibleCountByGroup[activeGroup.value] += 32
}

async function toggleFavorite(item: ClothingItem) {
  const userId = session.value?.user.id
  if (!userId || favoriteBusy[item.id]) return
  favoriteBusy[item.id] = true
  favoriteError.value = ''
  try {
    await setClothingFavorite(item.id, userId, !item.is_favorite)
    item.is_favorite = !item.is_favorite
  } catch (error) {
    favoriteError.value = error instanceof Error ? error.message : 'お気に入りを保存できませんでした。'
  } finally {
    favoriteBusy[item.id] = false
  }
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
    // The list remains usable when an image link cannot be signed.
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
    for (const group of closetGroups) visibleCountByGroup[group] = 32
    if (!activeGroup.value || !activeGroupItems.value.length) {
      activeGroup.value = groupedItems.value.find(group => group.items.length)?.name ?? null
    }
    activeSubcategory.value = 'すべて'
    sleeveFilter.value = 'すべて'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '洋服を読み込めませんでした。'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="page-shell">
    <header class="mb-8 flex items-start justify-between gap-4">
      <div>
        <p class="eyebrow">MY WARDROBE</p>
        <h1 class="mt-2 text-[29px] font-bold tracking-tight">クローゼット</h1>
        <p class="mt-2 text-xs text-neutral-500">{{ loading ? '読み込み中...' : `${items.length} 着のアイテム` }}</p>
      </div>
      <div class="flex shrink-0 gap-2">
        <button type="button" class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-800" aria-label="検索画面を開く" @click="router.push('/search')"><AppIcon name="search" :size="20" /></button>
        <button type="button" class="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-950 text-white shadow-md shadow-neutral-900/10 transition hover:bg-neutral-700" aria-label="洋服を登録" @click="router.push('/closet/new')"><AppIcon name="plus" :size="23" /></button>
      </div>
    </header>

    <button type="button" class="text-button mt-4 text-xs" @click="router.push('/closet/import')">ユニクロの購入履歴からまとめて追加 <AppIcon name="arrow-right" :size="16" /></button>
    <button type="button" class="text-button mt-2 text-xs" @click="router.push('/closet/photos/import')">購入履歴の写真をまとめて追加 <AppIcon name="arrow-right" :size="16" /></button>

    <div class="mb-4 mt-8 flex items-center justify-between">
      <h2 class="text-sm font-bold tracking-wide">カテゴリ別</h2>
      <span class="text-xs text-neutral-400">{{ filteredItems.length }} 着</span>
    </div>
    <div class="mb-5 flex items-end gap-3">
      <div class="min-w-0 flex-1"><label for="closet-sort" class="field-label">並び順</label><select id="closet-sort" v-model="sortOrder" class="field-select"><option v-for="option in clothingSortOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div>
      <button type="button" class="inline-flex min-h-12 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold" :class="favoritesOnly ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-neutral-200 bg-white text-neutral-600'" :aria-pressed="favoritesOnly" @click="favoritesOnly = !favoritesOnly"><AppIcon name="heart" :size="17" :filled="favoritesOnly" />お気に入り</button>
    </div>
    <p v-if="favoriteError" role="alert" class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{{ favoriteError }}</p>

    <div v-if="loading" class="grid grid-cols-4 gap-2" aria-label="洋服を読み込み中">
      <div v-for="i in 8" :key="i" class="overflow-hidden rounded-xl bg-white"><div class="aspect-[4/5] animate-pulse bg-neutral-200" /><div class="h-3 animate-pulse bg-neutral-100" /></div>
    </div>
    <div v-else-if="errorMessage" role="alert" class="surface-card px-5 py-8 text-center">
      <p class="text-sm text-red-700">{{ errorMessage }}</p>
      <button type="button" class="secondary-button mt-5" @click="load">再読み込み</button>
    </div>
    <div v-else-if="filteredItems.length === 0" class="surface-card flex flex-col items-center px-6 py-14 text-center">
      <div class="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400"><AppIcon :name="items.length ? 'heart' : 'hanger'" :size="29" /></div>
      <h2 class="text-base font-bold">{{ items.length ? 'お気に入りはまだありません' : 'クローゼットはまだ空です' }}</h2>
      <p class="mt-2 text-xs leading-6 text-neutral-500">{{ items.length ? 'ハートを押すとお気に入りに追加できます。' : '最初の一着を登録して、クローゼットを作りましょう。' }}</p>
      <button v-if="items.length" type="button" class="secondary-button mt-6" @click="favoritesOnly = false">すべて表示</button>
      <button v-else type="button" class="primary-button mt-6" @click="router.push('/closet/new')"><AppIcon name="plus" :size="18" />洋服を登録</button>
    </div>
    <div v-else>
      <h3 class="mb-2 text-xs font-semibold text-neutral-500">大分類</h3>
      <div role="group" aria-label="大分類を切り替える" class="grid grid-cols-2 gap-2">
        <button v-for="group in groupedItems" :key="group.name" type="button" class="surface-card min-h-16 px-4 py-3 text-left transition-colors" :class="activeGroup === group.name ? 'bg-neutral-950 text-white' : 'text-neutral-900 hover:bg-neutral-100'" :aria-pressed="activeGroup === group.name" @click="toggleGroup(group.name)">
          <span class="block text-sm font-bold">{{ group.name }}</span>
          <span class="mt-1 block text-xs" :class="activeGroup === group.name ? 'text-neutral-300' : 'text-neutral-500'">{{ group.items.length }} 着</span>
        </button>
      </div>
      <div v-if="activeGroup" class="mt-5">
        <h3 class="mb-2 text-xs font-semibold text-neutral-500">小分類</h3>
        <div role="group" :aria-label="`${activeGroup}の小分類を切り替える`" class="flex flex-wrap gap-2">
          <button v-for="option in subcategoryOptions" :key="option.name" type="button" class="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors" :class="activeSubcategory === option.name ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'" :aria-pressed="activeSubcategory === option.name" @click="toggleSubcategory(option.name)">
            <span>{{ option.name }}</span><span class="opacity-65">{{ option.count }}</span>
          </button>
        </div>
        <div v-if="activeGroup === 'トップス'" class="mt-5">
          <h3 class="mb-2 text-xs font-semibold text-neutral-500">袖丈</h3>
          <div role="group" aria-label="袖丈を切り替える" class="flex flex-wrap gap-2">
            <button v-for="option in sleeveOptions" :key="option.name" type="button" class="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors" :class="sleeveFilter === option.name ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'" :aria-pressed="sleeveFilter === option.name" @click="toggleSleeve(option.name)"><span>{{ option.name }}</span><span class="opacity-65">{{ option.count }}</span></button>
          </div>
        </div>
        <div class="mb-3 mt-6 flex items-center justify-between"><h3 class="text-sm font-bold">{{ [activeGroup, activeSubcategory !== 'すべて' ? activeSubcategory : '', activeGroup === 'トップス' && sleeveFilter !== 'すべて' ? sleeveFilter : ''].filter(Boolean).join(' / ') }}</h3><span class="text-xs text-neutral-500">{{ displayItems.length }} 着</span></div>
        <p v-if="displayItems.length === 0" class="surface-card px-5 py-8 text-center text-xs text-neutral-500">この条件のアイテムはまだありません。</p>
        <div v-else class="grid grid-cols-4 gap-x-2 gap-y-4">
          <div v-for="item in visibleItems" :key="item.id" class="relative min-w-0">
            <RouterLink :to="`/closet/${item.id}`" :title="item.name" class="block min-w-0" :aria-label="`${item.brand} ${item.name}の詳細を開く`">
              <div class="aspect-[4/5] overflow-hidden rounded-xl bg-[#ecece9]">
                <img v-if="imageUrls[item.id]" :src="imageUrls[item.id]" :alt="item.name" class="h-full w-full object-cover" loading="lazy" />
                <div v-else class="flex h-full flex-col items-center justify-center gap-1 text-neutral-300"><AppIcon name="shirt" :size="25" /><span class="text-[8px]">NO PHOTO</span></div>
              </div>
              <p class="mt-1 truncate text-[10px] font-medium text-neutral-700">{{ item.name }}</p>
            </RouterLink>
            <button type="button" class="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm" :class="item.is_favorite ? 'text-rose-600' : 'text-neutral-500'" :aria-label="`${item.name}を${item.is_favorite ? 'お気に入りから外す' : 'お気に入りに追加する'}`" :aria-pressed="item.is_favorite" :disabled="favoriteBusy[item.id]" @click="toggleFavorite(item)"><AppIcon name="heart" :size="16" :filled="item.is_favorite" /></button>
          </div>
        </div>
        <button v-if="visibleItems.length < displayItems.length" type="button" class="secondary-button mt-4 w-full" @click="showMoreActiveGroup">さらに表示（{{ displayItems.length - visibleItems.length }} 件）</button>
      </div>
      <p v-else class="mt-5 text-center text-xs text-neutral-500">カテゴリを選ぶとアイテムが表示されます。</p>
    </div>
  </main>
</template>
