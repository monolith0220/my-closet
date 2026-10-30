import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/closet' },
    { path: '/closet', name: 'closet', component: () => import('../views/ClosetView.vue') },
    { path: '/closet/new', name: 'new-item', component: () => import('../views/ItemFormView.vue') },
    { path: '/closet/import', name: 'import-items', component: () => import('../views/ImportView.vue') },
    { path: '/closet/photos/import', name: 'import-photos', component: () => import('../views/PhotoImportView.vue') },
    { path: '/closet/:id/edit', name: 'edit-item', component: () => import('../views/ItemFormView.vue') },
    { path: '/closet/:id', name: 'item', component: () => import('../views/ItemDetailView.vue') },
    { path: '/search', name: 'search', redirect: to => ({ path: '/closet', query: { ...to.query, search: '1' } }) },
    { path: '/outfits', name: 'outfits', component: () => import('../views/OutfitsView.vue') },
    { path: '/ai', name: 'ai', component: () => import('../views/AiView.vue') },
    { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/closet' },
  ],
  scrollBehavior(to, from) {
    if (to.path === '/closet' && from.path === '/closet') return false
    return { top: 0 }
  },
})

export default router
