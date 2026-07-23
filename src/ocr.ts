import { createWorker } from 'tesseract.js'
import type { Message } from './types'

const DATE_LINE = /^(\d{1,4}[./年-]\d{1,2}[./月-]\d{1,2}日?|\d{1,2}:\d{2}|星期[一二三四五六日天]|昨天|今天|以下为)/
export type OcrStatus = { progress: number; label: string }
type Box = { x0:number; y0:number; x1:number; y1:number }

async function imagePixels(file: File) {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width; canvas.height = bitmap.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return { pixels: context.getImageData(0, 0, canvas.width, canvas.height), width: canvas.width }
}

function isGreenBubble(pixels: ImageData, x: number, y: number) {
  const { data, width, height } = pixels
  for (let dy = -5; dy <= 5; dy += 2) for (let dx = -16; dx <= 16; dx += 2) {
    const px = Math.max(0, Math.min(width - 1, x + dx)), py = Math.max(0, Math.min(height - 1, y + dy))
    const i = (py * width + px) * 4, r = data[i], g = data[i + 1], b = data[i + 2]
    if (g > r + 28 && g > b + 45 && g > 150) return true
  }
  return false
}

function senderForBubble(box: Box, pixels: ImageData, width: number) {
  const midY = Math.round((box.y0 + box.y1) / 2)
  if (isGreenBubble(pixels, box.x0 - 12, midY) || isGreenBubble(pixels, box.x1 + 12, midY)) return '我'
  const midX = (box.x0 + box.x1) / 2
  if (midX > width * .58) return '我'
  if (midX < width * .44) return '对方'
  return null
}

export async function recognizeScreenshots(files: File[], onProgress: (status: OcrStatus) => void): Promise<Message[]> {
  onProgress({ progress: 0.03, label: '正在启动本地识别引擎…' })
  const worker = await createWorker('chi_sim', 1, {
    langPath: '/tessdata', workerPath: '/tesseract/worker.min.js', corePath: '/tesseract/tesseract-core-lstm.js', gzip: false, workerBlobURL: false,
    logger: item => {
      const labels: Record<string, string> = { 'loading tesseract core':'正在加载本地识别引擎…', 'loading language traineddata':'正在加载本地中文识别模型…', 'initializing tesseract':'正在初始化识别器…', 'recognizing text':'正在识别截图文字…' }
      onProgress({ progress: item.status === 'recognizing text' ? item.progress : Math.min(.9, .08 + item.progress * .5), label: labels[item.status] ?? '正在准备本地识别…' })
    }
  })
  const messages: Message[] = []
  try {
    for (let index = 0; index < files.length; index++) {
      onProgress({ progress: index / files.length, label: `正在识别第 ${index + 1}/${files.length} 张截图…` })
      const [{ data }, image] = await Promise.all([worker.recognize(files[index], {}, { blocks: true }), imagePixels(files[index])])
      const lines = data.blocks?.flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines)) ?? []
      lines.map(line => ({ content: line.text.trim(), box: line.bbox })).filter(line => line.content.length >= 2 && !DATE_LINE.test(line.content)).forEach(line => {
        const sender = senderForBubble(line.box, image.pixels, image.width)
        if (sender) messages.push({ sender, content: line.content, time: `截图 ${index + 1}` })
      })
    }
    return messages
  } finally { await worker.terminate() }
}
