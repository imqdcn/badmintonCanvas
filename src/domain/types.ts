// 领域类型：与 React 无关，只描述数据长什么样

/** 5 种项目：男单、女单、男双、女双、混双 */
export type Mode = 'MS' | 'WS' | 'MD' | 'WD' | 'XD'

export interface ModeInfo {
  id: Mode
  label: string // 完整名称
  short: string // 标题里用的简称
  double: boolean // 是否双打
}

export const MODES: ModeInfo[] = [
  { id: 'MS', label: '男子单打', short: '男单', double: false },
  { id: 'WS', label: '女子单打', short: '女单', double: false },
  { id: 'MD', label: '男子双打', short: '男双', double: true },
  { id: 'WD', label: '女子双打', short: '女双', double: true },
  { id: 'XD', label: '混合双打', short: '混双', double: true },
]

export function modeInfo(id: Mode): ModeInfo {
  return MODES.find((m) => m.id === id)!
}

/** 一位选手 */
export interface PlayerRef {
  name: string // 中文名
  nameEn: string // 英文名
  country: string // BWF 三字母国家代码，如 KOR
}

/** 名单里的一条记录：单打 1 位选手，双打 2 位选手 */
export interface RosterEntry {
  id: string
  mode: Mode
  rank: number | null // 自定义条目没有排名
  players: PlayerRef[]
  custom?: boolean
}

/** 对阵图里的一个位置 */
export interface Slot {
  players: PlayerRef[]
  seed?: number // 种子序号
  bye?: boolean // 轮空，显示为 "-"
}

/** 产生某个位置的那场比赛的信息（比分、备注） */
export interface MatchInfo {
  score: string
  note: string
}

export type BracketSize = 8 | 16 | 32 | 64
export const BRACKET_SIZES: BracketSize[] = [8, 16, 32, 64]

/**
 * 对阵图数据。
 * slots[r][i]：第 r 轮的第 i 个位置。
 *   r = 0 是首轮（size 个位置），逐轮减半，最后一轮 slots[R] 只有 1 个位置，即冠军。
 * info[r][i]：产生 slots[r][i] 的那场比赛的比分和备注（r = 0 时没有意义）。
 */
export interface BracketData {
  size: BracketSize
  slots: Slot[][]
  info: MatchInfo[][]
}
