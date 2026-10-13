// Tesseract.js 懒加载封装
//
// 仅在实际拍照导入时才动态加载识别组件;wasm 核心与中文语言包(chi_sim)
// 首次使用时从 CDN 下载(约 10-25MB),之后走浏览器缓存,离线可用。
// 离线/下载失败时不阻塞主流程 —— 调用方退化为"看照片手填"。

let workerPromise = null

async function getWorker(onStatus) {
  if (!workerPromise) {
    workerPromise = (async () => {
      onStatus?.('加载识别组件…')
      const { createWorker } = await import('tesseract.js')
      return createWorker('chi_sim', 1, {
        logger: (m) => {
          if (m.status === 'loading tesseract core') onStatus?.('加载识别引擎…')
          else if (m.status === 'loading language traineddata')
            onStatus?.(`下载中文识别包 ${Math.round((m.progress || 0) * 100)}%(仅首次)`)
          else if (m.status === 'initializing api' || m.status === 'initializing tesseract')
            onStatus?.('初始化引擎…')
          else if (m.status === 'recognizing text') onStatus?.(`识别中 ${Math.round((m.progress || 0) * 100)}%`)
        },
      })
    })().catch((e) => {
      workerPromise = null // 失败后允许下次重试
      throw e
    })
  }
  return workerPromise
}

/** 识别图片文字,返回纯文本(不在此处做任何字段解析) */
export async function scanImageText(file, onStatus) {
  const worker = await getWorker(onStatus)
  const { data } = await worker.recognize(file)
  return data.text || ''
}
