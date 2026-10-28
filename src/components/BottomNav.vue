<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppIcon from './AppIcon.vue'

const route = useRoute()
const entries = [
  { to: '/closet', label: 'クローゼット', icon: 'hanger' },
  { to: '/ai', label: 'AIコーデ', icon: 'sparkles' },
  { to: '/settings', label: '設定', icon: 'settings' },
] as const
</script>

<template>
  <nav class="bottom-nav" aria-label="メインメニュー">
    <div class="mx-auto grid max-w-[560px] grid-cols-3">
      <RouterLink
        v-for="entry in entries"
        :key="entry.to"
        :to="entry.to"
        class="flex min-h-[66px] flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide transition-colors"
        :class="route.path.startsWith(entry.to) ? 'text-neutral-950' : 'text-neutral-400 hover:text-neutral-600'"
        :aria-current="route.path.startsWith(entry.to) ? 'page' : undefined"
      >
        <AppIcon :name="entry.icon" :size="22" />
        <span>{{ entry.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>
