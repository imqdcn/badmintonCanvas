import { flagClass } from './countries'
import { normalizeEn, parseDoubles, parseSingles, type RawRow } from './roster'
import { modeInfo, MODES, type Mode, type PlayerRef, type RosterEntry } from './types'

// 名单 JSON 的导入 / 导出。
//
// 支持两种格式（自动识别）：
//
// 1) 标准格式（推荐，也是“导出当前名单”生成的格式）
//    {
//      "format": "badminton-canvas-roster",
//      "version": 1,
//      "mode": "MD",                         // MS | WS | MD | WD | XD，可省略（省略时导入到当前模式）
//      "entries": [
//        { "rank": 1, "players": [
//            { "name": "金元浩", "nameEn": "Kim Won Ho", "country": "KOR" },
//            { "name": "徐承宰", "nameEn": "Seo Seung Jae", "country": "KOR" } ] }
//      ]
//    }
//    单打每条 1 位选手，双打每条 2 位选手。rank、nameEn 可省略。
//
// 2) BWF 导出格式（和 data/ 目录里的文件一样，直接可用）
//    [ { "排名": 1, "所属": "KOR KOR", "球员": "金元浩 Kim Won Ho / 徐承宰 Seo Seung Jae" }, ... ]
//    单打还有 "英文名" 字段。导入到当前选中的模式。

export const ROSTER_FORMAT = 'badminton-canvas-roster'
export const ROSTER_VERSION = 1
const MAX_ENTRIES = 2000
const MAX_ERRORS = 8

export interface ImportResult {
  ok: boolean
  mode: Mode // 实际导入到哪个模式
  entries: RosterEntry[]
  errors: string[]
  warnings: string[]
  format: 'standard' | 'bwf' | null
}

function fail(mode: Mode, errors: string[]): ImportResult {
  return { ok: false, mode, entries: [], errors, warnings: [], format: null }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

/** 收集未知国家代码的警告（仍然允许导入，旗子位置会显示代码文字） */
function unknownCountryWarning(entries: RosterEntry[]): string[] {
  const unknown = new Set<string>()
  for (const e of entries)
    for (const p of e.players) if (!flagClass(p.country)) unknown.add(p.country)
  return unknown.size
    ? [`以下国家代码没有对应国旗：${[...unknown].join('、')}（会只显示代码）`]
    : []
}

function parseStandard(root: Record<string, unknown>, targetMode: Mode): ImportResult {
  const errors: string[] = []
  const push = (msg: string) => {
    if (errors.length < MAX_ERRORS) errors.push(msg)
  }

  let mode = targetMode
  if (root.mode !== undefined) {
    const found = MODES.find((m) => m.id === root.mode)
    if (!found)
      return fail(targetMode, [`"mode" 必须是 ${MODES.map((m) => m.id).join(' / ')} 之一`])
    mode = found.id
  }
  const need = modeInfo(mode).double ? 2 : 1

  const raw = root.entries
  if (!Array.isArray(raw)) return fail(mode, ['缺少 "entries" 数组'])
  if (raw.length === 0) return fail(mode, ['"entries" 是空的'])
  if (raw.length > MAX_ENTRIES) return fail(mode, [`条目太多（最多 ${MAX_ENTRIES} 条）`])

  const entries: RosterEntry[] = []
  raw.forEach((item, idx) => {
    const where = `第 ${idx + 1} 条`
    if (!isObj(item)) return push(`${where}：必须是对象`)
    if (!Array.isArray(item.players)) return push(`${where}：缺少 "players" 数组`)
    if (item.players.length !== need) {
      return push(
        `${where}：${modeInfo(mode).label}每条需要 ${need} 位选手，实际 ${item.players.length} 位`,
      )
    }
    const players: PlayerRef[] = []
    for (let k = 0; k < item.players.length; k++) {
      const p = item.players[k]
      const pw = `${where}第 ${k + 1} 位选手`
      if (!isObj(p)) return push(`${pw}：必须是对象`)
      if (!isStr(p.name) || !p.name.trim()) return push(`${pw}：缺少 "name"（中文名）`)
      if (!isStr(p.country) || !/^[A-Za-z]{2,4}$/.test(p.country.trim())) {
        return push(`${pw}：缺少或错误的 "country"（应为 BWF 国家代码，如 KOR）`)
      }
      if (p.nameEn !== undefined && !isStr(p.nameEn)) return push(`${pw}："nameEn" 必须是文字`)
      players.push({
        name: p.name.trim(),
        nameEn: normalizeEn(isStr(p.nameEn) ? p.nameEn : ''),
        country: p.country.trim().toUpperCase(),
      })
    }
    if (item.rank != null && (typeof item.rank !== 'number' || !Number.isFinite(item.rank))) {
      return push(`${where}："rank" 必须是数字`)
    }
    entries.push({
      id: `import-${mode}-${idx + 1}`,
      mode,
      rank: typeof item.rank === 'number' ? item.rank : idx + 1,
      players,
    })
  })

  if (errors.length) return fail(mode, errors)
  return {
    ok: true,
    mode,
    entries,
    errors: [],
    warnings: unknownCountryWarning(entries),
    format: 'standard',
  }
}

function parseBwf(rows: unknown[], mode: Mode): ImportResult {
  const errors: string[] = []
  const push = (msg: string) => {
    if (errors.length < MAX_ERRORS) errors.push(msg)
  }
  const double = modeInfo(mode).double

  if (rows.length === 0) return fail(mode, ['数组是空的'])
  if (rows.length > MAX_ENTRIES) return fail(mode, [`条目太多（最多 ${MAX_ENTRIES} 条）`])

  rows.forEach((r, idx) => {
    const where = `第 ${idx + 1} 行`
    if (!isObj(r)) return push(`${where}：必须是对象`)
    if (typeof r['排名'] !== 'number') return push(`${where}：缺少数字类型的 "排名"`)
    if (!isStr(r['所属']) || !r['所属'].trim()) return push(`${where}：缺少 "所属"（国家代码）`)
    if (!isStr(r['球员']) || !r['球员'].trim()) return push(`${where}：缺少 "球员"`)
    const parts = r['球员'].split(' / ')
    if (double && parts.length !== 2) {
      return push(
        `${where}：${modeInfo(mode).label}的 "球员" 应为 "甲 Jia / 乙 Yi" 两位选手，导入的模式可能选错了`,
      )
    }
    if (!double && parts.length !== 1) {
      return push(
        `${where}：${modeInfo(mode).label}的 "球员" 只能有 1 位选手，导入的模式可能选错了`,
      )
    }
  })
  if (errors.length) return fail(mode, errors)

  const typed = rows as RawRow[]
  const entries = (double ? parseDoubles(mode, typed) : parseSingles(mode, typed)).map((e, i) => ({
    ...e,
    id: `import-${mode}-${i + 1}`,
    players: e.players.map((p) => ({ ...p, country: p.country.toUpperCase() })),
  }))
  return {
    ok: true,
    mode,
    entries,
    errors: [],
    warnings: unknownCountryWarning(entries),
    format: 'bwf',
  }
}

/** 解析名单 JSON 文本。任何一条有问题就整体失败，不会导入一半。 */
export function parseRosterJson(text: string, targetMode: Mode): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail(targetMode, ['不是有效的 JSON 文件'])
  }
  if (Array.isArray(data)) return parseBwf(data, targetMode)
  if (isObj(data) && 'entries' in data) return parseStandard(data, targetMode)
  return fail(targetMode, ['无法识别的格式：应为标准格式（含 "entries"）或 BWF 导出的数组'])
}

/** 生成标准格式的 JSON 文本（用于“导出当前名单”，也可当作导入模板） */
export function rosterToJson(mode: Mode, entries: RosterEntry[]): string {
  return JSON.stringify(
    {
      format: ROSTER_FORMAT,
      version: ROSTER_VERSION,
      mode,
      entries: entries.map((e) => ({
        rank: e.rank,
        players: e.players.map((p) => ({ name: p.name, nameEn: p.nameEn, country: p.country })),
      })),
    },
    null,
    2,
  )
}
