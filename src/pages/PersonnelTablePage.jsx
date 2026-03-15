import { useState, useMemo } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import { usePersonnelData } from '../hooks/useFirestore'

const AFFILIATION_ORDER = ['General', 'TCAT']

const TYPE_ORDER = ['senior', 'resident', 'dental', 'intern', 'nurse', 'observer']

const TYPE_LABEL = {
  senior:   '専門医',
  resident: '専攻医',
  dental:   '歯科麻酔科医',
  intern:   '初期研修医',
  nurse:    '特定行為研修看護師',
  observer: '見学者',
}

const LEAVE_LABEL = {
  paid:         '有給休暇',
  compensatory: '代休',
  conference:   '学会',
  sick:         '病欠',
  other:        'その他休暇',
}

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd')
}

function getDutyLabel(oncall, oncallPrev) {
  if (oncall?.type === '当直')   return '当'
  if (oncall?.type === '残り番') return '残'
  if (oncallPrev?.type === '当直') return '明'
  return ''
}

function makeTypeGroups(items) {
  const byType = {}
  items.forEach(item => {
    const t = item.worker.type ?? 'other'
    if (!byType[t]) byType[t] = []
    byType[t].push(item)
  })
  const typeGroups = TYPE_ORDER
    .filter(t => byType[t]?.length > 0)
    .map(t => ({ type: t, label: TYPE_LABEL[t] ?? t, items: byType[t] }))
  const others = byType['other']
  if (others?.length > 0) typeGroups.push({ type: 'other', label: 'その他', items: others })
  return typeGroups
}

function groupData(data) {
  return AFFILIATION_ORDER.map(aff => {
    const affItems = data.filter(d => d.worker.affiliation === aff)
    if (affItems.length === 0) return null

    const fulltimeItems = affItems.filter(d => d.worker.employmentType === 'fulltime')
    const parttimeItems = affItems.filter(d => d.worker.employmentType !== 'fulltime')

    const employmentGroups = [
      { label: '常勤',  typeGroups: makeTypeGroups(fulltimeItems) },
      { label: '非常勤', typeGroups: makeTypeGroups(parttimeItems) },
    ].filter(g => g.typeGroups.length > 0)

    return { affiliation: aff, employmentGroups }
  }).filter(Boolean)
}

export default function PersonnelTablePage() {
  const [dateStr, setDateStr] = useState(todayStr)
  const { data, loading, error } = usePersonnelData(dateStr)

  const goDay = (delta) => {
    const d = new Date(dateStr + 'T00:00:00')
    setDateStr(format(delta > 0 ? addDays(d, 1) : subDays(d, 1), 'yyyy-MM-dd'))
  }

  const displayDate = (() => {
    try {
      return format(new Date(dateStr + 'T00:00:00'), 'yyyy年M月d日(E)', { locale: ja })
    } catch { return dateStr }
  })()

  const grouped = useMemo(() => {
    if (!data) return []
    return groupData(data)
  }, [data])

  return (
    <div className="personnel-page">
      {/* 日付選択バー */}
      <div className="date-picker-bar no-print">
        <button className="date-nav-btn" onClick={() => goDay(-1)}>‹</button>
        <input
          type="date"
          value={dateStr}
          onChange={e => setDateStr(e.target.value)}
        />
        <button className="date-nav-btn" onClick={() => goDay(1)}>›</button>
        <button
          className="btn btn-primary no-print"
          style={{ height: 44, padding: '0 18px', fontSize: 14, flexShrink: 0 }}
          onClick={() => window.print()}
        >
          🖨️ 印刷
        </button>
      </div>

      {/* 印刷タイトル */}
      <div className="print-only personnel-print-title">
        麻酔科 人事表 — {displayDate}
      </div>

      {loading && (
        <div className="loading"><div className="spinner" /></div>
      )}

      {error && (
        <div className="section">
          <div className="card" style={{ color: 'var(--danger)', textAlign: 'center' }}>
            <p>データの読み込みに失敗しました</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <div className="personnel-content">
          {grouped.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">👤</div>
              <div className="empty-state__text">勤務者が登録されていません</div>
            </div>
          )}

          {grouped.map(({ affiliation, employmentGroups }) => (
            <div key={affiliation} className="personnel-aff-block">
              <div className="personnel-aff-header">{affiliation}</div>

              {employmentGroups.map(({ label: empLabel, typeGroups }) => (
                <div key={empLabel} className="personnel-emp-block">
                  <div className="personnel-emp-header">{empLabel}</div>

                  {typeGroups.map(({ type, label, items }) => (
                    <div key={type} className="personnel-type-block">
                      <div className="personnel-type-header">{label}</div>
                      <table className="personnel-table">
                        <thead>
                          <tr>
                            <th className="pt-col-duty"></th>
                            <th className="pt-col-name">氏名</th>
                            <th className="pt-col-time">勤務時間</th>
                            <th className="pt-col-absence">離席予定</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(({ worker, shift, leave, absences, oncall, oncallPrev }) => {
                            const duty = getDutyLabel(oncall, oncallPrev)
                            const timeCell = leave
                              ? (LEAVE_LABEL[leave.leaveType] ?? '休暇')
                              : shift
                                ? `${shift.startTime}〜${shift.endTime}`
                                : '—'
                            const absCell = absences.length > 0
                              ? absences.map(ab => `${ab.startTime}〜${ab.endTime}${ab.reason ? ` (${ab.reason})` : ''}`).join(' / ')
                              : ''
                            return (
                              <tr key={worker.id} className={leave ? 'pt-row--leave' : ''}>
                                <td className="pt-col-duty" style={duty ? { color: '#dc2626', fontWeight: 700 } : undefined}>{duty}</td>
                                <td className="pt-col-name">{worker.name}</td>
                                <td className="pt-col-time">{timeCell}</td>
                                <td className="pt-col-absence">{absCell}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
