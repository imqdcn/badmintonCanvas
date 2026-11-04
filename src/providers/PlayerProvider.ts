import type { Mode, RosterEntry } from '../domain/types'
import { parseDoubles, parseSingles, type RawRow } from '../domain/roster'
import ms from '../data/mens-singles.json'
import ws from '../data/womens-singles.json'
import md from '../data/mens-doubles.json'
import wd from '../data/womens-doubles.json'
import xd from '../data/mixed-doubles.json'

/**
 * 名单数据源接口。
 * 现在只有"内置 JSON"一种实现；以后想从 API 拉取名单，
 * 新增一个实现这个接口的对象，再在 getProvider 里切换即可，界面代码不用改。
 */
export interface PlayerProvider {
  list(mode: Mode): RosterEntry[]
}

const BUILTIN: Record<Mode, RosterEntry[]> = {
  MS: parseSingles('MS', ms as RawRow[]),
  WS: parseSingles('WS', ws as RawRow[]),
  MD: parseDoubles('MD', md as RawRow[]),
  WD: parseDoubles('WD', wd as RawRow[]),
  XD: parseDoubles('XD', xd as RawRow[]),
}

export const builtinProvider: PlayerProvider = {
  list: (mode) => BUILTIN[mode],
}

/** 用户从 JSON 文件导入的名单（保存在浏览器本地），优先于内置名单 */
export interface RosterOverride {
  entries: RosterEntry[]
  fileName: string
  importedAt: number // 毫秒时间戳
}
export type RosterOverrides = Partial<Record<Mode, RosterOverride>>

export const BUILTIN_LABEL = '内置：BWF 2026 年第 45 周前 100 名'

/** 某个模式生效的名单：导入过就用导入的，否则用内置的 */
export function getProvider(overrides?: RosterOverrides): PlayerProvider {
  return {
    list: (mode) => overrides?.[mode]?.entries ?? BUILTIN[mode],
  }
}

export const ALL_MODES: Mode[] = ['MS', 'WS', 'MD', 'WD', 'XD']
