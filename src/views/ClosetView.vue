<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { listClothing, signedClothingImages } from '../lib/clothing'
import { closetGroupFor, closetGroups, type ClosetGroup } from '../lib/closet-groups'
import type { ClothingItem } from '../types/clothing'
import { colors } from '../types/clothing'

const router = useRouter()
const session = useSession()
const items = ref<ClothingItem[]>([])
const imageUrls = ref<Record<string, string>>({})
const loading = ref(true)
const errorMessage = ref('')
const search = ref('')
const brand = ref('')
const color = ref('')
const showFilters = ref(false)
const activeGroup = ref<ClosetGroup | null>('アウター')
const visibleCountByGroup = reactive<Record<ClosetGroup, number>>({
  アウター: 30,
  トップス: 30,
  ボトムス: 30,
  レッグウェア: 30,
  アクセサリー: 30,
  その他: 30,
})
const imageRequests = new Set<string>()

const brands = computed(() => [...new Set(items.value.map(item => item.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')))
const activeFilterCount = computed(() => [brand.value, color.value].filter(Boolean).length)
const filteredItems = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return items.value.filter(item => {
    const searchText = [item.name, item.brand, item.category, closetGroupFor(item), item.color, item.product_code ?? ''].join(' ').toLocaleLowerCase()
    return (!term || searchText.includes(term)) &&
      (!brand.value || item.brand === brand.value) &&
      (!color.value || item.color === color.value)
  })
})
const groupedItems = computed(() => closetGroups.map(name => ({
  name,
  items: filteredItems.value.filter(item => closetGroupFor(item) === name),
})))
const activeGroupItems = computed(() => groupedItems.value.find(group => group.name === activeGroup.value)?.items ?? [])
const visibleItems = computed(() => activeGroup.value ? activeGroupItems.value.slice(0, visibleCountByGroup[activeGroup.value]) : [])

watch([search, brand, color], () => {
  for (const group of closetGroups) visibleCountByGroup[group] = 30
  if (activeGroup.value && activeGroupItems.value.length) return
  activeGroup.value = groupedItems.value.find(group => group.items.length)?.name ?? null
})

function toggleGroup(group: ClosetGroup) {
  activeGroup.value = activeGroup.value === group ? null : group
}

function showMoreActiveGroup() {
  if (activeGroup.value) visibleCountByGroup[activeGroup.value] += 30
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
    for (const group of closetGroups) visibleCountByGroup[group] = 30
    if (!activeGroup.value || !activeGroupItems.value.length) {
      activeGroup.value = groupedItems.value.find(group => group.items.length)?.name ?? null
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '洋服を読み込めませんでした。'
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  search.value = ''
  brand.value = ''
  color.value = ''
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
      <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white shadow-md shadow-neutral-900/10 transition hover:bg-neutral-700" aria-label="洋服を登録" @click="router.push('/closet/new')">
        <AppIcon name="plus" :size="23" />
      </button>
    </header>

    <div class="relative">
      <AppIcon name="search" :size="19" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input v-model="search" type="search" class="field-input pl-11 pr-12" placeholder="名前・ブランド・商品番号で検索" aria-label="洋服を検索" />
      <button type="button" class="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100" :aria-label="showFilters ? '絞り込みを閉じる' : '絞り込みを開く'" :aria-expanded="showFilters" @click="showFilters = !showFilters">
        <AppIcon name="filter" :size="19" />
        <span v-if="activeFilterCount" class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-950 px-0.5 text-[9px] font-bold text-white">{{ activeFilterCount }}</span>
      </button>
    </div>

    <button type="button" class="text-button mt-4 text-xs" @click="router.push('/closet/import')">ユニクロの購入履歴からまとめて追加 <AppIcon name="arrow-right" :size="16" /></button>
    <button type="button" class="text-button mt-2 text-xs" @click="router.push('/closet/photos/import')">購入履歴の写真をまとめて追加 <AppIcon name="arrow-right" :size="16" /></button>

    <div v-if="showFilters" class="surface-card mt-3 space-y-3 p-4">
      <div class="grid grid-cols-2 gap-3">
        <div><label for="filter-color" class="field-label">カラー</label><select id="filter-color" v-model="color" class="field-select"><option value="">すべて</option><option v-for="choice in colors" :key="choice" :value="choice">{{ choice }}</option></select></div>
        <div><label for="filter-brand" class="field-label">ブランド</label><select id="filter-brand" v-model="brand" class="field-select"><option value="">すべて</option><option v-for="choice in brands" :key="choice" :value="choice">{{ choice }}</option></select></div>
      </div>
      <button type="button" class="text-button text-xs" @click="clearFilters">絞り込みをクリア</button>
    </div>

    <div class="mb-4 mt-8 flex items-center justify-between">
      <h2 class="text-sm font-bold tracking-wide">カテゴリ別</h2>
      <span class="text-xs text-neutral-400">{{ filteredItems.length }} items</span>
    </div>

    <div v-if="loading" class="grid grid-cols-2 gap-3" aria-label="洋服を読み込み中">
      <div v-for="i in 4" :key="i" class="overflow-hidden rounded-2xl bg-white"><div class="aspect-[4/5] animate-pulse bg-neutral-200" /><div class="space-y-2 p-3"><div class="h-3 w-1/2 animate-pulse rounded bg-neutral-100" /><div class="h-4 w-3/4 animate-pulse rounded bg-neutral-100" /></div></div>
    </div>
    <div v-else-if="errorMessage" role="alert" class="surface-card px-5 py-8 text-center">
      <p class="text-sm text-red-700">{{ errorMessage }}</p>
      <button type="button" class="secondary-button mt-5" @click="load">再読み込み</button>
    </div>
    <div v-else-if="filteredItems.length === 0" class="surface-card flex flex-col items-center px-6 py-14 text-center">
      <div class="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400"><AppIcon :name="items.length ? 'search' : 'hanger'" :size="29" /></div>
      <h2 class="text-base font-bold">{{ items.length ? 'アイテムが見つかりません' : 'クローゼットはまだ空です' }}</h2>
      <p class="mt-2 text-xs leading-6 text-neutral-500">{{ items.length ? '検索条件や絞り込みを変更してください。' : '最初の一着を登録して、クローゼットを作りましょう。' }}</p>
      <button v-if="items.length" type="button" class="secondary-button mt-6" @click="clearFilters">条件をクリア</button>
      <button v-else type="button" class="primary-button mt-6" @click="router.push('/closet/new')"><AppIcon name="plus" :size="18" />洋服を登録</button>
    </div>
    <div v-else>
      <div role="group" aria-label="カテゴリを切り替える" class="grid grid-cols-2 gap-2">
        <button v-for="group in groupedItems" :key="group.name" type="button" class="surface-card min-h-16 px-4 py-3 text-left transition-colors" :class="activeGroup === group.name ? 'bg-neutral-950 text-white' : 'text-neutral-900 hover:bg-neutral-100'" :aria-pressed="activeGroup === group.name" @click="toggleGroup(group.name)">
          <span class="block text-sm font-bold">{{ group.name }}</span>
          <span class="mt-1 block text-xs" :class="activeGroup === group.name ? 'text-neutral-300' : 'text-neutral-500'">{{ group.items.length }} 着</span>
        </button>
      </div>
      <div v-if="activeGroup" class="mt-5">
        <div class="mb-3 flex items-center justify-between"><h3 class="text-sm font-bold">{{ activeGroup }}</h3><span class="text-xs text-neutral-500">{{ activeGroupItems.length }} 着</span></div>
        <p v-if="activeGroupItems.length === 0" class="surface-card px-5 py-8 text-center text-xs text-neutral-500">このカテゴリのアイテムはまだありません。</p>
        <div v-else class="grid grid-cols-2 gap-3 sm:gap-4">
          <RouterLink v-for="item in visibleItems" :key="item.id" :to="`/closet/${item.id}`" class="group min-w-0 overflow-hidden rounded-2xl bg-white shadow-[0_4px_22px_rgba(0,0,0,0.035)] transition hover:-translate-y-0.5 hover:shadow-md">
            <div class="relative aspect-[4/5] overflow-hidden bg-[#ecece9]">
              <img v-if="imageUrls[item.id]" :src="imageUrls[item.id]" :alt="item.name" class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
              <div v-else class="flex h-full flex-col items-center justify-center gap-2 text-neutral-300"><AppIcon name="shirt" :size="40" /><span class="text-[10px]">NO PHOTO</span></div>
              <span class="absolute bottom-2 left-2 max-w-[calc(100%-16px)] truncate rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-neutral-700 backdrop-blur">{{ activeGroup }}</span>
            </div>
            <div class="min-w-0 px-3 pb-4 pt-3">
              <p class="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{{ item.brand }}</p>
              <p class="mt-1 truncate text-[13px] font-semibold text-neutral-900">{{ item.name }}</p>
              <p class="mt-2 text-[11px] text-neutral-500">{{ item.color }}<span v-if="item.size"> · {{ item.size }}</span></p>
            </div>
          </RouterLink>
        </div>
        <button v-if="visibleItems.length < activeGroupItems.length" type="button" class="secondary-button mt-4 w-full" @click="showMoreActiveGroup">さらに表示（{{ activeGroupItems.length - visibleItems.length }} 件）</button>
      </div>
      <p v-else class="mt-5 text-center text-xs text-neutral-500">カテゴリを選ぶとアイテムが表示されます。</p>
    </div>
  </main>
</template>
