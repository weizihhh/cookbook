// 构建后处理:把 dist/sw.js 的 CACHE 版号替换为 index.html 引用的主 chunk 哈希。
// 任何源码变化都会体现为哈希文件名变化 → CACHE 名随之变化 → SW 判定更新、
// activate 清旧缓存,发版不再依赖"记得手动 bump 版本号"(评审 v6 F-6)。
// public/sw.js 里的常量值只是源码占位,构建产物中总是被重写。
import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('dist/index.html', 'utf8')
const m = html.match(/assets\/index-([\w-]+)\.js/)
if (!m) throw new Error('dist/index.html 未找到主 chunk 哈希,无法生成 SW 缓存版本')

const sw = readFileSync('dist/sw.js', 'utf8')
const next = sw.replace(/const CACHE = '[^']*'/, `const CACHE = 'cookbook-shell-${m[1]}'`)
if (next === sw) throw new Error('dist/sw.js 未匹配到 CACHE 常量,替换未生效')

writeFileSync('dist/sw.js', next)
console.log(`sw.js CACHE -> cookbook-shell-${m[1]}`)
