<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-6 py-12">
    <div class="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-950 text-white">
      <AppIcon name="hanger" :size="26" />
    </div>
    <p class="eyebrow">MY CLOSET / SETUP</p>
    <h1 class="mt-3 text-[26px] font-bold tracking-tight sm:text-[28px]">Supabaseの設定が必要です</h1>
    <p class="mt-4 text-sm leading-7 text-neutral-600">
      データの保存とログインにはSupabaseを使用します。接続情報がない場合、ログインや登録はできません。
    </p>
    <div class="surface-card mt-8 p-5">
      <ol class="list-inside list-decimal space-y-3 text-sm leading-6 text-neutral-700">
        <li>Supabaseプロジェクトを作成する</li>
        <li><code>supabase/migrations</code> のSQLを適用する</li>
        <li><code>.env.example</code> を <code>.env.local</code> にコピーしてURLと公開anonキーを設定する</li>
        <li>開発サーバーを再起動する</li>
      </ol>
    </div>
    <p class="mt-6 text-xs leading-6 text-neutral-500">詳しい手順はREADME.mdをご確認ください。サービスロールキーはブラウザに設定しないでください。</p>
  </main>
</template>
