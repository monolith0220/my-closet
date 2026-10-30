<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { createClothing, getClothing, removeClothingImage, signedClothingImage, updateClothing, uploadClothingImage } from '../lib/clothing'
import { formatClothingSize, normalizePurchaseDate, purchaseDateFor, stripPurchaseDateFromMemo } from '../lib/clothing-display'
import { categories, colors, seasons, type ClothingInput, type ClothingItem, type Season } from '../types/clothing'

const route = useRoute()
const router = useRouter()
const session = useSession()
const itemId = computed(() => typeof route.params.id === 'string' ? route.params.id : null)
const isEditing = computed(() => Boolean(itemId.value))
const loading = ref(Boolean(itemId.value))
const saving = ref(false)
const errorMessage = ref('')
const currentItem = ref<ClothingItem | null>(null)
const selectedFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const removeExistingImage = ref(false)
let objectUrl: string | null = null

const form = reactive({
  name: '',
  brand: '',
  category: '',
  color: '',
  size: '',
  purchaseDate: '',
  seasons: [] as Season[],
  styleTags: '',
  productCode: '',
  productUrl: '',
  memo: '',
})

type UniqloUrlDetails = {
  productCode: string
  colorCode: string | null
  sizeCode: string | null
}

function parseUniqloProductUrl(value: string): UniqloUrlDetails | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || !['uniqlo.com', 'www.uniqlo.com'].includes(url.hostname)) return null
    const productCode = url.pathname.match(/^\/jp\/ja\/products\/E(\d{6})-[A-Z0-9]+\/\d{2}\/?$/i)?.[1]
    if (!productCode) return null
    const colorCode = url.searchParams.get('colorDisplayCode')
    const sizeCode = url.searchParams.get('sizeDisplayCode')
    return {
      productCode,
      colorCode: colorCode && /^\d{2}$/.test(colorCode) ? colorCode : null,
      sizeCode: sizeCode && /^\d{3}$/.test(sizeCode) ? sizeCode : null,
    }
  } catch {
    return null
  }
}

const uniqloUrlDetails = computed(() => parseUniqloProductUrl(form.productUrl))
const lastAutoProductCode = ref<string | null>(null)

function applyUniqloProductCode() {
  const details = uniqloUrlDetails.value
  if (!details) return
  if (!form.brand.trim()) form.brand = 'UNIQLO'
  form.productCode = details.productCode
  lastAutoProductCode.value = details.productCode
}

watch(() => form.productUrl, () => {
  const details = uniqloUrlDetails.value
  if (!details) return
  if (!form.brand.trim()) form.brand = 'UNIQLO'
  if (!form.productCode.trim() || form.productCode === lastAutoProductCode.value) {
    applyUniqloProductCode()
  }
})

function returnToPrevious() {
  router.push({ path: itemId.value ? `/closet/${itemId.value}` : '/closet', query: route.query })
}

function revokePreview() {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = null
}

function selectPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    errorMessage.value = 'JPEG、PNG、WebP形式の写真を選択してください。'
    input.value = ''
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    errorMessage.value = '写真は10MB以下にしてください。'
    input.value = ''
    return
  }
  errorMessage.value = ''
  selectedFile.value = file
  removeExistingImage.value = false
  revokePreview()
  objectUrl = URL.createObjectURL(file)
  imagePreview.value = objectUrl
}

function clearPhoto() {
  selectedFile.value = null
  removeExistingImage.value = true
  revokePreview()
  imagePreview.value = null
}

function toggleSeason(season: Season) {
  const index = form.seasons.indexOf(season)
  if (index === -1) form.seasons.push(season)
  else form.seasons.splice(index, 1)
}

function optional(value: string): string | null {
  return value.trim() || null
}

function inputPayload(imagePath: string | null): ClothingInput {
  const displaySize = optional(formatClothingSize(form.size))
  const originalSize = currentItem.value?.size ?? null
  return {
    name: form.name.trim(),
    brand: form.brand.trim(),
    category: form.category,
    color: form.color,
    size: originalSize && displaySize === formatClothingSize(originalSize) ? originalSize : displaySize,
    purchased_at: form.purchaseDate ? normalizePurchaseDate(form.purchaseDate) : null,
    seasons: [...form.seasons],
    style_tags: [...new Set(form.styleTags.split(',').map(tag => tag.trim()).filter(Boolean))],
    product_code: optional(form.productCode),
    product_url: optional(form.productUrl),
    image_path: imagePath,
    registration_method: 'manual',
    memo: optional(stripPurchaseDateFromMemo(form.memo)),
  }
}

async function save() {
  const userId = session.value?.user.id
  if (!userId || saving.value) return
  errorMessage.value = ''
  if (!form.name.trim() || !form.brand.trim() || !form.category || !form.color) {
    errorMessage.value = '必須項目を入力してください。'
    return
  }
  if (form.purchaseDate && !normalizePurchaseDate(form.purchaseDate)) {
    errorMessage.value = '購入日を確認してください。'
    return
  }
  if (form.productUrl.trim()) {
    try {
      const parsed = new URL(form.productUrl.trim())
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('invalid URL')
    } catch {
      errorMessage.value = '商品URLは http:// または https:// から始まるURLを入力してください。'
      return
    }
  }

  saving.value = true
  let uploadedPath: string | null = null
  try {
    if (selectedFile.value) uploadedPath = await uploadClothingImage(userId, selectedFile.value)
    const priorPath = currentItem.value?.image_path ?? null
    const nextPath = uploadedPath ?? (removeExistingImage.value ? null : priorPath)
    const payload = inputPayload(nextPath)
    const saved = itemId.value
      ? await updateClothing(itemId.value, userId, payload)
      : await createClothing(userId, payload)

    if (priorPath && priorPath !== nextPath) {
      try { await removeClothingImage(priorPath) } catch { /* Item save succeeded; unused image can be cleaned up later. */ }
    }
    await router.replace({ path: `/closet/${saved.id}`, query: route.query })
  } catch (error) {
    if (uploadedPath) {
      try { await removeClothingImage(uploadedPath) } catch { /* Avoid hiding the original error. */ }
    }
    errorMessage.value = error instanceof Error ? error.message : '保存に失敗しました。'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  const userId = session.value?.user.id
  if (!itemId.value || !userId) return
  try {
    const item = await getClothing(itemId.value, userId)
    currentItem.value = item
    form.name = item.name
    form.brand = item.brand
    form.category = item.category
    form.color = item.color
    form.size = formatClothingSize(item.size)
    form.purchaseDate = item.purchased_at ?? purchaseDateFor(item) ?? ''
    form.seasons = item.seasons.filter((season): season is Season => seasons.includes(season as Season))
    form.styleTags = item.style_tags.join(', ')
    form.productCode = item.product_code ?? ''
    form.productUrl = item.product_url ?? ''
    form.memo = stripPurchaseDateFromMemo(item.memo)
    if (item.image_path) {
      try { imagePreview.value = await signedClothingImage(item.image_path) } catch { /* Show placeholder if image is unavailable. */ }
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '洋服を読み込めませんでした。'
  } finally {
    loading.value = false
  }
})

onUnmounted(revokePreview)
</script>

<template>
  <main class="page-shell">
    <header class="mb-7 flex items-center gap-4">
      <button type="button" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-800" aria-label="戻る" @click="returnToPrevious"><AppIcon name="arrow-left" :size="20" /></button>
      <div><p class="eyebrow">MY WARDROBE</p><h1 class="mt-1 text-[24px] font-bold tracking-tight">{{ isEditing ? '洋服を編集' : '洋服を登録' }}</h1></div>
    </header>

    <div v-if="loading" class="space-y-4" aria-label="読み込み中"><div class="h-52 animate-pulse rounded-2xl bg-neutral-200" /><div v-for="i in 4" :key="i" class="h-14 animate-pulse rounded-xl bg-neutral-200" /></div>
    <div v-else-if="isEditing && !currentItem" class="surface-card p-6 text-center"><p role="alert" class="text-sm text-red-700">{{ errorMessage }}</p><button type="button" class="secondary-button mt-5" @click="router.push('/closet')">一覧に戻る</button></div>
    <form v-else class="space-y-7" @submit.prevent="save">
      <section>
        <label for="item-photo" class="field-label">写真</label>
        <div class="overflow-hidden rounded-2xl border border-dashed border-neutral-300 bg-[#efefec]">
          <img v-if="imagePreview" :src="imagePreview" alt="選択した洋服の写真" class="h-52 w-full object-contain p-2 sm:h-64" />
          <div v-else class="flex h-52 flex-col items-center justify-center gap-3 text-neutral-400 sm:h-64"><AppIcon name="camera" :size="34" /><span class="text-xs">写真を追加</span></div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <label for="item-photo" class="secondary-button min-h-10 cursor-pointer px-3 text-xs"><AppIcon name="camera" :size="16" />写真を選ぶ</label>
          <input id="item-photo" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" @change="selectPhoto" />
          <button v-if="imagePreview" type="button" class="text-xs font-semibold text-neutral-500 underline" @click="clearPhoto">写真を削除</button>
          <p class="w-full text-[11px] text-neutral-400">JPEG・PNG・WebP / 最大10MB</p>
        </div>
      </section>

      <section class="surface-card space-y-5 p-5">
        <div><p class="eyebrow">BASIC INFORMATION</p><h2 class="mt-1 text-base font-bold">アイテム情報</h2></div>
        <div><label for="item-name" class="field-label">商品名 <span class="text-red-500">*</span></label><input id="item-name" v-model="form.name" class="field-input" type="text" maxlength="120" placeholder="例：オックスフォードシャツ" required /></div>
        <div><label for="item-brand" class="field-label">ブランド <span class="text-red-500">*</span></label><input id="item-brand" v-model="form.brand" class="field-input" type="text" maxlength="80" placeholder="例：UNIQLO" required /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label for="item-category" class="field-label">カテゴリ <span class="text-red-500">*</span></label><select id="item-category" v-model="form.category" class="field-select" required><option value="" disabled>選択</option><option v-for="choice in categories" :key="choice" :value="choice">{{ choice }}</option></select></div>
          <div><label for="item-color" class="field-label">カラー <span class="text-red-500">*</span></label><select id="item-color" v-model="form.color" class="field-select" required><option value="" disabled>選択</option><option v-for="choice in colors" :key="choice" :value="choice">{{ choice }}</option></select></div>
        </div>
        <div><label for="item-size" class="field-label">サイズ</label><input id="item-size" v-model="form.size" class="field-input" type="text" maxlength="30" placeholder="例：M / 26.5cm" /></div>
        <div><label for="item-purchase-date" class="field-label">購入日</label><input id="item-purchase-date" v-model="form.purchaseDate" class="field-input" type="date" /></div>
        <div><span class="field-label">季節</span><div class="grid grid-cols-4 gap-2"><button v-for="season in seasons" :key="season" type="button" class="min-h-11 rounded-xl border text-sm font-semibold transition" :class="form.seasons.includes(season) ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-600'" :aria-pressed="form.seasons.includes(season)" @click="toggleSeason(season)">{{ season }}</button></div></div>
        <div><label for="item-tags" class="field-label">スタイルタグ</label><input id="item-tags" v-model="form.styleTags" class="field-input" type="text" placeholder="例：カジュアル, きれいめ" /><p class="mt-1.5 text-[11px] text-neutral-400">カンマで区切って入力</p></div>
      </section>

      <section class="surface-card space-y-5 p-5">
        <div><p class="eyebrow">PRODUCT DETAILS</p><h2 class="mt-1 text-base font-bold">商品情報</h2></div>
        <div><label for="item-url" class="field-label">商品URL</label><input id="item-url" v-model="form.productUrl" class="field-input" type="url" placeholder="https://example.com/item" /></div>
        <div v-if="uniqloUrlDetails" class="rounded-xl bg-neutral-100 px-4 py-3 text-xs leading-5 text-neutral-600">
          <p>ユニクロの商品番号 {{ uniqloUrlDetails.productCode }} をURLから読み取りました。</p>
          <p v-if="uniqloUrlDetails.colorCode || uniqloUrlDetails.sizeCode" class="mt-1">URL内の選択コード：<span v-if="uniqloUrlDetails.colorCode">カラー {{ uniqloUrlDetails.colorCode }}</span><span v-if="uniqloUrlDetails.colorCode && uniqloUrlDetails.sizeCode"> / </span><span v-if="uniqloUrlDetails.sizeCode">サイズ {{ uniqloUrlDetails.sizeCode }}</span></p>
          <p class="mt-1">商品名・色・購入したサイズは商品ページを確認して入力してください。</p>
          <button v-if="form.productCode !== uniqloUrlDetails.productCode" type="button" class="mt-2 font-semibold text-neutral-900 underline" @click="applyUniqloProductCode">商品番号を入力する</button>
        </div>
        <div><label for="item-code" class="field-label">商品番号</label><input id="item-code" v-model="form.productCode" class="field-input" type="text" maxlength="100" placeholder="例：123456" /></div>
        <div><label for="item-memo" class="field-label">メモ</label><textarea id="item-memo" v-model="form.memo" class="field-input min-h-28 resize-y" maxlength="2000" placeholder="購入日や着こなしのメモなど" /></div>
      </section>

      <p v-if="errorMessage" role="alert" class="rounded-xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">{{ errorMessage }}</p>
      <button type="submit" class="primary-button w-full" :disabled="saving">{{ saving ? '保存中...' : isEditing ? '変更を保存' : 'クローゼットに追加' }}<AppIcon name="check" :size="18" /></button>
    </form>
  </main>
</template>
