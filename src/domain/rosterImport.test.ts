import { describe, expect, it } from 'vitest'
import { parseRosterJson, rosterToJson } from './rosterImport'
import { builtinProvider } from '../providers/PlayerProvider'
import md from '../data/mens-doubles.json'
import ms from '../data/mens-singles.json'

const standardMD = {
  format: 'badminton-canvas-roster',
  version: 1,
  mode: 'MD',
  entries: [
    {
      rank: 1,
      players: [
        { name: '金元浩', nameEn: 'KIM WON HO', country: 'kor' },
        { name: '徐承宰', nameEn: 'Seo Seung Jae', country: 'KOR' },
      ],
    },
    {
      players: [
        { name: '甲', country: 'CHN' },
        { name: '乙', country: 'TPE' },
      ],
    },
  ],
}

describe('名单导入：标准格式', () => {
  it('解析成功：国家代码转大写、英文名统一大小写、缺省 rank 用序号', () => {
    const res = parseRosterJson(JSON.stringify(standardMD), 'MS')
    expect(res.ok).toBe(true)
    expect(res.format).toBe('standard')
    expect(res.mode).toBe('MD') // 文件里指定的模式优先
    expect(res.entries).toHaveLength(2)
    expect(res.entries[0].players[0]).toEqual({
      name: '金元浩',
      nameEn: 'Kim Won Ho',
      country: 'KOR',
    })
    expect(res.entries[1].rank).toBe(2)
    expect(res.entries[1].players[0].nameEn).toBe('')
  })

  it('没有 mode 时导入到当前模式', () => {
    const { mode: _m, ...noMode } = standardMD
    const res = parseRosterJson(JSON.stringify(noMode), 'XD')
    expect(res.ok).toBe(true)
    expect(res.mode).toBe('XD')
    expect(res.entries[0].mode).toBe('XD')
  })

  it('选手数量和模式不符时报错，并指出第几条', () => {
    const bad = { ...standardMD, mode: 'MS' }
    const res = parseRosterJson(JSON.stringify(bad), 'MD')
    expect(res.ok).toBe(false)
    expect(res.errors[0]).toContain('第 1 条')
    expect(res.errors[0]).toContain('1 位选手')
  })

  it.each([
    ['缺少 name', { players: [{ country: 'KOR' }] }, 'MS'],
    ['缺少 country', { players: [{ name: '甲' }] }, 'MS'],
    ['country 不是字母代码', { players: [{ name: '甲', country: '中国' }] }, 'MS'],
    ['rank 不是数字', { rank: 'a', players: [{ name: '甲', country: 'CHN' }] }, 'MS'],
    ['players 不是数组', { players: 'x' }, 'MS'],
  ])('%s -> 报错且不导入任何内容', (_label, entry, mode) => {
    const res = parseRosterJson(JSON.stringify({ mode, entries: [entry] }), 'MS')
    expect(res.ok).toBe(false)
    expect(res.entries).toHaveLength(0)
    expect(res.errors.length).toBeGreaterThan(0)
  })

  it('有一条错误整体失败（不会导入一半）', () => {
    const res = parseRosterJson(
      JSON.stringify({
        mode: 'MS',
        entries: [{ players: [{ name: '甲', country: 'CHN' }] }, { players: [] }],
      }),
      'MS',
    )
    expect(res.ok).toBe(false)
    expect(res.errors[0]).toContain('第 2 条')
  })

  it('未知国家代码只给警告，仍可导入', () => {
    const res = parseRosterJson(
      JSON.stringify({ mode: 'MS', entries: [{ players: [{ name: '甲', country: 'ZZZ' }] }] }),
      'MS',
    )
    expect(res.ok).toBe(true)
    expect(res.warnings[0]).toContain('ZZZ')
  })

  it('非法 mode / 空 entries / 非 JSON / 无法识别', () => {
    expect(parseRosterJson('{"mode":"XX","entries":[]}', 'MS').errors[0]).toContain('mode')
    expect(parseRosterJson('{"entries":[]}', 'MS').ok).toBe(false)
    expect(parseRosterJson('not json', 'MS').errors[0]).toContain('JSON')
    expect(parseRosterJson('{"a":1}', 'MS').errors[0]).toContain('无法识别')
  })
})

describe('名单导入：BWF 导出格式', () => {
  it('男双原始文件可直接导入，结果和内置名单一致', () => {
    const res = parseRosterJson(JSON.stringify(md), 'MD')
    expect(res.ok).toBe(true)
    expect(res.format).toBe('bwf')
    expect(res.entries).toHaveLength(100)
    const builtin = builtinProvider.list('MD')
    expect(res.entries.map((e) => e.players)).toEqual(builtin.map((e) => e.players))
    expect(res.entries[0].players[1].name).toBe('徐承宰')
  })

  it('男单原始文件可直接导入', () => {
    const res = parseRosterJson(JSON.stringify(ms), 'MS')
    expect(res.ok).toBe(true)
    expect(res.entries[0].players).toHaveLength(1)
  })

  it('双打文件导入到单打模式会报错并提示模式可能选错', () => {
    const res = parseRosterJson(JSON.stringify(md), 'MS')
    expect(res.ok).toBe(false)
    expect(res.errors[0]).toContain('模式可能选错')
  })

  it('缺少字段时指出行号', () => {
    const res = parseRosterJson(JSON.stringify([{ 排名: 1, 所属: 'KOR' }]), 'MS')
    expect(res.ok).toBe(false)
    expect(res.errors[0]).toContain('第 1 行')
  })
})

describe('名单导出', () => {
  it('导出的标准格式可以被原样导回', () => {
    for (const mode of ['MS', 'MD', 'XD'] as const) {
      const list = builtinProvider.list(mode)
      const res = parseRosterJson(rosterToJson(mode, list), 'WS')
      expect(res.ok, mode).toBe(true)
      expect(res.mode).toBe(mode)
      expect(res.entries.map((e) => [e.rank, e.players])).toEqual(
        list.map((e) => [e.rank, e.players]),
      )
    }
  })
})
