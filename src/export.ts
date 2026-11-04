import { toPng } from 'html-to-image'

/** 把画布节点导出为 PNG 并触发下载。导出期间给节点加 exporting 类，隐藏所有编辑控件。 */
export async function exportPng(
  node: HTMLElement,
  pixelRatio: number,
  filename: string,
): Promise<void> {
  node.classList.add('exporting')
  try {
    // 等字体和国旗图片加载完
    await document.fonts?.ready
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    const dataUrl = await toPng(node, { pixelRatio, cacheBust: true })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    a.click()
  } finally {
    node.classList.remove('exporting')
  }
}

/** 读取本地图片文件为 dataURL（不会上传到任何服务器） */
export function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** 读取本地文本文件（不会上传到任何服务器） */
export function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file, 'utf-8')
  })
}

/** 把文本保存为文件下载 */
export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
