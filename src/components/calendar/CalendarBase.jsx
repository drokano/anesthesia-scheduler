import { useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isToday, isSameMonth, getDay,
} from 'date-fns'
import { ja } from 'date-fns/locale'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const toDateStr = (date) => format(date, 'yyyy-MM-dd')

export { toDateStr }

export default function CalendarBase({ currentMonth, renderCell }) {
  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  return (
    <div className="calendar">
      <div className="calendar-weekdays">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`calendar-wd ${i === 0 ? 'cal-sun' : i === 6 ? 'cal-sat' : ''}`}>{d}</div>
        ))}
      </div>
      <div className="calendar-grid">
        {calDays.map(date => {
          const ds     = toDateStr(date)
          const inMonth = isSameMonth(date, currentMonth)
          const dow    = getDay(date)
          const isSat  = dow === 6
          const isSun  = dow === 0
          const today  = isToday(date)
          return (
            <div
              key={ds}
              className={[
                'calendar-day-wrapper',
                !inMonth ? 'cal-other-month' : '',
                today    ? 'cal-today-wrapper' : '',
              ].join(' ')}
            >
              {renderCell(date, { ds, inMonth, isSat, isSun, isToday: today, dow })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
