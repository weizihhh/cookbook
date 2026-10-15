import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'

export default defineConfig({
  // 相对 base:hash 路由与 ./ 相对引用的 SW/manifest 下,可部署到任意静态平台的子路径;
  // 改回绝对路径会导致子路径部署白屏(评审 v6 F-1)
  base: './',
  plugins: [
    vue(),
    // Vant 按需引入:模板组件及其样式由 resolver 自动注入;
    // 函数式组件(showToast 等)的样式需在 main.js 手动引入
    Components({ resolvers: [VantResolver()], dirs: [], dts: false }),
  ],
})
