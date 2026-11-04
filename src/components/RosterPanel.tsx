import { useState } from 'react'
import { parseRosterJson, rosterToJson } from '../domain/rosterImport'
import { modeInfo } from '../domain/types'
import { downloadText, readText } from '../export'
import { BUILTIN_LABEL, getProvider } from '../providers/PlayerProvider'
import { useStore } from '../store'

/** 左侧面板的“名单”区域：导入 JSON、导出当前名单、恢复内置名单 */
export function RosterPanel() {
  const mode = useStore((s) => s.mode)
  const overrides = useStore((s) => s.rosterOverrides)
  const setOverride = useStore((s) => s.setRosterOverride)
  const clearOverride = useStore((s) => s.clearRosterOverride)
  const notify = useStore((s) => s.notify)
  const [errors, setErrors] = useState<string[]>([])
  const [info, setInfo] = useState<string | null>(null)

  const info_ = modeInfo(mode)
  const override = overrides[mode]
  const current = getProvider(overrides).list(mode)

  const onFile = async (file: File) => {
    setErrors([])
    setInfo(null)
    let text: string
    try {
      text = await readText(file)
    } catch {
      setErrors(['文件读取失败'])
      return
    }
    const res = parseRosterJson(text, mode)
    if (!res.ok) {
      setErrors(res.errors)
      return
    }
    setOverride(res.mode, { entries: res.entries, fileName: file.name, importedAt: Date.now() })
    const msg =
      `已导入 ${res.entries.length} 条到「${info_.label}」名单` +
      (res.warnings.length ? `。注意：${res.warnings.join('；')}` : '')
    setInfo(msg)
    notify(null)
  }

  return (
    <section>
      <h2>名单（{info_.label}）</h2>
      <p className="hint roster-source">
        当前使用：
        {override
          ? `已导入「${override.fileName}」，${override.entries.length} 条（${new Date(override.importedAt).toLocaleString()}）`
          : `${BUILTIN_LABEL}，${current.length} 条`}
      </p>
      <div className="field-inline">
        <label className="file-btn">
          导入 JSON
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ''
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => downloadText(`名单-${info_.short}.json`, rosterToJson(mode, current))}
        >
          导出当前名单
        </button>
        {override && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`恢复「${info_.label}」的内置名单？已导入的名单会被移除。`)) {
                clearOverride(mode)
                setInfo(null)
                setErrors([])
              }
            }}
          >
            恢复内置名单
          </button>
        )}
      </div>
      {info && (
        <p className="roster-ok" role="status">
          {info}
        </p>
      )}
      {errors.length > 0 && (
        <div className="roster-errors" role="alert">
          <strong>导入失败，名单没有改动：</strong>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="hint">
        文件格式与内置名单（src/data）相同，会导入到当前模式「{info_.label}」
        {info_.double ? '，“球员”需为“甲 Jia / 乙 Yi”两位选手' : '，每条 1 位选手'}。
        导入只影响当前浏览器，已放进对阵图的选手不受影响。点“导出当前名单”可得到一份模板。
      </p>
    </section>
  )
}
