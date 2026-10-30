<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppIcon from './AppIcon.vue'

const route = useRoute()
const entries = [
  { to: '/closet', label: 'クローゼット', icon: 'hanger' },
  { to: '/search', label: '検索', icon: 'search' },
  { to: '/outfits', label: 'コーデ', icon: 'shirt' },
  { to: '/ai', label: 'AIコーデ', icon: 'sparkles' },
  { to: '/settings', label: '設定', icon: 'settings' },
] as const

function target(to: string) {
  if (to === '/search') {
    return { path: '/closet', query: { ...(route.path === '/closet' ? route.query : {}), search: '1' } }
  }
  if (to === '/closet' && route.path === '/closet') {
    const query = { ...route.query }
    delete query.search
    return { path: '/closet', query }
  }
  return to
}

function active(to: string): boolean {
  if (to === '/search') return route.path === '/closet' && route.query.search === '1'
  if (to === '/closet') return route.path.startsWith('/closet') && route.query.search !== '1'
  return route.path.startsWith(to)
}
</script>

<template>
  <nav class="bottom-nav" aria-label="メインメニュー">
    <div class="mx-auto grid max-w-[560px] grid-cols-5">
      <RouterLink
        v-for="entry in entries"
        :key="entry.to"
        :to="target(entry.to)"
        class="flex min-h-[66px] flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide transition-colors"
        :class="active(entry.to) ? 'text-neutral-950' : 'text-neutral-400 hover:text-neutral-600'"
        :aria-current="active(entry.to) ? 'page' : undefined"
      >
        <AppIcon :name="entry.icon" :size="22" />
        <span>{{ entry.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>
