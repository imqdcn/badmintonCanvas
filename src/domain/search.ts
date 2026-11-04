import { pinyin } from 'pinyin-pro'
import type { Mode, RosterEntry } from './types'

// 名单搜索：支持中文、拼音全拼、拼音首字母、英文。

const keyCache = new WeakMap<RosterEntry, string>()

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s·./\-']/g, '')
}

function entryKey(e: RosterEntry): string {
  const cached = keyCache.get(e)
  if (cached) return cached
  const parts: string[] = []
  for (const p of e.players) {
    const chars = pinyin(p.name, { toneType: 'none', type: 'array' })
    const full = chars.join('')
    const initials = chars.map((c) => c[0]).join('')
    parts.push(p.name, p.nameEn, full, initials)
  }
  const key = normalize(parts.join(' '))
  keyCache.set(e, key)
  return key
}

/**
 * 搜索名单。
 * - 当前模式的结果排在前面，同组内按世界排名；自定义条目（无排名）排最后。
 * - query 为空时返回全部（按同样的顺序）。
 */
export function searchEntries(
  entries: RosterEntry[],
  query: string,
  currentMode: Mode,
  limit = 80,
): RosterEntry[] {
  const q = normalize(query)
  const list = q ? entries.filter((e) => entryKey(e).includes(q)) : [...entries]
  list.sort((a, b) => {
    const ma = a.mode === currentMode ? 0 : 1
    const mb = b.mode === currentMode ? 0 : 1
    if (ma !== mb) return ma - mb
    return (a.rank ?? 9999) - (b.rank ?? 9999)
  })
  return list.slice(0, limit)
}
