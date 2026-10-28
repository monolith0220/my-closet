<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref, shallowRef } from 'vue'
import type { Session, Subscription } from '@supabase/supabase-js'
import { useRoute } from 'vue-router'
import BottomNav from './components/BottomNav.vue'
import AuthView from './views/AuthView.vue'
import SetupView from './views/SetupView.vue'
import { authSessionKey } from './lib/auth-context'
import { supabase } from './lib/supabase'

const route = useRoute()
const session = shallowRef<Session | null>(null)
const checkingSession = ref(Boolean(supabase))
let authSubscription: Subscription | undefined
provide(authSessionKey, session)

onMounted(async () => {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  session.value = data.session
  checkingSession.value = false
  const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
    session.value = nextSession
  })
  authSubscription = listener.subscription
})

onUnmounted(() => authSubscription?.unsubscribe())
</script>

<template>
  <div class="min-h-dvh bg-[#f7f7f5]">
    <SetupView v-if="!supabase" />
    <div v-else-if="checkingSession" class="flex min-h-dvh flex-col items-center justify-center gap-4 text-neutral-500">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-800" />
      <p class="text-sm">読み込み中...</p>
    </div>
    <AuthView v-else-if="!session" />
    <template v-else>
      <RouterView v-slot="{ Component }">
        <component :is="Component" :key="route.fullPath" />
      </RouterView>
      <BottomNav />
    </template>
  </div>
</template>
