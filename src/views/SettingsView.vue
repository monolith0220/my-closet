<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../lib/auth-context'
import { supabase } from '../lib/supabase'

const session = useSession()
const signingOut = ref(false)
const errorMessage = ref('')

async function signOut() {
  if (!supabase || signingOut.value) return
  signingOut.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'ログアウトに失敗しました。'
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <main class="page-shell">
    <h1 class="sr-only">設定</h1>
    <section class="surface-card p-5">
      <p class="eyebrow">ACCOUNT</p>
      <h2 class="mt-3 text-base font-bold">ログイン中</h2>
      <p class="mt-1 break-all text-sm text-neutral-600">{{ session?.user.email }}</p>
    </section>
    <section class="surface-card mt-4 p-5">
      <p class="eyebrow">ABOUT</p>
      <h2 class="mt-3 text-base font-bold">My Closet</h2>
      <p class="mt-2 text-xs leading-6 text-neutral-500">手持ちの洋服をひとつの場所に。写真と商品情報を保存して、いつでも見返せます。</p>
      <p class="mt-3 text-[11px] text-neutral-400">AIコーデ提案と購入履歴の一括登録は今後追加予定です。</p>
    </section>
    <p v-if="errorMessage" role="alert" class="mt-5 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{{ errorMessage }}</p>
    <button type="button" class="secondary-button mt-7 w-full" :disabled="signingOut" @click="signOut"><AppIcon name="logout" :size="18" />{{ signingOut ? 'ログアウト中...' : 'ログアウト' }}</button>
  </main>
</template>
