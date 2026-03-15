import { addMonths, subMonths } from 'date-fns'

const MIN_YEAR = 2026
const MIN_MON  = 2  // 0-indexed: 2 = March

export default function MonthNav({
  currentMonth,
  onChange,
  workers        = null,
  workersLoading = false,
  workerId       = '',
  onWorkerChange = null,
  modes          = null,
  activeMode     = '',
  onModeChange   = null,
}) {
  const year = currentMonth.getFullYear()
  const mon  = currentMonth.getMonth()

  const maxYear = new Date().getFullYear() + 3
  const years   = Array.from({ length: maxYear - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i)
  const months  = Array.from({ length: 12 }, (_, i) => i)
    .filter(m => !(year === MIN_YEAR && m < MIN_MON))

  const isAtMin = year === MIN_YEAR && mon === MIN_MON

  const setYM = (y, m) => {
    if (y === MIN_YEAR && m < MIN_MON) m = MIN_MON
    onChange(new Date(y, m, 1))
  }

  const goPrev = () => { if (!isAtMin) onChange(subMonths(currentMonth, 1)) }
  const goNext = () => onChange(addMonths(currentMonth, 1))

  const showWorkers = workers !== null && onWorkerChange !== null
  const showModes   = modes !== null && onModeChange !== null

  return (
    <div className="cal-nav-bar">

      {/* 左側: モードタブ + 勤務者選択（Mobile=上段スクロール, PC=左寄せ）*/}
      <div className="cal-nav-left">
        {showModes && modes.map(m => (
          <button
            key={m.key}
            className={`cal-mode-btn ${activeMode === m.key ? 'active' : ''}`}
            onClick={() => onModeChange(m.key)}
          >
            {m.label}
          </button>
        ))}
        {showWorkers && (
          workersLoading
            ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
            : <select
                className="cal-worker-select"
                value={workerId}
                onChange={e => onWorkerChange(e.target.value)}
              >
                <option value="">勤務者を選択</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
        )}
      </div>

      {/* 右側: 年月ナビ（Mobile=下段, PC=右寄せ compact）*/}
      <div className="cal-nav-right">
        <button className="cal-nav-btn" onClick={goPrev} disabled={isAtMin}>‹</button>
        <div className="cal-nav-selects">
          <select className="cal-ym-select" value={year} onChange={e => setYM(parseInt(e.target.value), mon)}>
            {years.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select className="cal-ym-select" value={mon} onChange={e => setYM(year, parseInt(e.target.value))}>
            {months.map(m => <option key={m} value={m}>{m + 1}月</option>)}
          </select>
        </div>
        <button className="cal-nav-btn" onClick={goNext}>›</button>
      </div>

    </div>
  )
}
