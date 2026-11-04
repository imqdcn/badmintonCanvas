import type { BracketSize } from './types'
import { roundCount } from './bracket'

// 对阵图的几何布局：全部用像素坐标，方便用绝对定位精确还原效果图。

export const CANVAS_W = 725
export const HEADER_H = 95
export const FOOTER_H = 24
const MARGIN_X = 10
const COL_GAP = 6
const SECTION_GAP = 20
const PAD_TOP = 10
const PAD_BOTTOM = 10
export const SECTIONS = 4

export interface Layout {
  size: BracketSize
  R: number // 轮数
  cols: { x: number; w: number }[] // 每一列（每一轮）的 x 和宽度，共 R 列
  rowH: number // 选手行高度
  fontSize: number // 所有轮次统一的选手名字号
  pitch: number // 首轮相邻两个位置的间距
  bodyH: number
  centerY: (round: number, index: number) => number
  dividerYs: number[] // 分区虚线 y 坐标
  sectionBottoms: number[] // 每个分区底部 y 坐标
}

export function computeLayout(size: BracketSize): Layout {
  const R = roundCount(size)
  // 所有列等宽，这样每一轮都能放下同样长度的名字、用同一个字号
  const base = Array.from({ length: R }, () => 100)
  const avail = CANVAS_W - MARGIN_X * 2 - COL_GAP * (R - 1)
  const scale = avail / base.reduce((a, b) => a + b, 0)
  const cols: Layout['cols'] = []
  let x = MARGIN_X
  for (const w of base) {
    const ww = w * scale
    cols.push({ x, w: ww })
    x += ww + COL_GAP
  }

  const pitch = Math.max(26, 820 / size)
  const rowH = Math.min(24, pitch - 2)
  const perSection = size / SECTIONS
  // 64 强有 6 列放不下，统一缩小一点；其余规模所有轮次字号一致
  const fontSize = R >= 6 ? 10 : 12

  const firstY = (j: number) =>
    PAD_TOP + j * pitch + pitch / 2 + Math.floor(j / perSection) * SECTION_GAP

  const centerY = (round: number, index: number): number => {
    if (round === 0) return firstY(index)
    return (centerY(round - 1, index * 2) + centerY(round - 1, index * 2 + 1)) / 2
  }

  const dividerYs: number[] = []
  const sectionBottoms: number[] = []
  for (let s = 0; s < SECTIONS; s++) {
    const bottom = PAD_TOP + (s + 1) * perSection * pitch + s * SECTION_GAP
    sectionBottoms.push(bottom)
    if (s < SECTIONS - 1) dividerYs.push(bottom + SECTION_GAP / 2)
  }

  const bodyH = PAD_TOP + size * pitch + (SECTIONS - 1) * SECTION_GAP + PAD_BOTTOM
  return { size, R, cols, rowH, fontSize, pitch, bodyH, centerY, dividerYs, sectionBottoms }
}

/** 总高度：头部 + 主体 + 底部色带 */
export function canvasHeight(layout: Layout): number {
  return HEADER_H + layout.bodyH + FOOTER_H
}
