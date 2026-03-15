import { useState, useMemo, useEffect } from 'react'
import {
  format, getDay, isToday, isSameMonth,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
} from 'date-fns'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useWorkerMonthData } from '../../hooks/useFirestore'
import { CODE_DEFS } from '../../pages/ShiftInputPage'

const toDateStr = (d) => format(d, 'yyyy-MM-dd')
const WEEKDAYS  = ['日', '月', '火', '水', '木', '金', '土']
const codeInfo  = (code) => CODE_DEFS.find(c => c.code === (code ?? '')) ?? CODE_DEFS[0]

// 選択中ワーカーの当直・外勤データをリアルタイム取得
function useWorkerRealtimeData(workerId, yearMonth) {
  const [oncall,  setOncall]  = useState([])
  const [outside, setOutside] = useState([])

  useEffect(() => {
    if (!workerId || !yearMonth) {
      setOncall([]); setOutside([]); return
    }
    const q1 = query(
      collection(db, 'oncallAssignments'),
      where('workerId', '==', workerId),
      where('yearMonth', '==', yearMonth),
    )
    const q2 = query(
      collection(db, 'outsideAssignments'),
      where('workerId', '==', workerId),
      where('yearMonth', '==', yearMonth),
    )
    const u1 = onSnapshot(q1, snap => setOncall(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const u2 = onSnapshot(q2, snap => setOutside(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    return () => { u1(); u2() }
  }, [workerId, yearMonth])

  return { oncall, outside }
}

const ONCALL_STYLE = {
  '当直':    { color: '#dc2626', bg: '#fee2e2' },
  '残り番':  { color: '#ea580c', bg: '#fff7ed' },
  '土曜出番':{ color: '#0891b2', bg: '#ecfeff' },
  '外来':    { color: '#16a34a', bg: '#f0fdf4' },
}

function BrowseDayCell({ date, code, shift, oncall, outside, absences }) {
  const dow   = getDay(date)
  const isSat = dow === 6
  const isSun = dow === 0
  const today = isToday(date)

  const info   = codeInfo(code)
  const cellBg = code && info.bg ? info.bg
               : isSat ? '#eff6ff'
               : isSun ? '#fff5f5'
               : 'var(--surface)'

  return (
    <div
      className={['browse-day', today ? 'cal-today' : ''].join(' ')}
      style={{ background: cellBg }}
    >
      {/* 日付 */}
      <span className={`cal-num ${isSat ? 'cal-sat-num' : isSun ? 'cal-sun-num' : ''}`}>
        {format(date, 'd')}
      </span>

      <div className="browse-day__items">
        {/* コードバッジ */}
        {code && (
          <div className="browse-item" style={{ background: info.bg ?? '#f3f4f6', color: info.color }}>
            [{code}] {info.label}
          </div>
        )}

        {/* シフト時刻 */}
        {shift && (shift.startTime || shift.endTime) && (
          <div className="browse-item browse-item--shift">
            {shift.startTime || '?'}〜{shift.endTime || '?'}
          </div>
        )}

        {/* 当直・残り番等 */}
        {oncall && (
          <div
            className="browse-item"
            style={{ background: ONCALL_STYLE[oncall.type]?.bg ?? '#f3f4f6', color: ONCALL_STYLE[oncall.type]?.color ?? '#374151' }}
          >
            {oncall.type}
          </div>
        )}

        {/* 外勤 */}
        {outside && (
          <div className="browse-item browse-item--outside">
            外勤: {outside.hospitalName || '—'}
          </div>
        )}

        {/* 離席件数 */}
        {absences.length > 0 && (
          <div className="browse-item browse-item--absence">
            離席 {absences.length}件
          </div>
        )}
      </div>
    </div>
  )
}

export default function BrowsingCalendar({ workerId, currentMonth }) {
  const yearMonth = format(currentMonth, 'yyyy-MM')

  // 静的データ（shifts, codes, absences, outsideWork）
  const { data } = useWorkerMonthData(workerId ?? '', yearMonth)

  // リアルタイムデータ（oncall, outside assignments）
  const { oncall, outside } = useWorkerRealtimeData(workerId, yearMonth)

  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  // 日付 → データのマップ
  const codeMap    = useMemo(() => { const m = {}; (data.codes ?? []).forEach(c => { m[c.date] = c.code }); return m }, [data.codes])
  const shiftMap   = useMemo(() => { const m = {}; data.shifts.forEach(s => { m[s.date] = s }); return m }, [data.shifts])
  const oncallMap  = useMemo(() => { const m = {}; oncall.forEach(a => { m[a.date] = a }); return m }, [oncall])
  const outsideMap = useMemo(() => { const m = {}; outside.forEach(a => { m[a.date] = a }); return m }, [outside])
  const absenceMap = useMemo(() => {
    const m = {}
    data.absences.forEach(a => { if (!m[a.date]) m[a.date] = []; m[a.date].push(a) })
    return m
  }, [data.absences])

  if (!workerId) {
    return (
      <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center' }}>
        勤務者を選択すると閲覧用カレンダーが表示されます
      </div>
    )
  }

  return (
    <div className="browse-calendar">
      <div className="calendar">
        <div className="calendar-weekdays">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`calendar-wd ${i === 0 ? 'cal-sun' : i === 6 ? 'cal-sat' : ''}`}>{d}</div>
          ))}
        </div>
        <div className="browse-grid">
          {calDays.map(date => {
            const ds      = toDateStr(date)
            const inMonth = isSameMonth(date, currentMonth)
            return (
              <div key={ds} style={{ opacity: inMonth ? 1 : 0.25, minWidth: 0, overflow: 'hidden', width: '100%' }}>
                <BrowseDayCell
                  date={date}
                  code={codeMap[ds]}
                  shift={shiftMap[ds]}
                  oncall={oncallMap[ds]}
                  outside={outsideMap[ds]}
                  absences={absenceMap[ds] ?? []}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
