<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { signedClothingImages } from '../lib/clothing'
import { outfitRoleLabel, type OutfitItemRole } from '../lib/outfit-selection'
import { deleteOutfit, listOutfits, type OutfitPiece, type OutfitSet } from '../lib/outfits'

const session = useSession()
const outfits = ref<OutfitSet[]>([])
const imageUrls = ref<Record<string, string>>({})
const loading = ref(true)
const deletingId = ref('')
const errorMessage = ref('')
const visibleCount = ref(10)
let imageSigning = false
let imageSigningQueued = false

const visibleOutfits = computed(() => outfits.value.slice(0, visibleCount.value))

function savedDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date)
}

function pieceSummary(outfit: OutfitSet): string {
  const labels = []
  if (outfit.outers.length) labels.push(`アウター ${outfit.outers.length}`)
  if (outfit.inners.length) labels.push(`インナー ${outfit.inners.length}`)
  if (outfit.bottom) labels.push('ボトムス 1')
  return labels.join(' ・ ')
}

function primaryPieces(outfit: OutfitSet): OutfitPiece[] {
  const backToFront: OutfitItemRole[] = ['bottom', 'inner', 'outer']
  return backToFront
    .map(role => outfit.pieces.find(piece => piece.role === role && piece.position === 0))
    .filter((piece): piece is OutfitPiece => Boolean(piece))
}

function boardPieceClass(piece: OutfitPiece): string {
  return `outfit-board-piece outfit-board-piece--${piece.role}`
}

async function signVisibleImages() {
  if (imageSigning) {
    imageSigningQueued = true
    return
  }
  imageSigning = true
  try {
    do {
      imageSigningQueued = false
      const pending = [...new Set(visibleOutfits.value
        .flatMap(outfit => outfit.pieces.map(piece => piece.item.image_path))
        .filter((path): path is string => Boolean(path)))]
        .filter(path => !imageUrls.value[path])
      if (!pending.length) continue
      try {
        imageUrls.value = { ...imageUrls.value, ...await signedClothingImages(pending) }
      } catch {
        // Clothing names remain visible if a private image link cannot be signed.
      }
    } while (imageSigningQueued)
  } finally {
    imageSigning = false
  }
}

watch(visibleOutfits, signVisibleImages)

async function load() {
  const userId = session.value?.user.id
  if (!userId) return
  loading.value = true
  errorMessage.value = ''
  try {
    outfits.value = await listOutfits(userId)
    visibleCount.value = 10
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'コーデを読み込めませんでした。'
  } finally {
    loading.value = false
  }
}

async function remove(outfit: OutfitSet) {
  const userId = session.value?.user.id
  if (!userId || deletingId.value) return
  if (!window.confirm(`コーデ${outfit.list_number}を削除しますか？洋服は削除されません。`)) return
  deletingId.value = outfit.id
  errorMessage.value = ''
  try {
    await deleteOutfit(outfit.id, userId)
    outfits.value = outfits.value.filter(saved => saved.id !== outfit.id)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'コーデを削除できませんでした。'
  } finally {
    deletingId.value = ''
  }
}

onMounted(load)
</script>

<template>
  <main class="page-shell page-shell--compact">
    <h1 class="sr-only">保存したコーデ</h1>

    <div v-if="loading" class="space-y-4" aria-label="コーデを読み込み中">
      <div v-for="index in 2" :key="index" class="h-72 animate-pulse rounded-2xl bg-neutral-200" />
    </div>
    <template v-else>
      <p v-if="errorMessage" role="alert" class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{{ errorMessage }}</p>
      <div class="flex items-center justify-between">
        <p class="text-xs text-neutral-500">保存したコーデ</p>
        <span class="text-xs text-neutral-400">{{ outfits.length }} リスト</span>
      </div>

      <div v-if="!outfits.length" class="surface-card mt-4 px-5 py-10 text-center">
        <AppIcon name="hanger" :size="32" class="mx-auto text-neutral-300" />
        <p class="mt-3 text-sm font-semibold">まだコーデがありません</p>
        <p class="mt-2 text-xs leading-6 text-neutral-500">アイテム詳細のハンガーボタンから、新しいコーデを作成できます。</p>
        <RouterLink to="/closet" class="secondary-button mt-5">クローゼットを見る<AppIcon name="arrow-right" :size="17" /></RouterLink>
      </div>

      <article v-for="outfit in visibleOutfits" :key="outfit.id" class="surface-card mt-4 p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-sm font-bold">コーデ{{ outfit.list_number }}</h2>
            <p class="mt-1 text-[11px] text-neutral-400">{{ savedDate(outfit.created_at) }}</p>
          </div>
          <button type="button" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50" :disabled="Boolean(deletingId)" :aria-label="`コーデ${outfit.list_number}を削除`" @click="remove(outfit)"><AppIcon name="trash" :size="17" /></button>
        </div>
        <div class="mt-1 flex items-center justify-between gap-2">
          <p class="text-[10px] text-neutral-400">{{ pieceSummary(outfit) }}</p>
          <span class="text-[9px] font-semibold tracking-wide text-neutral-400">重ね着プレビュー</span>
        </div>

        <div class="outfit-board mt-3" :class="{ 'outfit-board--no-outer': !outfit.outers.length, 'outfit-board--no-inner': !outfit.inners.length, 'outfit-board--no-bottom': !outfit.bottom }" :aria-label="`コーデ${outfit.list_number}の重ね着イメージ`">
          <div class="outfit-board-light" aria-hidden="true" />
          <component
            :is="piece.item.is_active ? 'RouterLink' : 'div'"
            v-for="piece in primaryPieces(outfit)"
            :key="`board-${piece.role}-${piece.item.id}`"
            :to="piece.item.is_active ? `/closet/${piece.item.id}` : undefined"
            :class="boardPieceClass(piece)"
            :aria-label="piece.item.is_active ? `${outfitRoleLabel(piece.role, piece.position)}：${piece.item.name}の詳細を見る` : undefined"
          >
            <img v-if="piece.item.image_path && imageUrls[piece.item.image_path]" :src="imageUrls[piece.item.image_path]" :alt="piece.item.name" class="outfit-board-image" loading="lazy" />
            <div v-else class="outfit-board-placeholder"><AppIcon name="shirt" :size="38" /><span>NO PHOTO</span></div>
            <span class="outfit-board-label">{{ outfitRoleLabel(piece.role, piece.position) }}</span>
          </component>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-2" aria-label="コーデのアイテム一覧">
          <component
            :is="piece.item.is_active ? 'RouterLink' : 'div'"
            v-for="piece in outfit.pieces"
            :key="`detail-${piece.role}-${piece.position}-${piece.item.id}`"
            :to="piece.item.is_active ? `/closet/${piece.item.id}` : undefined"
            class="flex min-w-0 items-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50/80 p-2"
          >
            <div class="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#ebe9e4] text-neutral-300">
              <img v-if="piece.item.image_path && imageUrls[piece.item.image_path]" :src="imageUrls[piece.item.image_path]" :alt="piece.item.name" class="h-full w-full object-contain mix-blend-multiply" loading="lazy" />
              <AppIcon v-else name="shirt" :size="22" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[9px] font-bold text-neutral-500">{{ outfitRoleLabel(piece.role, piece.position) }}</p>
              <p class="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-4" :class="piece.item.is_active ? 'text-neutral-800' : 'text-neutral-400'">{{ piece.item.name }}</p>
            </div>
          </component>
        </div>
      </article>
      <button v-if="visibleOutfits.length < outfits.length" type="button" class="secondary-button mt-4 w-full" @click="visibleCount += 10">さらに表示（{{ outfits.length - visibleOutfits.length }} リスト）</button>
    </template>
  </main>
</template>

<style scoped>
.outfit-board {
  position: relative;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border: 1px solid rgba(120, 112, 99, 0.12);
  border-radius: 1rem;
  background-color: #dedbd4;
  background-image:
    radial-gradient(circle at 18% 16%, rgba(255,255,255,.58), transparent 32%),
    radial-gradient(circle at 82% 84%, rgba(108,99,85,.1), transparent 38%),
    linear-gradient(145deg, rgba(255,255,255,.16), rgba(96,89,78,.05));
  box-shadow: inset 0 0 44px rgba(94, 87, 76, 0.08);
}

.outfit-board::after {
  position: absolute;
  inset: 0;
  z-index: 50;
  pointer-events: none;
  content: '';
  opacity: .28;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.16'/%3E%3C/svg%3E");
  mix-blend-mode: multiply;
}

.outfit-board-light {
  position: absolute;
  inset: 8% 10%;
  z-index: 0;
  border-radius: 50%;
  background: rgba(255,255,255,.28);
  filter: blur(28px);
}

.outfit-board-piece {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: .75rem;
  color: #8b877f;
  transition: transform .18s ease;
}

.outfit-board-piece:hover { transform: translateY(-2px) scale(1.01); }

.outfit-board-piece--bottom {
  top: 42%;
  left: 20%;
  z-index: 10;
  width: 60%;
  height: 54%;
}

.outfit-board-piece--inner {
  top: 12%;
  left: 25%;
  z-index: 20;
  width: 50%;
  height: 44%;
}

.outfit-board-piece--outer {
  top: 5%;
  left: 10%;
  z-index: 30;
  width: 80%;
  height: 55%;
}

.outfit-board--no-outer .outfit-board-piece--inner {
  top: 7%;
  left: 17%;
  width: 66%;
  height: 52%;
}

.outfit-board--no-inner .outfit-board-piece--outer {
  top: 7%;
  left: 13%;
  width: 74%;
  height: 54%;
}

.outfit-board--no-outer.outfit-board--no-inner .outfit-board-piece--bottom {
  top: 12%;
  left: 17%;
  width: 66%;
  height: 76%;
}

.outfit-board--no-bottom .outfit-board-piece--outer,
.outfit-board--no-bottom .outfit-board-piece--inner {
  top: 17%;
}

.outfit-board-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 12px 10px rgba(59, 54, 46, .17));
  mix-blend-mode: multiply;
}

.outfit-board-placeholder {
  display: flex;
  width: 68%;
  height: 68%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .35rem;
  border: 1px dashed rgba(96, 91, 82, .28);
  border-radius: 1rem;
  background: rgba(255,255,255,.18);
  font-size: .55rem;
  letter-spacing: .08em;
}

.outfit-board-label {
  position: absolute;
  right: .2rem;
  bottom: .2rem;
  padding: .2rem .42rem;
  border: 1px solid rgba(255,255,255,.68);
  border-radius: .4rem;
  background: rgba(255,255,255,.8);
  color: #34312c;
  font-size: .55rem;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 3px 10px rgba(66,60,50,.08);
  backdrop-filter: blur(6px);
}
</style>
