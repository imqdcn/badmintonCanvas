import { describe, expect, it } from 'vitest'
import {
  advance,
  clearSlot,
  createBracket,
  isAdvanced,
  LATER_ROUND_MSG,
  patchSlot,
  sanitizeBracket,
  setPlayers,
  slotKey,
  usedPlayerKeys,
} from './bracket'
import { computeLayout } from './layout'
import { normalizeEn, parseDoubles, parseSingles, splitPerson, type RawRow } from './roster'
import { searchEntries } from './search'
import { flagClass } from './countries'
import type { PlayerRef } from './types'
import { builtinProvider } from '../providers/PlayerProvider'

const P = (name: string, country = 'CHN'): PlayerRef => ({ name, nameEn: name, country })

describe('createBracket', () => {
  it.each([8, 16, 32, 64] as const)('%i 强的每轮位置数', (size) => {
    const b = createBracket(size)
    const R = Math.log2(size)
    expect(b.slots).toHaveLength(R + 1)
    expect(b.slots[0]).toHaveLength(size)
    expect(b.slots[R]).toHaveLength(1)
    expect(b.info[R - 1]).toHaveLength(2)
  })
})

describe('晋级与连带清除', () => {
  it('晋级会复制选手和种子到下一轮', () => {
    let b = createBracket(8)
    b = setPlayers(b, 0, 0, [P('A')]).bracket
    b = patchSlot(b, 0, 0, { seed: 1 }).bracket
    b = advance(b, 0, 0).bracket
    expect(b.slots[1][0].players[0].name).toBe('A')
    expect(b.slots[1][0].seed).toBe(1)
    expect(isAdvanced(b, 0, 0)).toBe(true)
  })

  it('空位置不能晋级', () => {
    const b = createBracket(8)
    expect(advance(b, 0, 0).bracket).toBe(b)
  })

  it('改掉首轮已晋级的选手，会清除后续轮次里的同一个人', () => {
    let b = createBracket(8)
    b = setPlayers(b, 0, 0, [P('A')]).bracket
    b = advance(b, 0, 0).bracket
    b = advance(b, 1, 0).bracket
    expect(b.slots[2][0].players[0].name).toBe('A')
    const res = setPlayers(b, 0, 0, [P('B')])
    expect(res.cleared).toBe(2)
    expect(res.bracket.slots[1][0].players).toHaveLength(0)
    expect(res.bracket.slots[2][0].players).toHaveLength(0)
  })

  it('后续轮次不能手动选别的选手，只能由上一轮晋级产生', () => {
    let b = createBracket(8)
    b = setPlayers(b, 0, 0, [P('A')]).bracket
    b = setPlayers(b, 0, 1, [P('B')]).bracket
    const res = setPlayers(b, 1, 0, [P('C')]) // C 不在这场比赛里
    expect(res.blocked).toBe(LATER_ROUND_MSG)
    expect(res.bracket).toBe(b)
    expect(b.slots[1][0].players).toHaveLength(0)
  })

  it('同一场比赛里可以随时改晋级者（A 换成 B），后续轮次里的 A 会被清除', () => {
    let b = createBracket(8)
    b = setPlayers(b, 0, 0, [P('A')]).bracket
    b = setPlayers(b, 0, 1, [P('B')]).bracket
    b = advance(b, 0, 0).bracket
    b = advance(b, 1, 0).bracket // A 继续晋级到第 2 轮
    const res = advance(b, 0, 1) // 改成 B 晋级
    expect(res.bracket.slots[1][0].players[0].name).toBe('B')
    expect(res.bracket.slots[2][0].players).toHaveLength(0)
    expect(res.cleared).toBe(1)
  })

  it('撤销晋级：清空后续轮次的位置', () => {
    let b = createBracket(8)
    b = setPlayers(b, 0, 0, [P('A')]).bracket
    b = advance(b, 0, 0).bracket
    b = clearSlot(b, 1, 0).bracket
    expect(isAdvanced(b, 0, 0)).toBe(false)
    expect(b.slots[0][0].players[0].name).toBe('A')
  })

  it('种子在首轮设置，并同步到已晋级的后续位置；后续轮次不能单独改种子', () => {
    let b = createBracket(8)
    b = setPlayers(b, 0, 0, [P('A')]).bracket
    b = advance(b, 0, 0).bracket
    b = patchSlot(b, 0, 0, { seed: 2 }).bracket
    expect(b.slots[1][0].seed).toBe(2)
    b = patchSlot(b, 0, 0, { seed: undefined }).bracket
    expect(b.slots[1][0].seed).toBeUndefined()
    expect(patchSlot(b, 1, 0, { seed: 3 }).blocked).toBeTruthy()
  })

  it('轮空会清掉选手', () => {
    let b = createBracket(8)
    b = setPlayers(b, 0, 0, [P('A')]).bracket
    b = patchSlot(b, 0, 0, { bye: true }).bracket
    expect(b.slots[0][0].players).toHaveLength(0)
    expect(slotKey(b.slots[0][0])).toBe('BYE')
  })

  it('一路晋级到冠军', () => {
    let b = createBracket(8)
    b = setPlayers(b, 0, 0, [P('A')]).bracket
    for (let r = 0; r < 3; r++) b = advance(b, r, 0).bracket
    expect(b.slots[3][0].players[0].name).toBe('A')
  })
})

describe('种子序号', () => {
  it('手动设置的种子在晋级时一起带到下一轮，换人后保留原位置的种子', () => {
    let b = createBracket(8)
    b = setPlayers(b, 0, 0, [P('A')]).bracket
    expect(b.slots[0][0].seed).toBeUndefined()
    b = patchSlot(b, 0, 0, { seed: 3 }).bracket
    b = advance(b, 0, 0).bracket
    expect(b.slots[1][0].seed).toBe(3)
    b = setPlayers(b, 0, 0, [P('B')]).bracket
    expect(b.slots[0][0].seed).toBe(3)
  })
})

describe('首轮选手去重', () => {
  it('统计所有首轮位置里已出现的选手', () => {
    let b = createBracket(8)
    b = setPlayers(b, 0, 0, [P('A'), P('B')]).bracket
    b = setPlayers(b, 0, 1, [P('C')]).bracket
    const used = usedPlayerKeys(b)
    expect(used.has('A@CHN')).toBe(true)
    expect(used.has('B@CHN')).toBe(true)
    expect(used.has('C@CHN')).toBe(true)
    expect(used.size).toBe(3)
  })

  it('exclude 排除正在编辑的位置，可以重新选回同一个人', () => {
    let b = createBracket(8)
    b = setPlayers(b, 0, 0, [P('A')]).bracket
    const used = usedPlayerKeys(b, { round: 0, index: 0 })
    expect(used.has('A@CHN')).toBe(false)
  })

  it('后续轮次（晋级后的位置）不计入去重', () => {
    let b = createBracket(8)
    b = setPlayers(b, 0, 0, [P('A')]).bracket
    b = advance(b, 0, 0).bracket
    const used = usedPlayerKeys(b)
    expect(used.size).toBe(1) // 只统计首轮，不会因为晋级重复计数
  })
})

describe('国旗', () => {
  it('中国台北使用奥运会会旗样式', () => {
    expect(flagClass('TPE')).toBe('fi fi-tpe')
    expect(flagClass('KOR')).toBe('fi fi-kr')
    expect(flagClass('ENG')).toBe('fi fi-gb-eng')
  })
})

describe('校正旧数据', () => {
  it('清除后续轮次里不属于上一轮两位选手的人，保留合法晋级者', () => {
    let b = createBracket(8)
    b = setPlayers(b, 0, 0, [P('A')]).bracket
    b = setPlayers(b, 0, 1, [P('B')]).bracket
    b = advance(b, 0, 0).bracket
    // 模拟旧版本：给第 2 场比赛的晋级位置手动塞了个无关的人
    const dirty = {
      ...b,
      slots: b.slots.map((round, r) =>
        r === 1 ? round.map((s, i) => (i === 1 ? { players: [P('X')] } : s)) : round,
      ),
    }
    const fixed = sanitizeBracket(dirty)
    expect(fixed.slots[1][0].players[0].name).toBe('A')
    expect(fixed.slots[1][1].players).toHaveLength(0)
  })
})

describe('布局', () => {
  it('32 强：5 列，分区线 3 条，列不重叠且在画布内', () => {
    const l = computeLayout(32)
    expect(l.cols).toHaveLength(5)
    expect(l.dividerYs).toHaveLength(3)
    for (let i = 1; i < l.cols.length; i++) {
      expect(l.cols[i].x).toBeGreaterThan(l.cols[i - 1].x + l.cols[i - 1].w)
    }
    const last = l.cols[4]
    expect(last.x + last.w + 8).toBeLessThanOrEqual(725) // 右侧连线向外延伸 8px
  })

  it('8/16/32 强所有轮次统一字号，64 强略小', () => {
    expect(computeLayout(8).fontSize).toBe(12)
    expect(computeLayout(16).fontSize).toBe(12)
    expect(computeLayout(32).fontSize).toBe(12)
    expect(computeLayout(64).fontSize).toBe(10)
  })

  it('下一轮位置位于两个来源位置的正中间', () => {
    const l = computeLayout(16)
    expect(l.centerY(1, 0)).toBeCloseTo((l.centerY(0, 0) + l.centerY(0, 1)) / 2)
  })
})

describe('名单解析', () => {
  it('英文名统一大小写', () => {
    expect(normalizeEn('CHEN Bo Yang')).toBe('Chen Bo Yang')
    expect(normalizeEn('HU KE YUAN')).toBe('Hu Ke Yuan')
    expect(normalizeEn('M.R. ARJUN')).toBe('M.R. Arjun')
  })

  it('拆分中英文名', () => {
    expect(splitPerson('金元浩 Kim Won Ho')).toEqual({ name: '金元浩', nameEn: 'Kim Won Ho' })
  })

  it('双打：拆成两位选手并拆分国家', () => {
    const rows: RawRow[] = [{ 排名: 1, 所属: 'CHN FRA', 球员: '甲 JIA A / 乙 Yi B' }]
    const [e] = parseDoubles('XD', rows)
    expect(e.players).toHaveLength(2)
    expect(e.players[0]).toEqual({ name: '甲', nameEn: 'Jia A', country: 'CHN' })
    expect(e.players[1].country).toBe('FRA')
  })

  it('单打', () => {
    const [e] = parseSingles('MS', [
      { 排名: 3, 所属: 'DEN', 球员: '安东森', 英文名: 'Anders Antonsen' },
    ])
    expect(e.players[0].country).toBe('DEN')
    expect(e.rank).toBe(3)
  })

  it('内置名单：5 个项目各 100 条，双打都是两位选手，国家代码都有国旗', () => {
    for (const m of ['MS', 'WS', 'MD', 'WD', 'XD'] as const) {
      const list = builtinProvider.list(m)
      expect(list).toHaveLength(100)
      const n = m === 'MS' || m === 'WS' ? 1 : 2
      for (const e of list) {
        expect(e.players).toHaveLength(n)
        for (const p of e.players) {
          expect(p.name).toBeTruthy()
          expect(flagClass(p.country), `${p.name} ${p.country}`).not.toBeNull()
        }
      }
    }
  })

  it('混双里存在两位选手国籍不同的组合', () => {
    const diff = builtinProvider
      .list('XD')
      .some((e) => e.players[0].country !== e.players[1].country)
    expect(diff).toBe(true)
  })
})

describe('搜索', () => {
  const all = (['MS', 'WS', 'MD', 'WD', 'XD'] as const).flatMap((m) => builtinProvider.list(m))

  it('中文、英文、拼音、首字母都能搜到', () => {
    for (const q of ['金元浩', 'kim won ho', 'jinyuanhao', 'jyh']) {
      const r = searchEntries(all, q, 'MD')
      expect(
        r.some((e) => e.id === 'MD-1'),
        q,
      ).toBe(true)
    }
  })

  it('当前模式的结果排在前面', () => {
    const r = searchEntries(all, '', 'WS')
    expect(r[0].mode).toBe('WS')
    expect(r[0].rank).toBe(1)
  })

  it('无匹配返回空', () => {
    expect(searchEntries(all, 'zzzzqqq', 'MS')).toHaveLength(0)
  })
})
