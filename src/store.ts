import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  advance,
  bracketHasData,
  clearSlot,
  createBracket,
  patchSlot,
  sanitizeBracket,
  setInfo,
  setPlayers,
  type ChangeResult,
} from './domain/bracket'
import {
  MODES,
  modeInfo,
  type BracketData,
  type BracketSize,
  type MatchInfo,
  type Mode,
  type PlayerRef,
  type RosterEntry,
  type Slot,
} from './domain/types'

export interface Social {
  id: string
  label: string
  icon: string | null // 图片 dataURL，空则显示文字首字
}

export interface HeaderState {
  title: string
  highlight: string // 标题里要高亮成黄色的关键词
  dateLine: string
  badge: string // 右下角胶囊标签
  posterUrl: string | null
  posterScale: number
  posterX: number // 百分比偏移
  posterY: number
  logoUrl: string | null
  socials: Social[]
  watermark: string
  watermarkOn: boolean
  shortNames?: boolean // 对阵图里用简称显示带"·"的译名，默认开启
}

/** 正在编辑哪个位置 + 弹窗锚点 */
export interface EditTarget {
  round: number
  index: number
  anchor: { left: number; top: number; right: number; bottom: number }
}

interface State {
  mode: Mode
  brackets: Record<Mode, BracketData>
  sectionLabels: string[]
  header: HeaderState
  customEntries: RosterEntry[]

  // 以下是界面临时状态，不会保存
  editing: EditTarget | null
  notice: string | null

  setMode: (mode: Mode) => void
  setSize: (size: BracketSize) => boolean
  resetBracket: () => void
  setPlayers: (round: number, index: number, players: PlayerRef[]) => void
  patchSlot: (round: number, index: number, patch: Partial<Slot>) => void
  clearSlot: (round: number, index: number) => void
  advance: (round: number, index: number) => void
  setInfo: (round: number, index: number, patch: Partial<MatchInfo>) => void
  setSectionLabel: (i: number, text: string) => void
  patchHeader: (patch: Partial<HeaderState>) => void
  addSocial: () => void
  updateSocial: (id: string, patch: Partial<Social>) => void
  removeSocial: (id: string) => void
  addCustom: (entry: RosterEntry) => void
  removeCustom: (id: string) => void
  openEditor: (target: EditTarget) => void
  closeEditor: () => void
  notify: (text: string | null) => void
}

const DEFAULT_MODE: Mode = 'MD'

function makeBrackets(): Record<Mode, BracketData> {
  return {
    MS: createBracket(32),
    WS: createBracket(32),
    MD: createBracket(32),
    WD: createBracket(32),
    XD: createBracket(32),
  }
}

export const DEFAULT_HEADER: HeaderState = {
  title: '2026韩国公开赛男双赛果',
  highlight: '男双',
  dateLine: '11月3日-11月8日 丽水 Super500',
  badge: '佑铭羽球',
  posterUrl: null,
  posterScale: 1,
  posterX: 0,
  posterY: 0,
  logoUrl: null,
  socials: [
    { id: 's1', label: '微信', icon: null },
    { id: 's2', label: '头条', icon: null },
    { id: 's3', label: '百度', icon: null },
    { id: 's4', label: '微博', icon: null },
  ],
  watermark: '公众号 · 佑铭羽球',
  watermarkOn: true,
  shortNames: true,
}

// localStorage 可能写满（图片 dataURL 很大），写失败时不要让应用崩溃
const safeStorage = {
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* 忽略 */
    }
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* 忽略 */
    }
  },
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      /** 把对阵图的修改结果写回 store，并在有连带清除时给出提示 */
      const apply = (fn: (b: BracketData) => ChangeResult) => {
        const { mode, brackets } = get()
        const res = fn(brackets[mode])
        if (res.blocked) {
          set({ notice: res.blocked })
          return
        }
        set({
          brackets: { ...brackets, [mode]: res.bracket },
          notice:
            res.cleared > 0 ? `已同步清除后续轮次中 ${res.cleared} 个已晋级的位置` : get().notice,
        })
      }

      return {
        mode: DEFAULT_MODE,
        brackets: makeBrackets(),
        sectionLabels: ['1/4区', '2/4区', '3/4区', '4/4区'],
        header: DEFAULT_HEADER,
        customEntries: [],
        editing: null,
        notice: null,

        setMode: (mode) => {
          const { mode: old, header } = get()
          if (mode === old) return
          // 标题里带着旧模式关键词时，自动换成新模式的简称
          const from = modeInfo(old).short
          const to = modeInfo(mode).short
          const next = { ...header }
          if (header.highlight === from && header.title.includes(from)) {
            next.title = header.title.replace(from, to)
            next.highlight = to
          }
          set({ mode, header: next, editing: null })
        },

        setSize: (size) => {
          const { mode, brackets } = get()
          if (brackets[mode].size === size) return false
          set({ brackets: { ...brackets, [mode]: createBracket(size) }, editing: null })
          return true
        },

        resetBracket: () => {
          const { mode, brackets } = get()
          set({
            brackets: { ...brackets, [mode]: createBracket(brackets[mode].size) },
            editing: null,
          })
        },

        setPlayers: (r, i, players) => apply((b) => setPlayers(b, r, i, players)),
        patchSlot: (r, i, patch) => apply((b) => patchSlot(b, r, i, patch)),
        clearSlot: (r, i) => apply((b) => clearSlot(b, r, i)),
        advance: (r, i) => apply((b) => advance(b, r, i)),
        setInfo: (r, i, patch) => apply((b) => ({ bracket: setInfo(b, r, i, patch), cleared: 0 })),

        setSectionLabel: (i, text) =>
          set((s) => ({ sectionLabels: s.sectionLabels.map((t, k) => (k === i ? text : t)) })),

        patchHeader: (patch) => set((s) => ({ header: { ...s.header, ...patch } })),
        addSocial: () =>
          set((s) => ({
            header: {
              ...s.header,
              socials: [...s.header.socials, { id: `s${Date.now()}`, label: '新图标', icon: null }],
            },
          })),
        updateSocial: (id, patch) =>
          set((s) => ({
            header: {
              ...s.header,
              socials: s.header.socials.map((x) => (x.id === id ? { ...x, ...patch } : x)),
            },
          })),
        removeSocial: (id) =>
          set((s) => ({
            header: { ...s.header, socials: s.header.socials.filter((x) => x.id !== id) },
          })),

        addCustom: (entry) => set((s) => ({ customEntries: [...s.customEntries, entry] })),
        removeCustom: (id) =>
          set((s) => ({ customEntries: s.customEntries.filter((e) => e.id !== id) })),

        openEditor: (target) => set({ editing: target }),
        closeEditor: () => set({ editing: null }),
        notify: (text) => set({ notice: text }),
      }
    },
    {
      name: 'badminton-canvas-v1',
      // 读取本地数据时校正对阵图：后续轮次里不属于上一轮两位选手的人会被清除
      merge: (persisted, current) => {
        const p = persisted as Partial<State> | undefined
        if (!p) return current
        const brackets = { ...current.brackets, ...(p.brackets ?? {}) }
        for (const m of Object.keys(brackets) as Mode[]) brackets[m] = sanitizeBracket(brackets[m])
        return { ...current, ...p, brackets }
      },
      storage: createJSONStorage(() => safeStorage),
      // 只保存数据，不保存弹窗/提示等临时状态
      partialize: (s) => ({
        mode: s.mode,
        brackets: s.brackets,
        sectionLabels: s.sectionLabels,
        header: s.header,
        customEntries: s.customEntries,
      }),
    },
  ),
)

export { bracketHasData, MODES }
