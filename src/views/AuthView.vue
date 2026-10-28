<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { supabase } from '../lib/supabase'

const mode = ref<'login' | 'signup'>('login')
const email = ref('')
const password = ref('')
const busy = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')

async function submit() {
  if (!supabase || busy.value) return
  errorMessage.value = ''
  infoMessage.value = ''
  busy.value = true
  try {
    if (mode.value === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value })
      if (error) throw error
    } else {
      const { data, error } = await supabase.auth.signUp({ email: email.value.trim(), password: password.value })
      if (error) throw error
      if (!data.session) infoMessage.value = '確認メールを送信しました。メール内のリンクを開いてからログインしてください。'
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '認証に失敗しました。'
  } finally {
    busy.value = false
  }
}

function changeMode(next: 'login' | 'signup') {
  mode.value = next
  errorMessage.value = ''
  infoMessage.value = ''
}
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-[560px] flex-col px-6 pb-12 pt-14 sm:justify-center sm:pt-12">
    <div class="mb-12">
      <div class="mb-7 flex h-14 w-14 items-center justify-center rounded-[20px] bg-neutral-950 text-white shadow-lg shadow-neutral-900/10">
        <AppIcon name="hanger" :size="29" />
      </div>
      <p class="eyebrow">YOUR EVERYDAY WARDROBE</p>
      <h1 class="mt-3 text-[34px] font-bold leading-tight tracking-tight">My Closet</h1>
      <p class="mt-3 max-w-sm text-sm leading-7 text-neutral-500">お気に入りの服を、いつでもあなたの手の中に。</p>
    </div>

    <section class="surface-card p-6 sm:p-8">
      <div class="mb-7 flex rounded-xl bg-neutral-100 p-1" role="tablist" aria-label="認証方法">
        <button type="button" role="tab" :aria-selected="mode === 'login'" class="flex-1 rounded-lg py-2.5 text-sm font-semibold transition" :class="mode === 'login' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-400'" @click="changeMode('login')">ログイン</button>
        <button type="button" role="tab" :aria-selected="mode === 'signup'" class="flex-1 rounded-lg py-2.5 text-sm font-semibold transition" :class="mode === 'signup' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-400'" @click="changeMode('signup')">新規登録</button>
      </div>

      <h2 class="text-xl font-bold">{{ mode === 'login' ? 'おかえりなさい' : 'クローゼットをはじめる' }}</h2>
      <p class="mt-2 text-xs leading-6 text-neutral-500">{{ mode === 'login' ? 'メールアドレスとパスワードを入力してください。' : 'メールアドレスでアカウントを作成します。' }}</p>

      <form class="mt-7 space-y-5" @submit.prevent="submit">
        <div>
          <label for="auth-email" class="field-label">メールアドレス</label>
          <div class="relative"><AppIcon name="mail" :size="18" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" /><input id="auth-email" v-model="email" class="field-input pl-11" type="email" autocomplete="email" placeholder="you@example.com" required /></div>
        </div>
        <div>
          <label for="auth-password" class="field-label">パスワード</label>
          <div class="relative"><AppIcon name="lock" :size="18" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" /><input id="auth-password" v-model="password" class="field-input pl-11" type="password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" minlength="6" placeholder="6文字以上" required /></div>
        </div>
        <p v-if="errorMessage" role="alert" class="rounded-xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">{{ errorMessage }}</p>
        <p v-if="infoMessage" role="status" class="rounded-xl bg-green-50 px-4 py-3 text-xs leading-5 text-green-800">{{ infoMessage }}</p>
        <button type="submit" class="primary-button w-full" :disabled="busy">{{ busy ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウントを作成' }}<AppIcon name="arrow-right" :size="17" /></button>
      </form>
    </section>
    <p class="mt-8 text-center text-[11px] tracking-wide text-neutral-400">A MORE ORGANIZED WARDROBE, EVERY DAY.</p>
  </main>
</template>
