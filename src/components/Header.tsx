import { Fragment } from 'react'
import { HEADER_H } from '../domain/layout'
import { useStore } from '../store'

/** 把标题按关键词切开，关键词显示成黄色 */
function Title({ title, highlight }: { title: string; highlight: string }) {
  if (!highlight || !title.includes(highlight)) return <>{title}</>
  const parts = title.split(highlight)
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < parts.length - 1 && <span className="hl">{highlight}</span>}
        </Fragment>
      ))}
    </>
  )
}

export function Header() {
  const h = useStore((s) => s.header)
  return (
    <div className="hdr" style={{ height: HEADER_H }}>
      {h.posterUrl && (
        <img
          className="hdr-poster"
          src={h.posterUrl}
          alt=""
          style={{
            transform: `translate(${h.posterX}%, ${h.posterY}%) scale(${h.posterScale})`,
          }}
        />
      )}
      <div className="hdr-logo">
        {h.logoUrl ? (
          <img src={h.logoUrl} alt="logo" />
        ) : (
          <span className="editor-only logo-hint">在左侧面板上传 Logo</span>
        )}
      </div>
      <div className="hdr-right">
        <div className="hdr-title">
          <Title title={h.title} highlight={h.highlight} />
        </div>
        <div className="hdr-date">{h.dateLine}</div>
        <div className="hdr-socials">
          {h.socials.map((s) => (
            <span key={s.id} className="social-icon" title={s.label}>
              {s.icon ? <img src={s.icon} alt={s.label} /> : s.label.slice(0, 1)}
            </span>
          ))}
          {h.badge && <span className="badge">{h.badge}</span>}
        </div>
      </div>
    </div>
  )
}
