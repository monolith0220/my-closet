<script setup lang="ts">
defineProps<{
  name: 'hanger' | 'sparkles' | 'settings' | 'plus' | 'search' | 'filter' | 'arrow-left' |
    'arrow-right' | 'camera' | 'trash' | 'edit' | 'logout' | 'check' | 'close' |
    'shirt' | 'link' | 'chevron-down' | 'image' | 'mail' | 'lock' | 'heart'
  size?: number
  filled?: boolean
}>()
</script>

<template>
  <svg :width="size ?? 22" :height="size ?? 22" viewBox="0 0 24 24" :fill="name === 'heart' && filled ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'hanger'">
      <path d="M9.5 6.5a2.5 2.5 0 1 1 4.6 1.4c-.5.7-1.8 1.1-1.8 2.1v1.2" />
      <path d="m12 11.2 8.3 5.5a1.9 1.9 0 0 1-1.1 3.3H4.8a1.9 1.9 0 0 1-1.1-3.3l8.3-5.5" />
    </template>
    <template v-else-if="name === 'sparkles'">
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="m19 17 .7 1.3L21 19l-1.3.7L19 21l-.7-1.3L17 19l1.3-.7L19 17ZM4 16l.5 1.5L6 18l-1.5.5L4 20l-.5-1.5L2 18l1.5-.5L4 16Z" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.6V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.6-1H6v-2.6h.4A1.7 1.7 0 0 0 8 10a1.7 1.7 0 0 0-.3-1.9L7.6 8l1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.6v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2.6H21a1.7 1.7 0 0 0-1.6 1.4Z" />
    </template>
    <template v-else-if="name === 'plus'"><path d="M12 5v14M5 12h14" /></template>
    <template v-else-if="name === 'search'"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></template>
    <template v-else-if="name === 'filter'"><path d="M4 7h16M7 12h10M10 17h4" /></template>
    <template v-else-if="name === 'arrow-left'"><path d="m14.5 5-7 7 7 7" /></template>
    <template v-else-if="name === 'arrow-right'"><path d="m9.5 5 7 7-7 7" /></template>
    <template v-else-if="name === 'camera'"><path d="M4 7h3l1.6-2h6.8L17 7h3a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.2" /></template>
    <template v-else-if="name === 'trash'"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" /></template>
    <template v-else-if="name === 'edit'"><path d="M4 20h16M5 15.5 15.8 4.7a2 2 0 0 1 2.8 2.8L7.8 18.3 4 19l1-3.5Z" /></template>
    <template v-else-if="name === 'logout'"><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M15 8l4 4-4 4M9 12h10" /></template>
    <template v-else-if="name === 'check'"><path d="m4 12 5 5L20 6" /></template>
    <template v-else-if="name === 'close'"><path d="M5 5 19 19M19 5 5 19" /></template>
    <template v-else-if="name === 'shirt'"><path d="m8 4 4 2 4-2 5 3-2 5-3-1v9H8v-9l-3 1-2-5 5-3Z" /><path d="M9 4c0 1.7 1.3 3 3 3s3-1.3 3-3" /></template>
    <template v-else-if="name === 'link'"><path d="M10 13a5 5 0 0 0 7 .2l2-2a5 5 0 0 0-7-7l-1.3 1.3M14 11a5 5 0 0 0-7-.2l-2 2a5 5 0 0 0 7 7l1.3-1.3" /></template>
    <template v-else-if="name === 'chevron-down'"><path d="m6 9 6 6 6-6" /></template>
    <template v-else-if="name === 'image'"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 5-5 3 3 3-4 5 6" /></template>
    <template v-else-if="name === 'mail'"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></template>
    <template v-else-if="name === 'lock'"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></template>
    <template v-else-if="name === 'heart'"><path d="M20.8 8.5c0 4.2-5.1 8.5-8.8 11-3.7-2.5-8.8-6.8-8.8-11a4.8 4.8 0 0 1 8.8-2.6 4.8 4.8 0 0 1 8.8 2.6Z" /></template>
  </svg>
</template>
