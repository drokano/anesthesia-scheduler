import React, { useState, useMemo, useEffect } from 'react'
import { format, getDay, isToday, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useWorkers } from '../../hooks/useFirestore'
import { isHoliday } from '../../utils/shiftCodes'
import Toast from '../common/Toast'
import { useToast } from '../../hooks/useToast'

const WEEKDAYS_SHORT = ['日', '月', '火', '水', '木', '金', '土']

// 当直タイプのスタイル・短縮ラベル
const TYPE_STYLES = {
  '当直':   { color: '#dc2626', bg: '#fee2e2', short: '当' },
  '残り番':  { color: '#ea580c', bg: '#fff7ed', short: '残' },
  '土曜出番': { color: '#0891b2', bg: '#ecfeff', short: '土出' },
  '外来':   { color: '#16a34a', bg: '#f0fdf4', short: '外' },
}

// 勤務・当直希望コードの色（dailyCodes の code 値）
const KIBOU_COLORS = {
  'Y': '#16a34a', 'N': '#0891b2', 'G': '#2563eb', 'X': '#4f46e5',
  'A': '#ea580c', 'B': '#d97706', 'C': '#db2777', 'P': '#7c3aed', '出': '#0f766e',
}

const WEEKDAY_OPTIONS  = ['', '当直', '残り番']
const SATURDAY_OPTIONS = ['', '当直', '残り番', '土曜出番', '外来']

// 絞り込み: 常勤 + 専門医/専攻医/歯科麻酔医
const VALID_TYPES = new Set(['senior', 'resident', 'dental'])
const filterWorkers = (ws) =>
  ws.filter(w => w.employmentType === 'fulltime' && VALID_TYPES.has(w.type) && !w.hideFromDutyCalendar)

// General / TCAT グループ分け
const AFFILIATION_ORDER = ['General', 'TCAT']
const AFFILIATION_LABEL = { General: 'General', TCAT: 'TCAT' }
function groupByAffiliation(workers) {
  const groups = { General: [], TCAT: [], other: [] }
  workers.forEach(w => {
    if (w.affiliation === 'General') groups.General.push(w)
    else if (w.affiliation === 'TCAT') groups.TCAT.push(w)
    else groups.other.push(w)
  })
  // rows: [{ type: 'header', label }, { type: 'worker', worker }, ...]
  const rows = []
  AFFILIATION_ORDER.forEach(aff => {
    if (groups[aff].length > 0) {
      rows.push({ rowType: 'header', label: AFFILIATION_LABEL[aff] })
      groups[aff].forEach(w => rows.push({ rowType: 'worker', worker: w }))
    }
  })
  if (groups.other.length > 0) {
    groups.other.forEach(w => rows.push({ rowType: 'worker', worker: w }))
  }
  return rows
}

// バリデーション（表示用）
function validateAssignments(assignments) {
  const errors = []
  const byDate = {}
  assignments.forEach(a => {
    if (!byDate[a.date]) byDate[a.date] = []
    byDate[a.date].push(a)
  })
  Object.keys(byDate).sort().forEach(date => {
    const list = byDate[date]
    const oncallCount = list.filter(a => a.type === '当直').length
    const nokoriCount = list.filter(a => a.type === '残り番').length
    if (oncallCount >= 2) errors.push(`${date}：当直が${oncallCount}名になっています`)
    if (nokoriCount >= 2) errors.push(`${date}：残り番が${nokoriCount}名になっています`)
    // 同一人物の重複チェック
    const seen = new Set()
    list.forEach(a => {
      if (seen.has(a.workerId)) errors.push(`${date}：同一勤務者に重複した割り当てがあります`)
      seen.add(a.workerId)
    })
  })
  return errors
}

export default function OncallMode({ currentMonth }) {
  const yearMonth = format(currentMonth, 'yyyy-MM')
  const { workers } = useWorkers()
  const [assignments, setAssignments] = useState([])
  const [kibouCodes,  setKibouCodes]  = useState([])
  const [saving, setSaving] = useState(false)
  const { toast, showToast } = useToast()

  // 対象勤務者（常勤 × 専門医/専攻医/歯科麻酔医）、グループ行付き
  const filteredWorkers = useMemo(() => filterWorkers(workers), [workers])
  const groupedRows = useMemo(() => groupByAffiliation(filteredWorkers), [filteredWorkers])

  // 月の日付リスト
  const days = useMemo(() => eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end:   endOfMonth(currentMonth),
  }), [currentMonth])

  // 当直割り当て（リアルタイム）
  useEffect(() => {
    const q = query(collection(db, 'oncallAssignments'), where('yearMonth', '==', yearMonth))
    return onSnapshot(q, snap =>
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
  }, [yearMonth])

  // 勤務・当直希望コード（dailyCodes、月全体）
  useEffect(() => {
    const firstDay = yearMonth + '-01'
    const lastDay  = format(endOfMonth(new Date(firstDay + 'T00:00:00')), 'yyyy-MM-dd')
    const q = query(
      collection(db, 'dailyCodes'),
      where('date', '>=', firstDay),
      where('date', '<=', lastDay),
    )
    return onSnapshot(q, snap =>
      setKibouCodes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
  }, [yearMonth])

  // workerId → date → assignment
  const assignmentMap = useMemo(() => {
    const m = {}
    assignments.forEach(a => {
      if (!m[a.workerId]) m[a.workerId] = {}
      m[a.workerId][a.date] = a
    })
    return m
  }, [assignments])

  // workerId → date → kibou code
  const kibouMap = useMemo(() => {
    const m = {}
    kibouCodes.forEach(c => {
      if (!m[c.workerId]) m[c.workerId] = {}
      m[c.workerId][c.date] = c.code
    })
    return m
  }, [kibouCodes])

  // バリデーションエラー（表示用）
  const errors = useMemo(() => validateAssignments(assignments), [assignments])

  const handleChange = async (workerId, workerName, ds, type) => {
    if (saving) return
    setSaving(true)
    try {
      const dayAssignments = assignments.filter(a => a.date === ds)
      const existing = dayAssignments.find(a => a.workerId === workerId)
      const others   = dayAssignments.filter(a => a.workerId !== workerId)

      if (!type) {
        if (existing) {
          await deleteDoc(doc(db, 'oncallAssignments', existing.id))
          showToast('削除しました', 'success')
        }
        return
      }

      // バリデーション（他のワーカーを基準に上限チェック）
      if (type === '当直') {
        if (others.filter(a => a.type === '当直').length >= 2) {
          showToast('当直はすでに2名登録されています', 'error'); return
        }
      }
      if (type === '残り番') {
        if (others.filter(a => a.type === '残り番').length >= 2) {
          showToast('残り番はすでに2名登録されています', 'error'); return
        }
      }

      if (existing) {
        await updateDoc(doc(db, 'oncallAssignments', existing.id), {
          type, updatedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'oncallAssignments'), {
          workerId, date: ds, yearMonth, type,
          workerName: workerName ?? '',
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        })
      }
      showToast('保存しました', 'success')
    } catch {
      showToast('保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="oncall-gantt-page">

      {/* エラーバナー */}
      {errors.length > 0 && (
        <div className="oncall-errors">
          {errors.map((e, i) => (
            <div key={i} className="oncall-error-item">⚠ {e}</div>
          ))}
        </div>
      )}

      {/* ガントチャート */}
      <div className="oncall-gantt-wrapper">
        <table className="gantt-table">
          <thead>
            <tr>
              <th className="gantt-name-cell gantt-header-cell">氏名</th>
              {days.map(day => {
                const dow   = getDay(day)
                const isSat = dow === 6
                const isSun = dow === 0
                const isHol = isHoliday(day)
                const today = isToday(day)
                return (
                  <th
                    key={format(day, 'd')}
                    className={[
                      'gantt-date-header',
                      isSat ? 'gantt-sat' : (isSun || isHol) ? 'gantt-sun' : '',
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
            {groupedRows.map((row, idx) => {
              if (row.rowType === 'header') {
                return (
                  <tr key={`header-${row.label}`} className="gantt-group-header-row">
                    <td className="gantt-group-header-cell gantt-name-cell" colSpan={days.length + 1}>
                      {row.label}
                    </td>
                  </tr>
                )
              }
              const worker = row.worker
              return (
              <tr key={worker.id} className="gantt-row">
                <td className="gantt-name-cell">{worker.name}</td>
                {days.map(day => {
                  const ds       = format(day, 'yyyy-MM-dd')
                  const dow      = getDay(day)
                  const isSat    = dow === 6
                  const isSun    = dow === 0
                  const isHol    = isHoliday(day)
                  const today    = isToday(day)
                  const disabled = isSun || isHol

                  const assignment = assignmentMap[worker.id]?.[ds]
                  const kibouCode  = kibouMap[worker.id]?.[ds]
                  const typeStyle  = assignment ? TYPE_STYLES[assignment.type] : null
                  const kibouColor = (!assignment && kibouCode) ? KIBOU_COLORS[kibouCode] : null

                  const cellBg = typeStyle?.bg
                    ?? (isSat ? '#eff6ff' : (isSun || isHol) ? '#fff5f5' : 'transparent')

                  const options = isSat ? SATURDAY_OPTIONS : WEEKDAY_OPTIONS

                  return (
                    <td
                      key={ds}
                      className={[
                        'gantt-day-cell oncall-gantt-cell',
                        today ? 'gantt-today' : '',
                      ].join(' ')}
                      style={{ background: cellBg }}
                    >
                      {/* 常時表示: 当直タイプ or 希望コード（薄表示） */}
                      <span className="oncall-cell-display">
                        {assignment ? (
                          <span style={{ color: typeStyle.color, fontWeight: 800, fontSize: '9px' }}>
                            {TYPE_STYLES[assignment.type]?.short ?? assignment.type}
                          </span>
                        ) : kibouColor ? (
                          <span style={{ color: kibouColor, opacity: 0.38, fontSize: '9px', fontWeight: 700 }}>
                            {kibouCode}
                          </span>
                        ) : null}
                      </span>

                      {/* インタラクション用セレクト（透明・フルセルカバー） */}
                      {!disabled && (
                        <select
                          className="oncall-cell-select"
                          value={assignment?.type ?? ''}
                          onChange={e => handleChange(worker.id, worker.name, ds, e.target.value)}
                          disabled={saving}
                          title={assignment?.type ?? ''}
                        >
                          {options.map(o => (
                            <option key={o} value={o}>{o || '—'}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          </tbody>
        </table>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
