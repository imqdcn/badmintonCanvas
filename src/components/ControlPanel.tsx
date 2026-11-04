import { useState, type RefObject } from 'react'
import { bracketHasData } from '../domain/bracket'
import { BRACKET_SIZES, MODES, modeInfo, type BracketSize } from '../domain/types'
import { exportPng, readImage } from '../export'
import { useStore } from '../store'
import { Collapse } from './Collapse'
import { RosterPanel } from './RosterPanel'

/** 开关（仿 Vant Switch）：左侧文字，右侧滑块 */
export function SwitchCell({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="cell-switch">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        className="vswitch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

/** 分段选择（仿 Vant Tabs 的 card 风格 / Segmented） */
function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  role,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  role?: 'tablist'
}) {
  return (
    <div
      className="seg"
      role={role}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role={role ? 'tab' : undefined}
          aria-selected={role ? o.value === value : undefined}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="upload">
        <span className={`upload-thumb ${value ? 'has' : ''}`}>
          {value ? <img src={value} alt="" /> : '＋'}
        </span>
        <label className="vbtn plain small">
          {value ? '更换图片' : '上传图片'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) onChange(await readImage(f))
              e.target.value = ''
            }}
          />
        </label>
        {value && (
          <button type="button" className="vbtn danger-plain small" onClick={() => onChange(null)}>
            移除
          </button>
        )}
      </div>
    </div>
  )
}

export function ControlPanel({ canvasRef }: { canvasRef: RefObject<HTMLDivElement | null> }) {
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const bracket = useStore((s) => s.brackets[s.mode])
  const setSize = useStore((s) => s.setSize)
  const resetBracket = useStore((s) => s.resetBracket)
  const header = useStore((s) => s.header)
  const patchHeader = useStore((s) => s.patchHeader)
  const addSocial = useStore((s) => s.addSocial)
  const updateSocial = useStore((s) => s.updateSocial)
  const removeSocial = useStore((s) => s.removeSocial)
  const notice = useStore((s) => s.notice)
  const notify = useStore((s) => s.notify)

  const [ratio, setRatio] = useState(2)
  const [busy, setBusy] = useState(false)

  const changeSize = (size: BracketSize) => {
    if (size === bracket.size) return
    if (bracketHasData(bracket) && !window.confirm('切换规模会清空当前模式的对阵数据，确定吗？'))
      return
    setSize(size)
  }

  const doExport = async () => {
    if (!canvasRef.current) return
    setBusy(true)
    try {
      await exportPng(canvasRef.current, ratio, `对阵图-${modeInfo(mode).short}.png`)
    } catch (err) {
      notify(`导出失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="panel">
      <div className="banner">
        <div className="banner-logo">🏸</div>
        <div>
          <h1>羽毛球对阵图编辑器</h1>
          <p>制作赛果海报 · 一键导出 PNG</p>
        </div>
      </div>

      <div className="panel-scroll">
        {notice && (
          <div className="notice" role="status">
            <span className="notice-icon" aria-hidden="true">
              📢
            </span>
            <span className="notice-text">{notice}</span>
            <button type="button" onClick={() => notify(null)} aria-label="关闭提示">
              ×
            </button>
          </div>
        )}

        <Collapse icon="🏆" title="对阵设置" defaultOpen>
          <div className="field">
            <label>项目</label>
            <Segmented
              role="tablist"
              value={mode}
              onChange={setMode}
              options={MODES.map((m) => ({ value: m.id, label: m.short }))}
            />
          </div>
          <div className="field">
            <label>规模</label>
            <Segmented
              value={bracket.size}
              onChange={changeSize}
              options={BRACKET_SIZES.map((n) => ({ value: n, label: `${n}强` }))}
            />
          </div>
          <SwitchCell
            label="长译名用简称显示"
            checked={header.shortNames !== false}
            onChange={(v) => patchHeader({ shortNames: v })}
          />
          <p className="hint">
            例：法贾尔·阿尔菲安 → 阿尔菲安。点击对阵图里的位置选择选手；悬停时出现的 ▶
            可把选手晋级到下一轮。
          </p>
          <button
            type="button"
            className="vbtn danger-plain block"
            onClick={() => {
              if (window.confirm(`清空${modeInfo(mode).label}的全部对阵数据？`)) resetBracket()
            }}
          >
            清空当前对阵
          </button>
        </Collapse>

        <Collapse icon="🖼️" title="头部海报">
          <ImageField
            label="海报背景"
            value={header.posterUrl}
            onChange={(v) => patchHeader({ posterUrl: v })}
          />
          {header.posterUrl && (
            <>
              <div className="field">
                <label>缩放 {header.posterScale.toFixed(2)}</label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={header.posterScale}
                  onChange={(e) => patchHeader({ posterScale: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>水平位置 {header.posterX}%</label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={header.posterX}
                  onChange={(e) => patchHeader({ posterX: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>垂直位置 {header.posterY}%</label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={header.posterY}
                  onChange={(e) => patchHeader({ posterY: Number(e.target.value) })}
                />
              </div>
            </>
          )}
          <ImageField
            label="Logo"
            value={header.logoUrl}
            onChange={(v) => patchHeader({ logoUrl: v })}
          />
          <div className="field">
            <label>赛事名称</label>
            <input value={header.title} onChange={(e) => patchHeader({ title: e.target.value })} />
          </div>
          <div className="field">
            <label>高亮关键词（黄色）</label>
            <input
              value={header.highlight}
              onChange={(e) => patchHeader({ highlight: e.target.value })}
            />
          </div>
          <div className="field">
            <label>日期 / 地点 / 级别</label>
            <input
              value={header.dateLine}
              onChange={(e) => patchHeader({ dateLine: e.target.value })}
            />
          </div>
          <div className="field">
            <label>标签文字</label>
            <input value={header.badge} onChange={(e) => patchHeader({ badge: e.target.value })} />
          </div>
          <div className="field">
            <label>社交图标</label>
            {header.socials.map((s) => (
              <div key={s.id} className="social-row">
                <input
                  value={s.label}
                  onChange={(e) => updateSocial(s.id, { label: e.target.value })}
                />
                <label className="vbtn plain small">
                  图标
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (f) updateSocial(s.id, { icon: await readImage(f) })
                      e.target.value = ''
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="vbtn danger-plain small icon"
                  onClick={() => removeSocial(s.id)}
                  aria-label={`删除 ${s.label}`}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="vbtn plain block" onClick={addSocial}>
              ＋ 添加图标
            </button>
          </div>
        </Collapse>

        <RosterPanel />

        <Collapse icon="💧" title="水印">
          <SwitchCell
            label="显示水印"
            checked={header.watermarkOn}
            onChange={(v) => patchHeader({ watermarkOn: v })}
          />
          <div className="field">
            <label>水印文字</label>
            <input
              value={header.watermark}
              onChange={(e) => patchHeader({ watermark: e.target.value })}
            />
          </div>
        </Collapse>
      </div>

      <div className="panel-foot">
        <div className="foot-row">
          <span className="foot-label">清晰度</span>
          <Segmented
            value={ratio}
            onChange={setRatio}
            options={[1, 2, 3].map((n) => ({ value: n, label: `${n}x` }))}
          />
        </div>
        <button
          type="button"
          className="vbtn primary block large"
          disabled={busy}
          onClick={doExport}
        >
          {busy ? '导出中…' : '⬇ 导出 PNG'}
        </button>
      </div>
    </aside>
  )
}
