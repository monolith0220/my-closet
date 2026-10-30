<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { listClothing, signedClothingImages } from '../lib/clothing'
import { closetGroupFor } from '../lib/closet-groups'
import { createOutfitPair, listOutfitPairs } from '../lib/outfits'
import { outfitPairKey, suggestLowViewOutfits } from '../lib/low-view-outfits'
import type { ClothingItem } from '../types/clothing'

const session = useSession()
const items = ref<ClothingItem[]>([])
const savedKeys = ref<Set<string>>(new Set())
const imageUrls = ref<Record<string, string>>({})
const loading = ref(true)
const savingKey = ref('')
const errorMessage = ref('')
const saveMessage = ref('')

const upperCount = computed(() => items.value.filter(item =>
  ['トップス', 'アウター'].includes(closetGroupFor(item)),
).length)
const lowerCount = computed(() => items.value.filter(item => closetGroupFor(item) === 'ボトムス').length)
const suggestions = computed(() => suggestLowViewOutfits(items.value, savedKeys.value, 3))

watch(suggestions, async pairs => {
  const paths = [...new Set(pairs.flatMap(pair => [pair.top.image_path, pair.bottom.image_path])
    .filter((path): path is string => Boolean(path)))]
    .filter(path => !imageUrls.value[path])
  if (!paths.length) return
  try {
    imageUrls.value = { ...imageUrls.value, ...await signedClothingImages(paths) }
  } catch {
    // Names remain visible when a private image link cannot be signed.
  }
})

async function load() {
  const userId = session.value?.user.id
  if (!userId) return
  loading.value = true
  errorMessage.value = ''
  try {
    const [clothing, saved] = await Promise.all([listClothing(userId), listOutfitPairs(userId)])
    items.value = clothing
    savedKeys.value = new Set(saved.map(pair => outfitPairKey(pair.top.id, pair.bottom.id)))
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'コーデの候補を読み込めませんでした。'
  } finally {
    loading.value = false
  }
}

async function save(top: ClothingItem, bottom: ClothingItem) {
  const userId = session.value?.user.id
  const key = outfitPairKey(top.id, bottom.id)
  if (!userId || savingKey.value) return
  savingKey.value = key
  errorMessage.value = ''
  saveMessage.value = ''
  try {
    await createOutfitPair(userId, top.name + ' × ' + bottom.name, top.id, bottom.id)
    savedKeys.value = new Set([...savedKeys.value, key])
    saveMessage.value = 'コーデに保存しました。'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'コーデを保存できませんでした。'
  } finally {
    savingKey.value = ''
  }
}

onMounted(load)
</script>

<template>
  <main class="page-shell">
    <header>
      <p class="eyebrow">STYLE IDEAS</p>
      <h1 class="mt-2 text-[29px] font-bold tracking-tight">コーデ提案</h1>
      <p class="mt-2 text-xs leading-6 text-neutral-500">閲覧回数が少ない服を優先して、上下を組み合わせます。</p>
    </header>

    <div v-if="loading" class="mt-8 space-y-4" aria-label="提案を読み込み中">
      <div v-for="index in 2" :key="index" class="h-64 animate-pulse rounded-2xl bg-neutral-200" />
    </div>
    <div v-else-if="errorMessage && !items.length" role="alert" class="surface-card mt-8 px-5 py-8 text-center">
      <p class="text-sm text-red-700">{{ errorMessage }}</p>
      <button type="button" class="secondary-button mt-5" @click="load">再読み込み</button>
    </div>
    <template v-else>
      <p v-if="saveMessage" role="status" class="mt-6 rounded-xl bg-neutral-100 px-4 py-3 text-sm font-semibold">{{ saveMessage }}</p>
      <p v-if="errorMessage" role="alert" class="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{{ errorMessage }}</p>

      <div v-if="!suggestions.length" class="surface-card mt-8 px-5 py-10 text-center">
        <AppIcon name="sparkles" :size="32" class="mx-auto text-neutral-300" />
        <h2 class="mt-4 text-base font-bold">提案できる組み合わせがありません</h2>
        <p class="mt-2 text-xs leading-6 text-neutral-500">{{ !upperCount || !lowerCount ? 'トップス・アウターとボトムスを1着ずつ登録してください。' : '新しい上下の組み合わせが見つかりませんでした。' }}</p>
        <RouterLink :to="!upperCount || !lowerCount ? '/closet' : '/outfits'" class="secondary-button mt-5">{{ !upperCount || !lowerCount ? 'クローゼットを見る' : '保存したコーデを見る' }}<AppIcon name="arrow-right" :size="17" /></RouterLink>
      </div>

      <section v-else class="mt-8 space-y-4" aria-label="コーデの候補">
        <article v-for="(pair, index) in suggestions" :key="outfitPairKey(pair.top.id, pair.bottom.id)" class="surface-card p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold">提案 {{ index + 1 }}</h2>
            <span class="text-[10px] text-neutral-400">上下セット</span>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-3">
            <RouterLink v-for="part in [{ role: '上', piece: pair.top }, { role: '下', piece: pair.bottom }]" :key="part.role" :to="{ path: '/closet/' + part.piece.id, query: { from: 'ai' } }" class="min-w-0" :aria-label="part.role + '：' + part.piece.name + 'の詳細を見る'">
              <div class="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#ecece9]">
                <img v-if="part.piece.image_path && imageUrls[part.piece.image_path]" :src="imageUrls[part.piece.image_path]" :alt="part.piece.name" class="h-full w-full object-contain" loading="lazy" />
                <div v-else class="flex h-full items-center justify-center text-neutral-300"><AppIcon name="shirt" :size="35" /></div>
                <span class="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold">{{ part.role }}</span>
              </div>
              <p class="mt-2 truncate text-[10px] font-semibold text-neutral-400">{{ part.piece.brand }}</p>
              <p class="mt-0.5 line-clamp-2 min-h-9 text-xs font-semibold leading-4">{{ part.piece.name }}</p>
            </RouterLink>
          </div>
          <button type="button" class="secondary-button mt-4 w-full" :disabled="Boolean(savingKey)" @click="save(pair.top, pair.bottom)">
            <AppIcon name="plus" :size="17" />{{ savingKey === outfitPairKey(pair.top.id, pair.bottom.id) ? '保存中...' : 'コーデに保存' }}
          </button>
        </article>
      </section>
      <p v-if="suggestions.length" class="mt-5 text-center text-xs leading-6 text-neutral-500">保存した組み合わせは「コーデ」で確認できます。</p>
    </template>
  </main>
</template>
