<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { generateOutfitImage } from '../lib/ai-outfit-image'
import { useSession } from '../lib/auth-context'
import { listClothing, signedClothingImages } from '../lib/clothing'
import { closetGroupFor } from '../lib/closet-groups'
import { createOutfit, listOutfits } from '../lib/outfits'
import { itemMatchesSeason, outfitPairKey, seasonForDate, suggestLowViewOutfits } from '../lib/low-view-outfits'
import type { ClothingItem } from '../types/clothing'

const session = useSession()
const items = ref<ClothingItem[]>([])
const savedKeys = ref<Set<string>>(new Set())
const imageUrls = ref<Record<string, string>>({})
const generatedImageUrls = ref<Record<string, string>>({})
const imageErrors = ref<Record<string, string>>({})
const loading = ref(true)
const savingKey = ref('')
const generatingKey = ref('')
const errorMessage = ref('')
const saveMessage = ref('')
const currentSeason = seasonForDate()

const seasonalItems = computed(() => items.value.filter(item => itemMatchesSeason(item, currentSeason)))
const upperCount = computed(() => seasonalItems.value.filter(item =>
  ['トップス', 'アウター'].includes(closetGroupFor(item)),
).length)
const lowerCount = computed(() => seasonalItems.value.filter(item => closetGroupFor(item) === 'ボトムス').length)
const suggestions = computed(() => suggestLowViewOutfits(items.value, savedKeys.value, 3, currentSeason))

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
    const [clothing, saved] = await Promise.all([listClothing(userId), listOutfits(userId)])
    items.value = clothing
    savedKeys.value = new Set(saved.flatMap(outfit =>
      outfit.bottom ? outfit.tops.map(top => outfitPairKey(top.id, outfit.bottom!.id)) : [],
    ))
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
    const created = await createOutfit(userId, top.name + ' × ' + bottom.name, [top.id], bottom.id)
    savedKeys.value = new Set([...savedKeys.value, key])
    saveMessage.value = `コーデ${created.list_number}に保存しました。`
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'コーデを保存できませんでした。'
  } finally {
    savingKey.value = ''
  }
}

async function createAiImage(top: ClothingItem, bottom: ClothingItem) {
  const key = outfitPairKey(top.id, bottom.id)
  if (generatingKey.value) return
  if (!top.image_path || !bottom.image_path) {
    imageErrors.value = { ...imageErrors.value, [key]: 'AIイメージの生成には上下両方の写真が必要です。' }
    return
  }
  generatingKey.value = key
  imageErrors.value = { ...imageErrors.value, [key]: '' }
  try {
    const result = await generateOutfitImage([top.id, bottom.id], Boolean(generatedImageUrls.value[key]))
    generatedImageUrls.value = { ...generatedImageUrls.value, [key]: result.image_url }
  } catch (error) {
    imageErrors.value = {
      ...imageErrors.value,
      [key]: error instanceof Error ? error.message : 'AIイメージを生成できませんでした。',
    }
  } finally {
    generatingKey.value = ''
  }
}

onMounted(load)
</script>

<template>
  <main class="page-shell page-shell--compact">
    <h1 class="sr-only">コーデ提案</h1>
    <p class="text-xs leading-6 text-neutral-500">現在は{{ currentSeason }}。{{ currentSeason }}向けの服から、閲覧回数が少ない上下を優先して組み合わせます。</p>
    <p class="mt-1 text-[11px] leading-5 text-neutral-400">季節未設定の服は通年アイテムとして候補に含めます。</p>
    <p class="mt-1 text-[11px] leading-5 text-neutral-400">AIイメージを生成すると、選んだ洋服の写真がOpenAIへ送信されます。生成には時間とAPI利用料がかかるため、自動生成はしません。</p>

    <div v-if="loading" class="mt-8 space-y-4" aria-label="提案を読み込み中">
      <div v-for="index in 2" :key="index" class="h-96 animate-pulse rounded-2xl bg-neutral-200" />
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
        <p class="mt-2 text-xs leading-6 text-neutral-500">{{ !upperCount || !lowerCount ? `${currentSeason}向けのトップス・アウターとボトムスを1着ずつ登録してください。` : '新しい上下の組み合わせが見つかりませんでした。' }}</p>
        <RouterLink :to="!upperCount || !lowerCount ? '/closet' : '/outfits'" class="secondary-button mt-5">{{ !upperCount || !lowerCount ? 'クローゼットを見る' : '保存したコーデを見る' }}<AppIcon name="arrow-right" :size="17" /></RouterLink>
      </div>

      <section v-else class="mt-8 space-y-4" aria-label="コーデの候補">
        <article v-for="(pair, index) in suggestions" :key="outfitPairKey(pair.top.id, pair.bottom.id)" class="surface-card p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold">提案 {{ index + 1 }}</h2>
            <span class="text-[10px] text-neutral-400">上下セット</span>
          </div>
          <div v-if="generatedImageUrls[outfitPairKey(pair.top.id, pair.bottom.id)]" class="relative mt-3 aspect-[2/3] overflow-hidden rounded-2xl bg-[#ecece9]" :aria-label="`${pair.top.name}と${pair.bottom.name}のAIコーデイメージ`">
            <img :src="generatedImageUrls[outfitPairKey(pair.top.id, pair.bottom.id)]" :alt="`${pair.top.name}と${pair.bottom.name}のAI生成コーデ`" class="h-full w-full object-cover" />
            <span class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-neutral-950/85 px-2 py-1 text-[10px] font-semibold text-white"><AppIcon name="sparkles" :size="13" />AI生成イメージ</span>
          </div>
          <div v-else class="relative mt-3 overflow-hidden rounded-2xl bg-[#ecece9]" :aria-label="`${pair.top.name}と${pair.bottom.name}の組み合わせプレビュー`">
            <RouterLink v-for="part in [{ role: '上', piece: pair.top }, { role: '下', piece: pair.bottom }]" :key="part.role" :to="{ path: '/closet/' + part.piece.id, query: { from: 'ai' } }" class="relative flex aspect-[8/5] items-center justify-center overflow-hidden border-white/80 first:border-b" :class="part.role === '上' ? 'bg-[#f0f0ed]' : 'bg-[#e8e8e5]'" :aria-label="part.role + '：' + part.piece.name + 'の詳細を見る'">
              <img v-if="part.piece.image_path && imageUrls[part.piece.image_path]" :src="imageUrls[part.piece.image_path]" :alt="part.piece.name" class="h-full w-full object-contain" loading="lazy" />
              <AppIcon v-else name="shirt" :size="42" class="text-neutral-300" />
              <span class="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold shadow-sm">{{ part.role }}</span>
            </RouterLink>
            <span class="pointer-events-none absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-neutral-950 text-white shadow-md" aria-hidden="true"><AppIcon name="sparkles" :size="17" /></span>
          </div>
          <p v-if="imageErrors[outfitPairKey(pair.top.id, pair.bottom.id)]" role="alert" class="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{{ imageErrors[outfitPairKey(pair.top.id, pair.bottom.id)] }}</p>
          <button type="button" class="secondary-button mt-3 w-full" :disabled="Boolean(generatingKey)" @click="createAiImage(pair.top, pair.bottom)">
            <AppIcon name="sparkles" :size="17" />{{ generatingKey === outfitPairKey(pair.top.id, pair.bottom.id) ? 'AIイメージを生成中...' : generatedImageUrls[outfitPairKey(pair.top.id, pair.bottom.id)] ? 'AIイメージを再生成' : 'AIイメージを生成' }}
          </button>
          <div class="mt-3 grid grid-cols-2 gap-3">
            <RouterLink v-for="part in [{ role: '上', piece: pair.top }, { role: '下', piece: pair.bottom }]" :key="part.role" :to="{ path: '/closet/' + part.piece.id, query: { from: 'ai' } }" class="min-w-0 rounded-xl bg-neutral-50 p-3" :aria-label="part.role + '：' + part.piece.name + 'の詳細を見る'">
              <p class="text-[10px] font-semibold text-neutral-400">{{ part.role }} · {{ part.piece.brand }}</p>
              <p class="mt-1 line-clamp-2 text-xs font-semibold leading-4">{{ part.piece.name }}</p>
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
