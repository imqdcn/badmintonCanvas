import type { BracketData, BracketSize, MatchInfo, PlayerRef, Slot } from './types'

// 对阵图的纯函数：创建、修改、晋级。所有函数都返回新对象，不修改入参。

export const emptySlot = (): Slot => ({ players: [] })
export const emptyInfo = (): MatchInfo => ({ score: '', note: '' })

/** 轮数 R：32 强 -> 5（32,16,8,4,2 个位置），再加 1 个冠军位置 */
export function roundCount(size: BracketSize): number {
  return Math.log2(size)
}

export function createBracket(size: BracketSize): BracketData {
  const R = roundCount(size)
  const slots: Slot[][] = []
  const info: MatchInfo[][] = []
  for (let r = 0; r <= R; r++) {
    const n = size >> r
    slots.push(Array.from({ length: n }, emptySlot))
    info.push(Array.from({ length: n }, emptyInfo))
  }
  return { size, slots, info }
}

export function isEmptySlot(s: Slot): boolean {
  return s.players.length === 0 && !s.bye
}

/** 用来判断两个位置是不是同一个选手/组合 */
export function slotKey(s: Slot): string {
  if (s.bye) return 'BYE'
  return s.players.map(playerKey).join('|')
}

/** 单个选手的唯一标识（英文名优先，加国家代码） */
export function playerKey(p: PlayerRef): string {
  return `${p.nameEn || p.name}@${p.country}`
}

/**
 * 首轮所有位置里已经出现的选手（用于下拉去重）。
 * exclude：正在编辑的首轮位置不计入，这样可以重新选回同一个人。
 */
export function usedPlayerKeys(
  b: BracketData,
  exclude?: { round: number; index: number },
): Set<string> {
  const used = new Set<string>()
  b.slots[0].forEach((s, i) => {
    if (exclude && exclude.round === 0 && exclude.index === i) return
    s.players.forEach((p) => used.add(playerKey(p)))
  })
  return used
}

export function bracketHasData(b: BracketData): boolean {
  return (
    b.slots.some((round) => round.some((s) => !isEmptySlot(s) || s.seed)) ||
    b.info.some((round) => round.some((m) => m.score || m.note))
  )
}

export function roundLabel(size: BracketSize, r: number): string {
  const R = roundCount(size)
  if (r === R) return '冠军'
  if (r === R - 1) return '决赛'
  if (r === R - 2) return '半决赛'
  return `${size >> r}强`
}

function replaceSlot(b: BracketData, r: number, i: number, slot: Slot): BracketData {
  const slots = b.slots.map((round, ri) =>
    ri === r ? round.map((s, si) => (si === i ? slot : s)) : round,
  )
  return { ...b, slots }
}

export interface ChangeResult {
  bracket: BracketData
  /** 因为改动被连带清除的后续轮次位置数量 */
  cleared: number
  /** 改动被拒绝时的原因（此时 bracket 原样返回） */
  blocked?: string
}

export const LATER_ROUND_MSG = '后续轮次只能从上一轮这场比赛的两位选手中选择晋级者，不能选其他选手'

function blockedResult(b: BracketData, reason: string): ChangeResult {
  return { bracket: b, cleared: 0, blocked: reason }
}

/**
 * 修改某个位置。
 * 如果原来的选手已经晋级到后面的轮次，而这次被改成了别人，
 * 就把后面轮次里同一个人的位置清掉（避免出现"没赢的人却在下一轮"），并返回清除数量用来提示。
 */
export function setSlot(b: BracketData, r: number, i: number, next: Slot): ChangeResult {
  const R = roundCount(b.size)
  const oldKey = slotKey(b.slots[r][i])
  let bracket = replaceSlot(b, r, i, next)
  let cleared = 0
  if (oldKey && oldKey !== slotKey(next)) {
    let ri = r + 1
    let ii = i >> 1
    while (ri <= R && slotKey(bracket.slots[ri][ii]) === oldKey) {
      bracket = replaceSlot(bracket, ri, ii, emptySlot())
      bracket = setInfo(bracket, ri, ii, emptyInfo())
      cleared++
      ri++
      ii >>= 1
    }
  }
  return { bracket, cleared }
}

/** 设置选手，保留原来的种子序号 */
export function setPlayers(
  b: BracketData,
  r: number,
  i: number,
  players: PlayerRef[],
): ChangeResult {
  // 后续轮次的选手只能由上一轮晋级产生
  if (r >= 1) return blockedResult(b, LATER_ROUND_MSG)
  const old = b.slots[r][i]
  const next: Slot = { players }
  if (old.seed) next.seed = old.seed
  return setSlot(b, r, i, next)
}

export function patchSlot(
  b: BracketData,
  r: number,
  i: number,
  patch: Partial<Slot>,
): ChangeResult {
  const old = b.slots[r][i]
  if (r >= 1 && 'seed' in patch) {
    return blockedResult(b, '种子序号请在首轮设置，晋级后会自动带到后面的轮次')
  }
  const next: Slot = { ...old, ...patch }
  if (patch.bye) next.players = [] // 轮空就没有选手
  if (!next.seed) delete next.seed
  if (!next.bye) delete next.bye
  const res = setSlot(b, r, i, next)
  // 种子变化时，同步到已晋级到后面轮次的同一位选手
  if ('seed' in patch) {
    const key = slotKey(old)
    let bracket = res.bracket
    const R = roundCount(b.size)
    let ri = r + 1
    let ii = i >> 1
    while (ri <= R && key && slotKey(bracket.slots[ri][ii]) === key) {
      const s = { ...bracket.slots[ri][ii] }
      if (next.seed) s.seed = next.seed
      else delete s.seed
      bracket = replaceSlot(bracket, ri, ii, s)
      ri++
      ii >>= 1
    }
    return { ...res, bracket }
  }
  return res
}

export function clearSlot(b: BracketData, r: number, i: number): ChangeResult {
  return setSlot(b, r, i, emptySlot())
}

export function setInfo(
  b: BracketData,
  r: number,
  i: number,
  patch: Partial<MatchInfo>,
): BracketData {
  const info = b.info.map((round, ri) =>
    ri === r ? round.map((m, mi) => (mi === i ? { ...m, ...patch } : m)) : round,
  )
  return { ...b, info }
}

/** 把第 r 轮第 i 个位置的选手晋级到下一轮 */
export function advance(b: BracketData, r: number, i: number): ChangeResult {
  const R = roundCount(b.size)
  const src = b.slots[r][i]
  if (r >= R || isEmptySlot(src)) return { bracket: b, cleared: 0 }
  const next: Slot = { players: [...src.players] }
  if (src.seed) next.seed = src.seed
  if (src.bye) next.bye = true
  return setSlot(b, r + 1, i >> 1, next) // 父位置在下一轮
}

/** 该位置是否已经晋级（下一轮的父位置是同一个选手） */
export function isAdvanced(b: BracketData, r: number, i: number): boolean {
  const R = roundCount(b.size)
  if (r >= R) return false
  const s = b.slots[r][i]
  return !isEmptySlot(s) && slotKey(b.slots[r + 1][i >> 1]) === slotKey(s)
}

/**
 * 校正对阵图：后续轮次里的选手必须是上一轮对应两个位置之一，否则清空。
 * 用来修复旧版本保存下来的、后续轮次被手动选成无关选手的数据。
 */
export function sanitizeBracket(b: BracketData): BracketData {
  let bracket = b
  const R = roundCount(b.size)
  for (let r = 1; r <= R; r++) {
    for (let i = 0; i < bracket.slots[r].length; i++) {
      const s = bracket.slots[r][i]
      if (isEmptySlot(s) || s.bye) continue
      const key = slotKey(s)
      const a = slotKey(bracket.slots[r - 1][2 * i])
      const c = slotKey(bracket.slots[r - 1][2 * i + 1])
      if (key !== a && key !== c) {
        bracket = replaceSlot(bracket, r, i, emptySlot())
        bracket = setInfo(bracket, r, i, emptyInfo())
      }
    }
  }
  return bracket
}
