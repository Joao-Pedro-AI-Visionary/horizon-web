import { createRouter, createWebHistory } from 'vue-router'
import FeedView from '../views/FeedView.vue'
import { useAdmin } from '../stores/admin'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'feed', component: FeedView, meta: { title: 'Feed' } },
    { path: '/items/:id(\\d+)', name: 'item', component: () => import('../views/ItemView.vue'), meta: { title: 'Item' } },
    { path: '/digests/:date?', name: 'digests', component: () => import('../views/DigestsView.vue'), meta: { title: 'Digests' } },
    { path: '/sources', name: 'sources', component: () => import('../views/SourcesView.vue'), meta: { title: 'Fontes & Config', admin: true } },
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { title: 'Entrar' } },
    { path: '/metrics', name: 'metrics', component: () => import('../views/MetricsView.vue'), meta: { title: 'Métricas' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue'), meta: { title: 'Não encontrado' } },
  ],
  // Filter changes only touch the query: keep the scroll position there.
  scrollBehavior: (to, from, saved) => saved ?? (to.path === from.path ? false : { top: 0 }),
})

// Admin pages (Fontes & Config) exist only after login: everyone else is sent
// to /login, which comes back here once signed in.
router.beforeEach(async (to) => {
  if (!to.meta.admin) return true
  const admin = useAdmin()
  await admin.init()
  return admin.canEdit ? true : { name: 'login', query: { next: to.fullPath } }
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? 'Radar')} · Radar by JpDev`
})
