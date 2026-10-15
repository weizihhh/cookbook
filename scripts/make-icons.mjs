// 生成 PWA 应用图标 —— 纯 node 实现(zlib PNG 编码 + SDF 绘制),无外部依赖
// 设计:薄荷绿 #00b578(与主题 --cb-primary 一致)圆角底 + 白色饭碗(半圆碗身+圆角碗沿)+ 白色薄荷叶
// 产物:public/icons/{icon-192,icon-512,maskable-512,apple-touch-icon}.png
// 想换设计:改下面的 SHAPES 常量后重跑 `node scripts/make-icons.mjs`
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const BG = [0x00, 0xb5, 0x78]
const FG = [0xff, 0xff, 0xff]

// ---------- PNG 编码(RGBA 8bit) ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const stride = w * 4 + 1
  const raw = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0 // filter: none
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- SDF 形状(归一化坐标 0..1) ----------
const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r
const sdRoundRect = (x, y, cx, cy, hw, hh, r) => {
  const dx = Math.abs(x - cx) - (hw - r)
  const dy = Math.abs(y - cy) - (hh - r)
  const ax = Math.max(dx, 0)
  const ay = Math.max(dy, 0)
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(ax, ay) - r
}
const sdEllipseRot = (x, y, cx, cy, a, b, ang) => {
  const ca = Math.cos(-ang)
  const sa = Math.sin(-ang)
  const dx = x - cx
  const dy = y - cy
  return (Math.hypot((dx * ca - dy * sa) / a, (dx * sa + dy * ca) / b) - 1) * Math.min(a, b)
}

/** 白碗图形 = 下半圆碗身 ∪ 碗沿圆角横条(宽度≈碗口) ∪ 斜置叶片(并集取 min,半圆用交集 max 构造) */
function glyphSd(x, y) {
  const bowl = Math.max(sdCircle(x, y, 0.5, 0.55, 0.26), 0.55 - y)
  const rim = sdRoundRect(x, y, 0.5, 0.55, 0.275, 0.024, 0.024)
  const leaf = sdEllipseRot(x, y, 0.585, 0.33, 0.12, 0.058, -Math.PI / 3)
  return Math.min(bowl, rim, leaf)
}

/** 画一枚图标。maskable=true 时背景全出血(系统裁成圆),否则 22% 圆角+透明角 */
function drawIcon(size, { maskable = false } = {}) {
  const SS = 3 // 3x3 超采样抗锯齿
  const rgba = Buffer.alloc(size * size * 4)
  const px = 1 / size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS) * px
          const ny = (y + (sy + 0.5) / SS) * px
          const bgSd = maskable ? -1 : sdRoundRect(nx, ny, 0.5, 0.5, 0.5, 0.5, 0.22)
          if (bgSd < 0) {
            const isFg = glyphSd(nx, ny) < 0
            r += isFg ? FG[0] : BG[0]
            g += isFg ? FG[1] : BG[1]
            b += isFg ? FG[2] : BG[2]
            a += 255
          }
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      rgba[i] = Math.round(r / n)
      rgba[i + 1] = Math.round(g / n)
      rgba[i + 2] = Math.round(b / n)
      rgba[i + 3] = Math.round(a / n)
    }
  }
  return rgba
}

mkdirSync(OUT_DIR, { recursive: true })
const outputs = [
  ['icon-192.png', drawIcon(192)],
  ['icon-512.png', drawIcon(512)],
  ['maskable-512.png', drawIcon(512, { maskable: true })],
  ['apple-touch-icon.png', drawIcon(180, { maskable: true })], // iOS 自裁圆角,底图全出血
]
for (const [name, rgba] of outputs) {
  const size = Math.sqrt(rgba.length / 4) | 0
  writeFileSync(join(OUT_DIR, name), encodePNG(size, size, rgba))
  console.log(`written ${name} (${size}x${size})`)
}
