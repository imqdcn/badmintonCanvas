import { useEffect, useMemo, useRef, useState } from 'react'
import { isAdvanced, isEmptySlot, playerKey, roundLabel, usedPlayerKeys } from '../domain/bracket'
import { COUNTRY_OPTIONS } from '../domain/countries'
import { searchEntries } from '../domain/search'
import { modeInfo, type Mode, type PlayerRef, type RosterEntry } from '../domain/types'
import { ALL_MODES, getProvider } from '../providers/PlayerProvider'
import { useStore } from '../store'
import { Flag, Flags, playersText } from './common'

/** 在已用集合的基础上，再排除组合里已经选好的另一位（避免 A、B 选成同一个人） */
function withKey(used: Set<string>, other: PlayerRef | null): Set<string> {
  if (!other) return used
  return new Set([...used, playerKey(other)])
}

/** 一条名单记录是否和已经用掉的选手冲突（任意一人已经在场上） */
function conflicts(entry: RosterEntry, used: Set<string>): boolean {
  return entry.players.some((p) => used.has(playerKey(p)))
}

const POPUP_W = 380

type View = 'pick' | 'compose' | 'custom'

/** 名单（内置 + 自定义） */
function useAllEntries(): RosterEntry[] {
  const custom = useStore((s) => s.customEntries)
  return useMemo(() => [...ALL_MODES.flatMap((m) => getProvider().list(m)), ...custom], [custom])
}

function EntryRow({
  entry,
  active,
  showMode,
  used,
  onPick,
  onRemove,
}: {
  entry: RosterEntry
  active: boolean
  showMode: boolean
  used?: boolean
  onPick: () => void
  onRemove?: () => void
}) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (active) ref.current?.scrollIntoView?.({ block: 'nearest' })
  }, [active])
  return (
    <li
      ref={ref}
      className={`entry ${active ? 'active' : ''} ${used ? 'used' : ''}`}
      aria-disabled={used}
      title={used ? '已经在对阵图里了，不能重复选择' : undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={used ? undefined : onPick}
    >
      <span className="entry-rank">{entry.rank ?? '自'}</span>
      <span className="entry-name">{playersText(entry.players)}</span>
      {showMode && <span className="entry-mode">{modeInfo(entry.mode).short}</span>}
      <Flags players={entry.players} />
      {used && <span className="entry-used-tag">已选用</span>}
      {onRemove && (
        <button
          type="button"
          className="entry-del"
          title="删除这条自定义记录"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          ×
        </button>
      )}
    </li>
  )
}

/** 选择名单中的一条：当前模式 / 全部 两个范围，带搜索 */
function PickView({
  used,
  onSelect,
  onCompose,
  onCustom,
}: {
  used: Set<string>
  onSelect: (e: RosterEntry) => void
  onCompose: () => void
  onCustom: () => void
}) {
  const mode = useStore((s) => s.mode)
  const removeCustom = useStore((s) => s.removeCustom)
  const all = useAllEntries()
  const [scope, setScope] = useState<'mode' | 'all'>('mode')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const pool = useMemo(
    () => (scope === 'mode' ? all.filter((e) => e.mode === mode) : all),
    [all, scope, mode],
  )
  const results = useMemo(() => searchEntries(pool, query, mode), [pool, query, mode])
  const isDouble = modeInfo(mode).double

  return (
    <div className="pick">
      <div className="tabs">
        <button
          type="button"
          className={scope === 'mode' ? 'on' : ''}
          onClick={() => setScope('mode')}
        >
          当前模式（{modeInfo(mode).short}）
        </button>
        <button
          type="button"
          className={scope === 'all' ? 'on' : ''}
          onClick={() => setScope('all')}
        >
          全部
        </button>
      </div>
      <input
        autoFocus
        className="search"
        placeholder="搜索：中文 / 拼音 / 首字母 / 英文"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (results[active] && !conflicts(results[active], used)) onSelect(results[active])
          }
        }}
      />
      <ul className="entries" role="listbox">
        {results.length === 0 && <li className="entry-empty">没有匹配的记录，可以在下方新增</li>}
        {results.map((e, i) => (
          <EntryRow
            key={e.id}
            entry={e}
            active={i === active}
            showMode={scope === 'all'}
            used={conflicts(e, used)}
            onPick={() => onSelect(e)}
            onRemove={e.custom ? () => removeCustom(e.id) : undefined}
          />
        ))}
      </ul>
      <div className="row-actions">
        {isDouble && (
          <button type="button" onClick={onCompose}>
            手动组合双打
          </button>
        )}
        <button type="button" onClick={onCustom}>
          新增选手/组合
        </button>
      </div>
    </div>
  )
}

/** 从单打名单里挑一位选手 */
function PlayerSearch({
  label,
  entries,
  value,
  used,
  onChange,
}: {
  label: string
  entries: RosterEntry[]
  value: PlayerRef | null
  used: Set<string>
  onChange: (p: PlayerRef | null) => void
}) {
  const mode = useStore((s) => s.mode)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const results = useMemo(() => searchEntries(entries, query, mode, 30), [entries, query, mode])

  return (
    <div className="player-search">
      <label>{label}</label>
      {value ? (
        <div className="chosen">
          <span>{value.name}</span>
          <Flag code={value.country} />
          <button type="button" onClick={() => onChange(null)}>
            更换
          </button>
        </div>
      ) : (
        <>
          <input
            className="search"
            placeholder="搜索选手"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
          />
          {open && (
            <ul className="entries small">
              {results.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  active={false}
                  showMode={false}
                  used={conflicts(e, used)}
                  onPick={() => {
                    onChange(e.players[0])
                    setOpen(false)
                    setQuery('')
                  }}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

/** 手动组合双打：男双/女双从同性别单打名单选两位，混双选一男一女 */
function ComposeView({
  used,
  onDone,
  onBack,
}: {
  used: Set<string>
  onDone: (players: PlayerRef[], save: boolean) => void
  onBack: () => void
}) {
  const mode = useStore((s) => s.mode)
  const all = useAllEntries()
  const singles = (m: Mode) => all.filter((e) => e.mode === m)
  const [a, setA] = useState<PlayerRef | null>(null)
  const [b, setB] = useState<PlayerRef | null>(null)
  const [save, setSave] = useState(true)

  const modeA: Mode = mode === 'WD' ? 'WS' : 'MS'
  const modeB: Mode = mode === 'MD' ? 'MS' : 'WS'
  const labelA = mode === 'XD' ? '男选手' : '选手 A'
  const labelB = mode === 'XD' ? '女选手' : '选手 B'

  return (
    <div className="compose">
      <PlayerSearch
        label={labelA}
        entries={singles(modeA)}
        value={a}
        used={withKey(used, b)}
        onChange={setA}
      />
      <PlayerSearch
        label={labelB}
        entries={singles(modeB)}
        value={b}
        used={withKey(used, a)}
        onChange={setB}
      />
      <label className="check">
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
        保存到自定义名单，下次可直接选
      </label>
      <div className="row-actions">
        <button type="button" onClick={onBack}>
          返回
        </button>
        <button
          type="button"
          className="primary"
          disabled={!a || !b}
          onClick={() => a && b && onDone([a, b], save)}
        >
          确定
        </button>
      </div>
    </div>
  )
}

function PersonForm({
  title,
  value,
  onChange,
}: {
  title: string
  value: PlayerRef
  onChange: (p: PlayerRef) => void
}) {
  return (
    <fieldset className="person">
      <legend>{title}</legend>
      <input
        placeholder="中文名（必填）"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      <input
        placeholder="英文名（可选，用于搜索）"
        value={value.nameEn}
        onChange={(e) => onChange({ ...value, nameEn: e.target.value })}
      />
      <div className="country-pick">
        <Flag code={value.country} />
        <select
          value={value.country}
          onChange={(e) => onChange({ ...value, country: e.target.value })}
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.zh}（{c.code}）
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  )
}

/** 新增自定义选手/组合（名单里找不到时使用） */
function CustomView({
  used,
  onDone,
  onBack,
}: {
  used: Set<string>
  onDone: (entry: RosterEntry) => void
  onBack: () => void
}) {
  const mode = useStore((s) => s.mode)
  const double = modeInfo(mode).double
  const blank = (): PlayerRef => ({ name: '', nameEn: '', country: 'CHN' })
  const [p1, setP1] = useState<PlayerRef>(blank())
  const [p2, setP2] = useState<PlayerRef>(blank())

  const players = double ? [p1, p2] : [p1]
  const keys = players.map((p) => playerKey({ ...p, name: p.name.trim(), nameEn: p.nameEn.trim() }))
  const duplicated =
    players.every((p) => p.name.trim()) &&
    (keys.some((k) => used.has(k)) || new Set(keys).size !== keys.length)
  const valid = players.every((p) => p.name.trim()) && !duplicated

  return (
    <div className="custom">
      <PersonForm title={double ? '选手 1' : '选手'} value={p1} onChange={setP1} />
      {double && <PersonForm title="选手 2" value={p2} onChange={setP2} />}
      {duplicated && <p className="dup-warn">这位选手已经在对阵图里了，请修改姓名或国家</p>}
      <div className="row-actions">
        <button type="button" onClick={onBack}>
          返回
        </button>
        <button
          type="button"
          className="primary"
          disabled={!valid}
          onClick={() =>
            onDone({
              id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              mode,
              rank: null,
              custom: true,
              players: players.map((p) => ({ ...p, name: p.name.trim(), nameEn: p.nameEn.trim() })),
            })
          }
        >
          保存并使用
        </button>
      </div>
    </div>
  )
}

function EditorInner() {
  const editing = useStore((s) => s.editing)!
  const bracket = useStore((s) => s.brackets[s.mode])
  const { round, index, anchor } = editing
  const slot = bracket.slots[round][index]
  const info = bracket.info[round][index]
  const R = Math.log2(bracket.size)

  const closeEditor = useStore((s) => s.closeEditor)
  const setPlayers = useStore((s) => s.setPlayers)
  const patchSlot = useStore((s) => s.patchSlot)
  const clearSlot = useStore((s) => s.clearSlot)
  const advance = useStore((s) => s.advance)
  const setInfo = useStore((s) => s.setInfo)
  const addCustom = useStore((s) => s.addCustom)

  const [view, setView] = useState<View>('pick')

  // 后续轮次（16 强起）的位置只能由上一轮这场比赛的两位选手晋级产生，不能手动选别人
  const later = round >= 1
  const feeders = later
    ? [2 * index, 2 * index + 1].map((fi) => ({ fi, slot: bracket.slots[round - 1][fi] }))
    : []

  // 首轮不允许同一位选手出现两次；后续轮次本来就是首轮选手晋级，不做限制
  const used = useMemo(
    () => (round === 0 ? usedPlayerKeys(bracket, { round, index }) : new Set<string>()),
    [bracket, round, index],
  )

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEditor()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeEditor])

  // 定位：优先放在位置右侧，放不下就放左侧，并限制在窗口内
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = anchor.right + 10
  if (left + POPUP_W > vw - 8) left = Math.max(8, anchor.left - POPUP_W - 10)
  const top = Math.max(8, Math.min(anchor.top - 40, vh - 560))

  const choose = (players: PlayerRef[]) => {
    setPlayers(round, index, players)
    closeEditor()
  }

  return (
    <>
      <div className="editor-backdrop" onClick={closeEditor} />
      <div
        className="editor"
        style={{ left, top, width: POPUP_W }}
        role="dialog"
        aria-label="编辑位置"
      >
        <div className="editor-head">
          <strong>
            {roundLabel(bracket.size, round)} · 第 {index + 1} 位
          </strong>
          <button type="button" className="x" onClick={closeEditor} aria-label="关闭">
            ×
          </button>
        </div>

        {later && (
          <div className="winner-pick">
            <div className="winner-title">选择这场比赛的晋级者</div>
            {feeders.every((f) => isEmptySlot(f.slot)) && (
              <p className="hint">请先在上一轮填好这场比赛的两位选手</p>
            )}
            {feeders.map(({ fi, slot: fs }) => {
              const empty = isEmptySlot(fs)
              const chosen = isAdvanced(bracket, round - 1, fi)
              return (
                <button
                  key={fi}
                  type="button"
                  className={`winner-option ${chosen ? 'on' : ''}`}
                  disabled={empty}
                  onClick={() => {
                    advance(round - 1, fi)
                    closeEditor()
                  }}
                >
                  <span className="winner-name">
                    {empty ? '（待定）' : fs.bye ? '-' : playersText(fs.players)}
                  </span>
                  {!empty && <Flags players={fs.players} />}
                  {chosen && <span className="winner-tag">已晋级</span>}
                </button>
              )
            })}
          </div>
        )}

        {!later && view === 'pick' && (
          <PickView
            used={used}
            onSelect={(e) => choose(e.players)}
            onCompose={() => setView('compose')}
            onCustom={() => setView('custom')}
          />
        )}
        {!later && view === 'compose' && (
          <ComposeView
            used={used}
            onBack={() => setView('pick')}
            onDone={(players, save) => {
              if (save) {
                addCustom({
                  id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  mode: useStore.getState().mode,
                  rank: null,
                  custom: true,
                  players,
                })
              }
              choose(players)
            }}
          />
        )}
        {!later && view === 'custom' && (
          <CustomView
            used={used}
            onBack={() => setView('pick')}
            onDone={(entry) => {
              addCustom(entry)
              choose(entry.players)
            }}
          />
        )}

        {(later || view === 'pick') && (
          <div className="details">
            <div className="field-row">
              {!later && (
                <label>
                  种子
                  <select
                    value={slot.seed ?? 0}
                    onChange={(e) =>
                      patchSlot(round, index, { seed: Number(e.target.value) || undefined })
                    }
                  >
                    <option value={0}>无</option>
                    {Array.from({ length: 16 }, (_, k) => (
                      <option key={k + 1} value={k + 1}>
                        {k + 1}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!slot.bye}
                  onChange={(e) => patchSlot(round, index, { bye: e.target.checked })}
                />
                轮空（显示“-”）
              </label>
            </div>
            {round >= 1 && (
              <div className="field-row">
                <label>
                  比分
                  <input
                    placeholder="如 22-20 21-12"
                    value={info.score}
                    onChange={(e) => setInfo(round, index, { score: e.target.value })}
                  />
                </label>
                <label>
                  备注
                  <input
                    placeholder="如 对手退赛"
                    value={info.note}
                    onChange={(e) => setInfo(round, index, { note: e.target.value })}
                  />
                </label>
              </div>
            )}
            <div className="row-actions">
              {!later && round < R && (
                <button type="button" onClick={() => advance(round, index)}>
                  设为获胜方 ▶
                </button>
              )}
              <button type="button" onClick={() => clearSlot(round, index)}>
                {later ? '撤销晋级（清空此位置）' : '清空此位置'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export function SlotEditor() {
  const editing = useStore((s) => s.editing)
  if (!editing) return null
  // key 变化时重置内部状态（切换到别的位置）
  return <EditorInner key={`${editing.round}-${editing.index}`} />
}
