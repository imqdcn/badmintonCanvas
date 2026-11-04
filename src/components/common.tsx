import { flagClass } from '../domain/countries'
import type { PlayerRef } from '../domain/types'

export function Flag({ code }: { code: string }) {
  const cls = flagClass(code)
  if (!cls) return <span className="flag-unknown">{code}</span>
  return <span className={cls} title={code} />
}

/** 一个位置的国旗：两位选手同一国家只显示一面 */
export function Flags({ players }: { players: PlayerRef[] }) {
  const codes = players.map((p) => p.country).filter((c, i, arr) => arr.indexOf(c) === i)
  return (
    <span className="flags">
      {codes.map((c) => (
        <Flag key={c} code={c} />
      ))}
    </span>
  )
}

/** 种子序号：1 -> ①，超过 20 用普通数字 */
export function seedGlyph(n: number): string {
  return n >= 1 && n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : String(n)
}

/** 简称：外国选手的中文译名很长（如"法贾尔·阿尔菲安"），简称取最后一段（"阿尔菲安"） */
export function shortName(name: string): string {
  const parts = name.split('·')
  return parts[parts.length - 1] || name
}

export function playersText(players: PlayerRef[], short = false): string {
  return players.map((p) => (short ? shortName(p.name) : p.name)).join('/')
}
