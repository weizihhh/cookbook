import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Vant 函数式组件样式:showToast/showConfirmDialog 直接 import 自 'vant',
// 按需 resolver 只解析模板标签,这些样式必须在入口手动引入(模板组件样式由 resolver 注入)
import 'vant/es/toast/style'
import 'vant/es/dialog/style'
import App from './App.vue'
import router from './router'
import { useCustomFoodsStore } from './stores/customFoods'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
// 自定义食物启动时注册进运行时 FOODS_MAP/RECIPES_MAP(幂等;增删改时 store 内部自同步),
// 不再依赖各视图 setup 里调用
useCustomFoodsStore().sync()
app.mount('#app')

// PWA:仅生产构建注册 service worker(dev 不注册,避免 HMR 缓存干扰;
// vite preview 与正式部署同源,离线壳同样生效)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}
