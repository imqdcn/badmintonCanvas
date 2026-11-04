import { useMemo } from 'react'
import { isAdvanced, isEmptySlot } from '../domain/bracket'
import { CANVAS_W, computeLayout, SECTIONS, type Layout } from '../domain/layout'
import type { Slot } from '../domain/types'
import { useStore } from '../store'
import { Flags, playersText, seedGlyph } from './common'

function Trophy() {
  return (
    <svg className="trophy" viewBox="0 0 64 64" width="38" height="38" aria-hidden="true">
      <path
        d="M16 8h32v14c0 9-6 16-16 16S16 31 16 22V8z M16 12H6c0 10 4 16 12 18 M48 12h10c0 10-4 16-12 18"
        fill="#e6b93c"
        stroke="#b88a1e"
        strokeWidth="2"
      />
      <rect x="28" y="38" width="8" height="10" fill="#d6a42c" />
      <rect x="20" y="48" width="24" height="8" rx="2" fill="#b88a1e" />
    </svg>
  )
}

function SlotBox({
  round,
  index,
  slot,
  layout,
  champion,
}: {
  round: number
  index: number
  slot: Slot
  layout: Layout
  champion: boolean
}) {
  const openEditor = useStore((s) => s.openEditor)
  const advance = useStore((s) => s.advance)
  const editing = useStore((s) => s.editing)
  const advanced = useStore((s) => isAdvanced(s.brackets[s.mode], round, index))
  const info = useStore((s) => s.brackets[s.mode].info[round][index])

  const col = layout.cols[Math.min(round, layout.R - 1)]
  const cy = layout.centerY(round, index)
  const h = champion ? 44 : layout.rowH
  const empty = isEmptySlot(slot)
  const selected = editing?.round === round && editing.index === index

  // 首轮按"场"交替深浅底色，后续轮次统一浅色
  const tone = round === 0 ? ((index >> 1) % 2 === 0 ? 'light' : 'dark') : 'light'
  const short = useStore((s) => s.header.shortNames !== false)
  const label = (slot.seed ? seedGlyph(slot.seed) : '') + playersText(slot.players, short)
  const cls = [
    'slot',
    tone,
    empty ? 'empty' : '',
    champion ? 'champion' : '',
    selected ? 'selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div
        className={cls}
        style={{ left: col.x, top: cy - h / 2, width: col.w, height: h, fontSize: layout.fontSize }}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          openEditor({
            round,
            index,
            anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
          })
        }}
        title="点击编辑"
      >
        {slot.bye ? (
          <span className="slot-name bye">-</span>
        ) : (
          !empty && (
            <>
              <span className="slot-name">{label}</span>
              <Flags players={slot.players} />
            </>
          )
        )}
        {!empty && round < layout.R && (
          <button
            type="button"
            className={`adv editor-only ${advanced ? 'on' : ''}`}
            title={advanced ? '已晋级' : '晋级到下一轮'}
            onClick={(e) => {
              e.stopPropagation()
              advance(round, index)
            }}
          >
            ▶
          </button>
        )}
      </div>
      {round >= 1 && (info.score || info.note) && (
        <div className="match-info" style={{ left: col.x, top: cy + h / 2 + 1, width: col.w }}>
          {info.score && <div>{info.score}</div>}
          {info.note && <div>{info.note}</div>}
        </div>
      )}
    </>
  )
}

/** 连接线：首轮到冠军之间的树状括号 */
function Connectors({ layout }: { layout: Layout }) {
  const { R, cols, centerY, size } = layout
  const paths: string[] = []
  for (let r = 0; r < R - 1; r++) {
    const xr = cols[r].x + cols[r].w
    const xl = cols[r + 1].x
    const mid = xr + (xl - xr) / 2
    const count = size >> (r + 1)
    for (let i = 0; i < count; i++) {
      const ya = centerY(r, i * 2)
      const yb = centerY(r, i * 2 + 1)
      const yp = centerY(r + 1, i)
      paths.push(`M${xr} ${ya}H${mid}V${yb}H${xr}M${mid} ${yp}H${xl}`)
    }
  }
  // 决赛两人连到右侧，冠军框在中间
  const last = cols[R - 1]
  const xr = last.x + last.w
  const ya = centerY(R - 1, 0)
  const yb = centerY(R - 1, 1)
  const yc = centerY(R, 0)
  paths.push(`M${xr} ${ya}H${xr + 8}V${yb}H${xr}M${xr + 8} ${yc}H${xr}`)

  return (
    <svg className="connectors" width={CANVAS_W} height={layout.bodyH}>
      <path d={paths.join('')} fill="none" stroke="#2a2a2a" strokeWidth="1" />
    </svg>
  )
}

export function Bracket() {
  const mode = useStore((s) => s.mode)
  const bracket = useStore((s) => s.brackets[s.mode])
  const labels = useStore((s) => s.sectionLabels)
  const setLabel = useStore((s) => s.setSectionLabel)
  const watermark = useStore((s) => s.header.watermark)
  const watermarkOn = useStore((s) => s.header.watermarkOn)
  const layout = useMemo(() => computeLayout(bracket.size), [bracket.size])
  const R = layout.R

  const labelCol = layout.cols[Math.min(3, R - 1)]

  return (
    <div className="bracket" style={{ height: layout.bodyH }} data-mode={mode}>
      <Connectors layout={layout} />

      {layout.dividerYs.map((y) => (
        <div key={y} className="divider" style={{ top: y }} />
      ))}
      {labels.slice(0, SECTIONS).map((text, s) => (
        <span
          key={`${s}-${text}`}
          className="section-label"
          contentEditable
          suppressContentEditableWarning
          style={{ left: labelCol.x + 6, top: layout.sectionBottoms[s] - 22 }}
          onBlur={(e) => setLabel(s, e.currentTarget.textContent ?? '')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
        >
          {text}
        </span>
      ))}

      {bracket.slots.map((round, r) =>
        round.map((slot, i) =>
          r === R ? null : (
            <SlotBox
              key={`${r}-${i}`}
              round={r}
              index={i}
              slot={slot}
              layout={layout}
              champion={false}
            />
          ),
        ),
      )}

      {/* 冠军框 + 奖杯 */}
      <div
        className="trophy-wrap"
        style={{
          left: layout.cols[R - 1].x - 44,
          top: layout.centerY(R, 0) - 19,
        }}
      >
        <Trophy />
      </div>
      <SlotBox round={R} index={0} slot={bracket.slots[R][0]} layout={layout} champion />

      {watermarkOn && watermark && <div className="watermark">{watermark}</div>}
    </div>
  )
}
