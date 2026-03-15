import { useState, useMemo } from 'react'
import {
  format, getDay, isToday, isSameMonth,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { useWorkerMonthData, saveCode } from '../../hooks/useFirestore'
import { useToast } from '../../hooks/useToast'
import Toast from '../common/Toast'
import { CODE_DEFS } from '../../pages/ShiftInputPage'

const toDateStr = (d) => format(d, 'yyyy-MM-dd')
const codeInfo  = (code) => CODE_DEFS.find(c => c.code === (code ?? '')) ?? CODE_DEFS[0]
const WEEKDAYS  = ['日', '月', '火', '水', '木', '金', '土']

function CodePopover({ date, currentCode, onSelect, onClose }) {
  const label = format(date, 'M月d日(E)', { locale: ja })
  return (
    <>
      <div className="popover-overlay" onClick={onClose} />
      <div className="code-popover">
        <div className="code-popover__title">{label}</div>
        <div className="code-popover__grid">
          {CODE_DEFS.map(c => (
            <button
              key={c.code}
              className={`code-popover__btn ${currentCode === c.code ? 'selected' : ''}`}
              style={{ background: c.bg ?? '#f9fafb', color: c.color, borderColor: currentCode === c.code ? c.color : 'var(--border)' }}
              onClick={() => onSelect(c.code)}
            >
              <span className="code-popover__code">{c.code || '—'}</span>
              <span className="code-popover__lbl">{c.code ? c.label : '通常勤務'}</span>
            </button>
          ))}
        </div>
        <button className="code-popover__cancel" onClick={onClose}>キャンセル</button>
      </div>
    </>
  )
}

export default function KibouMode({ workerId, currentMonth }) {
  const yearMonth = format(currentMonth, 'yyyy-MM')
  const { data, refetch } = useWorkerMonthData(workerId, yearMonth)
  const [activeDate, setActiveDate] = useState(null)
  const [saving, setSaving]         = useState(false)
  const { toast, showToast }        = useToast()

  const codeMap = useMemo(() => {
    const m = {}
    ;(data.codes ?? []).forEach(c => { m[c.date] = c.code })
    return m
  }, [data.codes])

  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const handleSelect = async (code) => {
    if (!workerId || !activeDate || saving) return
    setSaving(true)
    try {
      await saveCode(workerId, toDateStr(activeDate), code)
      showToast('保存しました', 'success')
      refetch()
      setActiveDate(null)
    } catch (err) {
      showToast('保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!workerId) {
    return (
      <div className="empty-state">
        <div className="empty-state__text">勤務者を選択してください</div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="calendar">
        <div className="calendar-weekdays">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`calendar-wd ${i === 0 ? 'cal-sun' : i === 6 ? 'cal-sat' : ''}`}>{d}</div>
          ))}
        </div>
        <div className="calendar-grid">
          {calDays.map(date => {
            const ds      = toDateStr(date)
            const inMonth = isSameMonth(date, currentMonth)
            const dow     = getDay(date)
            const isSat   = dow === 6
            const isSun   = dow === 0
            const today   = isToday(date)
            const code    = codeMap[ds]
            const info    = codeInfo(code)
            const cellBg  = code && info.bg ? info.bg : isSat ? '#eff6ff' : isSun ? '#fff5f5' : 'var(--surface)'
            const isActive = activeDate && toDateStr(activeDate) === ds

            return (
              <button
                key={ds}
                className={[
                  'calendar-day',
                  !inMonth ? 'cal-other-month' : '',
                  today    ? 'cal-today' : '',
                  isActive ? 'cal-active' : '',
                ].join(' ')}
                style={{ background: cellBg }}
                onClick={() => setActiveDate(date)}
              >
                <span className={`cal-num ${isSat ? 'cal-sat-num' : isSun ? 'cal-sun-num' : ''}`}>
                  {format(date, 'd')}
                </span>
                {code && (
                  <span className="cal-code-badge" style={{ color: info.color, background: info.bg }}>
                    {code}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {activeDate && (
        <CodePopover
          date={activeDate}
          currentCode={codeMap[toDateStr(activeDate)] ?? ''}
          onSelect={handleSelect}
          onClose={() => setActiveDate(null)}
        />
      )}
      <Toast toast={toast} />
    </div>
  )
}
