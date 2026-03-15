import { useState, useMemo } from 'react'
import {
  format, getDay, isToday, isSameMonth,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { useWorkerMonthData, addDocument, deleteDocument } from '../../hooks/useFirestore'
import { useToast } from '../../hooks/useToast'
import Toast from '../common/Toast'

const WEEKDAYS  = ['日', '月', '火', '水', '木', '金', '土']
const toDateStr = (d) => format(d, 'yyyy-MM-dd')

// 5分単位の時刻スロット（06:00〜18:00）
const TIME_SLOTS = Array.from({ length: 145 }, (_, i) => {
  const total = 6 * 60 + i * 5
  const h = Math.floor(total / 60).toString().padStart(2, '0')
  const m = (total % 60).toString().padStart(2, '0')
  return `${h}:${m}`
})

const REASONS = ['会議', '学生対応', '業者面談', 'その他']

// ===== 離席ポップオーバー =====
function AbsencePopover({ date, absences, workerId, onClose, onSaved, showToast }) {
  const label = format(date, 'M月d日(E)', { locale: ja })
  const [form, setForm]   = useState({ startTime: '', endTime: '', reason: '会議' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleAdd = async () => {
    if (!form.startTime || !form.endTime) {
      showToast('開始・終了時刻を選択してください', 'error'); return
    }
    if (form.startTime >= form.endTime) {
      showToast('終了は開始より後の時刻を選んでください', 'error'); return
    }
    setSaving(true)
    try {
      await addDocument('absences', { workerId, date: toDateStr(date), ...form })
      showToast('離席を追加しました', 'success')
      setForm({ startTime: '', endTime: '', reason: '会議' })
      onSaved()
    } catch { showToast('保存に失敗しました', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try {
      await deleteDocument('absences', id)
      showToast('削除しました', 'success')
      onSaved()
    } catch { showToast('削除に失敗しました', 'error') }
  }

  return (
    <>
      <div className="popover-overlay" onClick={onClose} />
      <div className="code-popover absence-popover">
        <div className="code-popover__title">⏸️ {label} 離席予定</div>

        {/* 登録済み離席 */}
        {absences.length > 0 && (
          <div className="absence-pop-list">
            {absences.map(ab => (
              <div key={ab.id} className="absence-pop-item">
                <span className="absence-pop-item__time">{ab.startTime}〜{ab.endTime}</span>
                <span className="absence-pop-item__reason">{ab.reason}</span>
                <button className="absence-pop-item__del" onClick={() => handleDelete(ab.id)}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* 追加フォーム */}
        <div className="absence-pop-form">
          <div className="absence-pop-form__row">
            <select
              className="absence-time-sel"
              value={form.startTime}
              onChange={e => set('startTime', e.target.value)}
            >
              <option value="">開始</option>
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="absence-pop-form__sep">〜</span>
            <select
              className="absence-time-sel"
              value={form.endTime}
              onChange={e => set('endTime', e.target.value)}
            >
              <option value="">終了</option>
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <select
            className="form-select"
            style={{ height: 40, fontSize: 14, marginTop: 6 }}
            value={form.reason}
            onChange={e => set('reason', e.target.value)}
          >
            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            className="btn btn-primary btn-block"
            style={{ height: 40, marginTop: 8 }}
            onClick={handleAdd}
            disabled={saving}
          >
            {saving ? '追加中...' : '＋ 離席を追加'}
          </button>
        </div>

        <button className="code-popover__cancel" onClick={onClose}>閉じる</button>
      </div>
    </>
  )
}

// ===== メインコンポーネント =====
export default function AbsenceMode({ workerId, currentMonth }) {
  const yearMonth = format(currentMonth, 'yyyy-MM')
  const { data, refetch } = useWorkerMonthData(workerId, yearMonth)
  const [activeDate, setActiveDate] = useState(null)
  const { toast, showToast } = useToast()

  const absenceMap = useMemo(() => {
    const m = {}
    data.absences.forEach(a => { if (!m[a.date]) m[a.date] = []; m[a.date].push(a) })
    return m
  }, [data.absences])

  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

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
            const ds          = toDateStr(date)
            const inMonth     = isSameMonth(date, currentMonth)
            const dow         = getDay(date)
            const isSat       = dow === 6
            const isSun       = dow === 0
            const today       = isToday(date)
            const dayAbsences = absenceMap[ds] ?? []
            const hasAbsence  = dayAbsences.length > 0
            const cellBg      = hasAbsence ? '#fffbeb' : isSat ? '#eff6ff' : isSun ? '#fff5f5' : 'var(--surface)'
            const isActive    = activeDate && toDateStr(activeDate) === ds

            return (
              <button
                key={ds}
                className={[
                  'calendar-day', 'calendar-day--absence',
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
                {hasAbsence && (
                  <div className="absence-cell-items">
                    {dayAbsences.slice(0, 2).map((ab, i) => (
                      <div key={i} className="absence-cell-item">
                        {ab.startTime}〜{ab.endTime}
                      </div>
                    ))}
                    {dayAbsences.length > 2 && (
                      <div className="absence-cell-more">+{dayAbsences.length - 2}件</div>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {activeDate && (
        <AbsencePopover
          date={activeDate}
          absences={absenceMap[toDateStr(activeDate)] ?? []}
          workerId={workerId}
          onClose={() => setActiveDate(null)}
          onSaved={refetch}
          showToast={showToast}
        />
      )}
      <Toast toast={toast} />
    </div>
  )
}
