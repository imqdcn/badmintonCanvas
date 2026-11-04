import { useState, type ReactNode } from 'react'

/**
 * 仿 Vant Collapse 的可折叠卡片：标题栏 + 图标 + 箭头，点击展开/收起内容。
 * defaultOpen 控制初始状态（比如常用的“对阵”默认展开，“头部”默认收起）。
 */
export function Collapse({
  icon,
  title,
  defaultOpen = false,
  badge,
  children,
}: {
  icon: ReactNode
  title: string
  defaultOpen?: boolean
  badge?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`vcard ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="vcard-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="vcard-icon">{icon}</span>
        <span className="vcard-title">{title}</span>
        {badge}
        <span className="vcard-arrow" aria-hidden="true" />
      </button>
      {open && <div className="vcard-body">{children}</div>}
    </div>
  )
}
