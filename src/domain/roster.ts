import type { Mode, PlayerRef, RosterEntry } from './types'

// 源 JSON 的一行（字段名是中文）
export interface RawRow {
  排名: number
  所属: string
  球员: string
  英文名?: string
}

/** 统一英文名大小写："CHEN Bo Yang" / "HU KE YUAN" -> "Chen Bo Yang" / "Hu Ke Yuan" */
export function normalizeEn(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[\s\-'.])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

/** 拆 "金元浩 Kim Won Ho" -> { name: "金元浩", nameEn: "Kim Won Ho" } */
export function splitPerson(text: string): { name: string; nameEn: string } {
  const t = text.trim().replace(/\s+/g, ' ')
  const m = t.match(/^(\S+)\s+(.+)$/)
  if (!m) return { name: t, nameEn: '' }
  return { name: m[1], nameEn: normalizeEn(m[2]) }
}

/** 解析单打：一行一位选手 */
export function parseSingles(mode: Mode, rows: RawRow[]): RosterEntry[] {
  return rows.map((r) => ({
    id: `${mode}-${r.排名}`,
    mode,
    rank: r.排名,
    players: [
      {
        name: r.球员.trim(),
        nameEn: normalizeEn(r.英文名 ?? ''),
        country: r.所属.trim().split(/\s+/)[0],
      },
    ],
  }))
}

/** 解析双打：一行一对组合，"球员" 形如 "A中文 A English / B中文 B English"，"所属" 形如 "KOR KOR" */
export function parseDoubles(mode: Mode, rows: RawRow[]): RosterEntry[] {
  return rows.map((r) => {
    const countries = r.所属.trim().split(/\s+/)
    const players: PlayerRef[] = r.球员.split(' / ').map((p, i) => ({
      ...splitPerson(p),
      country: countries[i] ?? countries[0],
    }))
    return { id: `${mode}-${r.排名}`, mode, rank: r.排名, players }
  })
}
