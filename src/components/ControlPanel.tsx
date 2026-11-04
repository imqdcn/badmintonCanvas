import { useState, type RefObject } from 'react'
import { bracketHasData } from '../domain/bracket'
import { BRACKET_SIZES, MODES, modeInfo, type BracketSize } from '../domain/types'
import { exportPng, readImage } from '../export'
import { useStore } from '../store'
import { RosterPanel } from './RosterPanel'

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
      <div className="field-inline">
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) onChange(await readImage(f))
            e.target.value = ''
          }}
        />
        {value && (
          <button type="button" onClick={() => onChange(null)}>
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
      <h1>羽毛球对阵图编辑器</h1>

      {notice && (
        <div className="notice" role="status">
          {notice}
          <button type="button" onClick={() => notify(null)} aria-label="关闭提示">
            ×
          </button>
        </div>
      )}

      <section>
        <h2>对阵</h2>
        <div className="mode-tabs" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={m.id === mode}
              className={m.id === mode ? 'on' : ''}
              onClick={() => setMode(m.id)}
            >
              {m.short}
            </button>
          ))}
        </div>
        <div className="field">
          <label>规模</label>
          <div className="field-inline">
            {BRACKET_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                className={n === bracket.size ? 'on' : ''}
                onClick={() => changeSize(n)}
              >
                {n}强
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`清空${modeInfo(mode).label}的全部对阵数据？`)) resetBracket()
          }}
        >
          清空当前对阵
        </button>
        <label className="check">
          <input
            type="checkbox"
            checked={header.shortNames !== false}
            onChange={(e) => patchHeader({ shortNames: e.target.checked })}
          />
          长译名用简称显示（法贾尔·阿尔菲安 → 阿尔菲安）
        </label>
        <p className="hint">点击对阵图里的位置选择选手；悬停时出现的 ▶ 可把选手晋级到下一轮。</p>
      </section>

      <section>
        <h2>头部</h2>
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
              <label className="file-btn">
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
                onClick={() => removeSocial(s.id)}
                aria-label={`删除 ${s.label}`}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={addSocial}>
            + 添加图标
          </button>
        </div>
      </section>

      <RosterPanel />

      <section>
        <h2>水印</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={header.watermarkOn}
            onChange={(e) => patchHeader({ watermarkOn: e.target.checked })}
          />
          显示水印
        </label>
        <input
          value={header.watermark}
          onChange={(e) => patchHeader({ watermark: e.target.value })}
        />
      </section>

      <section>
        <h2>导出</h2>
        <div className="field-inline">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              className={n === ratio ? 'on' : ''}
              onClick={() => setRatio(n)}
            >
              {n}x
            </button>
          ))}
        </div>
        <button type="button" className="primary big" disabled={busy} onClick={doExport}>
          {busy ? '导出中…' : '导出 PNG'}
        </button>
      </section>
    </aside>
  )
}
