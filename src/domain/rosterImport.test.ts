import { describe, expect, it } from 'vitest'
import { parseRosterJson, rosterToJson } from './rosterImport'
import { builtinProvider } from '../providers/PlayerProvider'
import md from '../data/mens-doubles.json'
import ms from '../data/mens-singles.json'

describe('名单导入：BWF 导出格式（与 src/data 一致）', () => {
  it('男双原始文件可直接导入，结果和内置名单一致', () => {
    const res = parseRosterJson(JSON.stringify(md), 'MD')
    expect(res.ok).toBe(true)
    expect(res.entries).toHaveLength(100)
    const builtin = builtinProvider.list('MD')
    expect(res.entries.map((e) => e.players)).toEqual(builtin.map((e) => e.players))
    expect(res.entries[0].players[1].name).toBe('徐承宰')
    expect(res.entries[0].rank).toBe(1)
  })

  it('男单原始文件可直接导入', () => {
    const res = parseRosterJson(JSON.stringify(ms), 'MS')
    expect(res.ok).toBe(true)
    expect(res.entries[0].players).toHaveLength(1)
    expect(res.entries[0].players[0].nameEn).toBeTruthy()
  })

  it('国家代码统一转大写', () => {
    const res = parseRosterJson(
      JSON.stringify([{ 排名: 1, 所属: 'kor kor', 球员: '甲 Jia / 乙 Yi' }]),
      'MD',
    )
    expect(res.ok).toBe(true)
    expect(res.entries[0].players.map((p) => p.country)).toEqual(['KOR', 'KOR'])
  })

  it('双打文件导入到单打模式会报错并提示模式可能选错', () => {
    const res = parseRosterJson(JSON.stringify(md), 'MS')
    expect(res.ok).toBe(false)
    expect(res.errors[0]).toContain('模式可能选错')
  })

  it('单打文件导入到双打模式也会报错', () => {
    const res = parseRosterJson(JSON.stringify(ms), 'MD')
    expect(res.ok).toBe(false)
    expect(res.errors[0]).toContain('模式可能选错')
  })

  it.each([
    ['缺少排名', [{ 所属: 'KOR', 球员: '甲' }]],
    ['缺少球员', [{ 排名: 1, 所属: 'KOR' }]],
    ['缺少所属', [{ 排名: 1, 球员: '甲' }]],
    ['所属不是国家代码', [{ 排名: 1, 所属: '中国', 球员: '甲' }]],
    ['球员里有空名字', [{ 排名: 1, 所属: 'KOR', 球员: ' ' }]],
  ])('%s -> 报错且不导入任何内容', (_label, rows) => {
    const res = parseRosterJson(JSON.stringify(rows), 'MS')
    expect(res.ok).toBe(false)
    expect(res.entries).toHaveLength(0)
    expect(res.errors.length).toBeGreaterThan(0)
  })

  it('有一条错误整体失败（不会导入一半），并指出行号', () => {
    const res = parseRosterJson(
      JSON.stringify([
        { 排名: 1, 所属: 'CHN', 球员: '甲' },
        { 排名: 2, 所属: 'CHN', 球员: '' },
      ]),
      'MS',
    )
    expect(res.ok).toBe(false)
    expect(res.errors[0]).toContain('第 2 行')
  })

  it('未知国家代码只给警告，仍可导入', () => {
    const res = parseRosterJson(JSON.stringify([{ 排名: 1, 所属: 'ZZZ', 球员: '甲' }]), 'MS')
    expect(res.ok).toBe(true)
    expect(res.warnings[0]).toContain('ZZZ')
  })

  it('非数组 / 空数组 / 非 JSON', () => {
    expect(parseRosterJson('{}', 'MS').errors[0]).toContain('数组')
    expect(parseRosterJson('[]', 'MS').errors[0]).toContain('空')
    expect(parseRosterJson('not json', 'MS').errors[0]).toContain('JSON')
  })
})

describe('名单导出', () => {
  it('导出的格式可以被原样导回', () => {
    for (const mode of ['MS', 'MD', 'XD'] as const) {
      const list = builtinProvider.list(mode)
      const res = parseRosterJson(rosterToJson(mode, list), mode)
      expect(res.ok, mode).toBe(true)
      expect(res.entries.map((e) => [e.rank, e.players])).toEqual(
        list.map((e) => [e.rank, e.players]),
      )
    }
  })
})
