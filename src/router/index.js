import { createRouter, createWebHashHistory } from 'vue-router'

// hash 模式:纯静态部署零配置,二期托管到任意静态平台都无需服务端回退配置
const routes = [
  { path: '/', redirect: '/today' },
  { path: '/today', component: () => import('../views/TodayView.vue') },
  { path: '/week', component: () => import('../views/WeekView.vue') },
  { path: '/library', component: () => import('../views/LibraryView.vue') },
  { path: '/profile', component: () => import('../views/ProfileView.vue') },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
