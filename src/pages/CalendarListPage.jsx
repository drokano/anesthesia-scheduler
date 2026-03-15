import React, { useState, useEffect, useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isToday,
  addMonths, subMonths,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'
import { WORK_CODE_STYLES, getDefaultShiftCode, isHoliday } from '../utils/shiftCodes'

const WEEKDAYS_SHORT = ['日', '月', '火', '水', '木', '金', '土']
const AFFILIATION_ORDER = ['General', 'TCAT']
const AFFILIATION_LABEL = { General: 'General', TCAT: 'TCAT' }

function useGanttData(yearMonth) {
  const [workers, setWorkers] = useState([])
  const [shifts,  setShifts]  = useState([])
  const [codes,   setCodes]   = useState([])

  useEffect(() => {
    const q = query(collection(db, 'workers'), orderBy('nameKana'))
    return onSnapshot(q, snap => setWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  useEffect(() => {
    if (!yearMonth) return
    const firstDay = yearMonth + '-01'
    const lastDay  = format(endOfMonth(new Date(firstDay + 'T00:00:00')), 'yyyy-MM-dd')
    const q = query(
      collection(db, 'shifts'),
      where('date', '>=', firstDay),
      where('date', '<=', lastDay),
    )
    return onSnapshot(q, snap => setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [yearMonth])

  useEffect(() => {
    if (!yearMonth) return
    const firstDay = yearMonth + '-01'
    const lastDay  = format(endOfMonth(new Date(firstDay + 'T00:00:00')), 'yyyy-MM-dd')
    const q = query(
      collection(db, 'dailyCodes'),
      where('date', '>=', firstDay),
      where('date', '<=', lastDay),
    )
    return onSnapshot(q, snap => setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [yearMonth])

  return { workers, shifts, codes }
}

export default function CalendarListPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const yearMonth = format(currentMonth, 'yyyy-MM')
  const { workers, shifts, codes } = useGanttData(yearMonth)

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end:   endOfMonth(currentMonth),
    })
  }, [currentMonth])

  const shiftMap = useMemo(() => {
    const m = {}
    shifts.forEach(s => {
      if (!m[s.workerId]) m[s.workerId] = {}
      m[s.workerId][s.date] = s.shiftCode ?? ''
    })
    return m
  }, [shifts])

  const codeMap = useMemo(() => {
    const m = {}
    codes.forEach(c => {
      if (!m[c.workerId]) m[c.workerId] = {}
      m[c.workerId][c.date] = c.code
    })
    return m
  }, [codes])

  const groups = useMemo(() => {
    return AFFILIATION_ORDER
      .map(aff => {
        const affWorkers = workers.filter(w => w.affiliation === aff)
        if (affWorkers.length === 0) return null
        return {
          affiliation: aff,
          label: AFFILIATION_LABEL[aff] ?? aff,
          fulltime: affWorkers.filter(w => w.employmentType === 'fulltime'),
          parttime: affWorkers.filter(w => w.employmentType !== 'fulltime'),
        }
      })
      .filter(Boolean)
  }, [workers])

  return (
    <div className="gantt-page">
      <div className="gantt-month-nav no-print">
        <button className="gantt-nav-btn" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>‹</button>
        <span className="gantt-month-label">
          {format(currentMonth, 'yyyy年M月', { locale: ja })}
        </span>
        <button className="gantt-nav-btn" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>›</button>
      </div>

      <div className="gantt-scroll-wrapper">
        <table className="gantt-table">
          <thead>
            <tr>
              <th className="gantt-name-cell gantt-header-cell">氏名</th>
              {days.map(day => {
                const dow     = getDay(day)
                const holiday = isHoliday(day)
                const isSat   = dow === 6
                const isSun   = dow === 0
                const today   = isToday(day)
                return (
                  <th
                    key={format(day, 'd')}
                    className={[
                      'gantt-date-header',
                      isSat ? 'gantt-sat' : (isSun || holiday) ? 'gantt-sun' : '',
                      today ? 'gantt-today-header' : '',
                    ].join(' ')}
                  >
                    <div className="gantt-date-num">{format(day, 'd')}</div>
                    <div className="gantt-date-dow">{WEEKDAYS_SHORT[dow]}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <React.Fragment key={group.affiliation}>
                <tr>
                  <td className="gantt-group-header" colSpan={days.length + 1}>
                    {group.label}
                  </td>
                </tr>
                {[
                  { sublabel: '常勤',  workers: group.fulltime },
                  { sublabel: '非常勤', workers: group.parttime },
                ].filter(sg => sg.workers.length > 0).map(({ sublabel, workers: swks }) => (
                  <React.Fragment key={sublabel}>
                    <tr>
                      <td className="gantt-employment-header" colSpan={days.length + 1}>
                        {sublabel}
                      </td>
                    </tr>
                    {swks.map(worker => {
                      const wShifts = shiftMap[worker.id] ?? {}
                      const wCodes  = codeMap[worker.id]  ?? {}
                      return (
                        <tr key={worker.id} className="gantt-row">
                          <td className="gantt-name-cell">{worker.name}</td>
                          {days.map(day => {
                            const ds      = format(day, 'yyyy-MM-dd')
                            const dow     = getDay(day)
                            const holiday = isHoliday(day)
                            const isSat   = dow === 6
                            const isSun   = dow === 0
                            const today   = isToday(day)
                            const code    = ds in wShifts
                              ? wShifts[ds]
                              : getDefaultShiftCode(day, wCodes)
                            const style   = WORK_CODE_STYLES[code] ?? { color: '#6b7280', bg: null }
                            const cellBg  = style.bg ?? (isSat ? '#eff6ff' : (isSun || holiday) ? '#fff5f5' : 'transparent')
                            return (
                              <td
                                key={ds}
                                className={['gantt-day-cell', today ? 'gantt-today' : ''].join(' ')}
                                style={{ background: cellBg }}
                              >
                                {code && (
                                  <span className="gantt-code" style={{ color: style.color }}>
                                    {code}
                                  </span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
