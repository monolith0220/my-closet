<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
</script>

<template>
  <main class="page-shell">
    <header><p class="eyebrow">AI STYLING</p><h1 class="mt-2 text-[29px] font-bold tracking-tight">AIコーデ</h1><p class="mt-2 text-xs text-neutral-500">あなたのクローゼットから、次の組み合わせへ。</p></header>
    <section class="surface-card mt-8 overflow-hidden px-7 pb-9 pt-12 text-center">
      <div class="relative mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#f0f0ee] text-neutral-800">
        <AppIcon name="sparkles" :size="42" />
        <span class="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-white"><AppIcon name="plus" :size="15" /></span>
      </div>
      <span class="rounded-full bg-neutral-100 px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] text-neutral-500">COMING SOON</span>
      <h2 class="mt-5 text-xl font-bold">コーデ提案を準備中です</h2>
      <p class="mx-auto mt-3 max-w-xs text-sm leading-7 text-neutral-500">登録した洋服とシーンに合わせて、着こなしを提案する機能を今後追加します。</p>
      <RouterLink to="/closet" class="secondary-button mt-7">クローゼットを見る<AppIcon name="arrow-right" :size="17" /></RouterLink>
    </section>
    <p class="mt-6 text-center text-xs leading-6 text-neutral-400">洋服を登録しておくと、将来の提案に活用できます。</p>
  </main>
</template>
