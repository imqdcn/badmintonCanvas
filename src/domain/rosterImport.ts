import { flagClass } from './countries'
import { parseDoubles, parseSingles, type RawRow } from './roster'
import { modeInfo, type Mode, type RosterEntry } from './types'

// 名单 JSON 的导入 / 导出。
//
// 格式和 src/data/ 里的内置名单完全一致（BWF 排名页导出的数组）：
//
//   单打（男单 / 女单）：
//     [ { "排名": 1, "所属": "DEN", "球员": "安东森", "英文名": "Anders Antonsen" }, ... ]
//
//   双打（男双 / 女双 / 混双）：
//     [ { "排名": 1, "所属": "KOR KOR", "球员": "金元浩 Kim Won Ho / 徐承宰 Seo Seung Jae" }, ... ]
//
// 文件里没有写明项目，导入到「当前选中的模式」。
// 其他字段（升降、站数、积分……）会被忽略，可以保留也可以不要。

const MAX_ENTRIES = 2000
const MAX_ERRORS = 8

export interface ImportResult {
  ok: boolean
  mode: Mode // 导入到哪个模式
  entries: RosterEntry[]
  errors: string[]
  warnings: string[]
}

function fail(mode: Mode, errors: string[]): ImportResult {
  return { ok: false, mode, entries: [], errors, warnings: [] }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

/** 国家代码：2 到 4 个字母，如 KOR、ENG */
const COUNTRY_RE = /^[A-Za-z]{2,4}$/

/** 解析名单 JSON 文本。任何一条有问题就整体失败，不会导入一半。 */
export function parseRosterJson(text: string, mode: Mode): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail(mode, ['不是有效的 JSON 文件'])
  }
  if (!Array.isArray(data)) {
    return fail(mode, ['格式不对：应为数组，例如 [ { "排名": 1, "所属": "KOR", "球员": "…" }, … ]'])
  }
  if (data.length === 0) return fail(mode, ['数组是空的'])
  if (data.length > MAX_ENTRIES) return fail(mode, [`条目太多（最多 ${MAX_ENTRIES} 条）`])

  const double = modeInfo(mode).double
  const errors: string[] = []
  const push = (msg: string) => {
    if (errors.length < MAX_ERRORS) errors.push(msg)
  }

  data.forEach((r, idx) => {
    const where = `第 ${idx + 1} 行`
    if (!isObj(r)) return push(`${where}：必须是对象`)
    if (typeof r['排名'] !== 'number') return push(`${where}：缺少数字类型的 "排名"`)
    if (!isStr(r['球员']) || !r['球员'].trim()) return push(`${where}：缺少 "球员"`)
    if (!isStr(r['所属']) || !r['所属'].trim()) return push(`${where}：缺少 "所属"（国家代码）`)

    const players = r['球员'].split(' / ')
    const countries = r['所属'].trim().split(/\s+/)
    if (double && players.length !== 2) {
      return push(
        `${where}：${modeInfo(mode).label}的 "球员" 应为 "甲 Jia / 乙 Yi" 两位选手，当前模式可能选错了`,
      )
    }
    if (!double && players.length !== 1) {
      return push(`${where}：${modeInfo(mode).label}的 "球员" 只能有 1 位选手，当前模式可能选错了`)
    }
    if (players.some((p) => !p.trim())) return push(`${where}："球员" 里有空的选手名`)
    if (countries.length > players.length || countries.some((c) => !COUNTRY_RE.test(c))) {
      return push(
        `${where}："所属" 应为 ${players.length} 个国家代码${players.length > 1 ? '（空格隔开）' : ''}，如 ${players.length > 1 ? 'KOR KOR' : 'KOR'}`,
      )
    }
    if (r['英文名'] !== undefined && !isStr(r['英文名']))
      return push(`${where}："英文名" 必须是文字`)
  })
  if (errors.length) return fail(mode, errors)

  const rows = data as RawRow[]
  const entries = (double ? parseDoubles(mode, rows) : parseSingles(mode, rows)).map((e, i) => ({
    ...e,
    id: `import-${mode}-${i + 1}`,
    players: e.players.map((p) => ({ ...p, country: p.country.toUpperCase() })),
  }))

  const unknown = new Set<string>()
  for (const e of entries)
    for (const p of e.players) if (!flagClass(p.country)) unknown.add(p.country)
  const warnings = unknown.size
    ? [`以下国家代码没有对应国旗：${[...unknown].join('、')}（会只显示代码）`]
    : []

  return { ok: true, mode, entries, errors: [], warnings }
}

/** 生成和内置名单同样格式的 JSON 文本（“导出当前名单”，也可当作导入模板） */
export function rosterToJson(mode: Mode, entries: RosterEntry[]): string {
  const double = modeInfo(mode).double
  const rows = entries.map((e, i) => {
    const row: Record<string, unknown> = {
      排名: e.rank ?? i + 1,
      所属: e.players.map((p) => p.country).join(' '),
      球员: e.players.map((p) => (double ? `${p.name} ${p.nameEn}`.trim() : p.name)).join(' / '),
    }
    if (!double) row['英文名'] = e.players[0].nameEn
    return row
  })
  // 每行一条，和内置名单文件的排版一致，方便手工编辑
  return `[\n${rows.map((r) => `  ${JSON.stringify(r)}`).join(',\n')}\n]\n`
}
