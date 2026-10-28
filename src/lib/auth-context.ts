import { inject, type InjectionKey, type ShallowRef } from 'vue'
import type { Session } from '@supabase/supabase-js'

export const authSessionKey: InjectionKey<ShallowRef<Session | null>> = Symbol('auth-session')

export function useSession(): ShallowRef<Session | null> {
  const session = inject(authSessionKey)
  if (!session) throw new Error('認証状態を取得できません。')
  return session
}
