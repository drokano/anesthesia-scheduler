import { useState, useMemo, useEffect } from 'react'
import {
  format, getDay, isToday, isSameMonth,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
} from 'date-fns'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useToast } from '../../hooks/useToast'
import Toast from '../common/Toast'

const toDateStr = (d) => format(d, 'yyyy-MM-dd')
const WEEKDAYS  = ['日', '月', '火', '水', '木', '金', '土']

function useOutsideMonth(yearMonth) {
  const [data, setData] = useState([])
  useEffect(() => {
    if (!yearMonth) return
    const q = query(collection(db, 'outsideAssignments'), where('yearMonth', '==', yearMonth))
    const unsub = onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [yearMonth])
  return data
}

export function useHospitals() {
  const [hospitals, setHospitals] = useState([])
  const [loading, setLoading]     = useState(true)
  useEffect(() => {
    const q = query(collection(db, 'hospitals'), orderBy('name'))
    const unsub = onSnapshot(q, snap => {
      setHospitals(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])
  return { hospitals, loading }
}

async function saveOutside(workerId, date, hospitalId, hospitalName, allAssignments, workerName) {
  const yearMonth = date.substring(0, 7)
  const existing = allAssignments.find(a => a.workerId === workerId && a.date === date)
  if (existing) {
    await updateDoc(doc(db, 'outsideAssignments', existing.id), {
      hospitalId, hospitalName, updatedAt: serverTimestamp(),
    })
  } else {
    await addDoc(collection(db, 'outsideAssignments'), {
      workerId, date, yearMonth, hospitalId, hospitalName,
      workerName: workerName ?? '',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
  }
}

async function deleteOutside(workerId, date, allAssignments) {
  const existing = allAssignments.find(a => a.workerId === workerId && a.date === date)
  if (existing) await deleteDoc(doc(db, 'outsideAssignments', existing.id))
}

export default function OutsideMode({ workerId, workerName, currentMonth }) {
  const yearMonth    = format(currentMonth, 'yyyy-MM')
  const assignments  = useOutsideMonth(yearMonth)
  const { hospitals } = useHospitals()
  const [saving, setSaving] = useState(false)
  const { toast, showToast } = useToast()

  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const myMap = useMemo(() => {
    const m = {}
    assignments.filter(a => a.workerId === workerId).forEach(a => { m[a.date] = a })
    return m
  }, [assignments, workerId])

  const handleChange = async (date, hospitalId) => {
    if (!workerId || saving) return
    setSaving(true)
    try {
      const ds = toDateStr(date)
      if (!hospitalId) {
        await deleteOutside(workerId, ds, assignments)
        showToast('削除しました', 'success')
      } else {
        const hospital = hospitals.find(h => h.id === hospitalId)
        await saveOutside(workerId, ds, hospitalId, hospital?.name ?? '', assignments, workerName)
        showToast('保存しました', 'success')
      }
    } catch {
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
            const myA     = myMap[ds]
            const cellBg  = myA ? '#eff6ff' : isSat ? '#eff6ff' : isSun ? '#fff5f5' : 'var(--surface)'

            return (
              <div
                key={ds}
                className={[
                  'calendar-day', 'calendar-day--outside',
                  !inMonth ? 'cal-other-month' : '',
                  today    ? 'cal-today' : '',
                ].join(' ')}
                style={{ background: cellBg }}
              >
                <span className={`cal-num ${isSat ? 'cal-sat-num' : isSun ? 'cal-sun-num' : ''}`}>
                  {format(date, 'd')}
                </span>
                <select
                  className="outside-select"
                  value={myA?.hospitalId ?? ''}
                  onChange={e => inMonth && handleChange(date, e.target.value)}
                  disabled={!inMonth || saving}
                  style={myA ? { color: '#2563eb', fontWeight: 700 } : {}}
                >
                  <option value="">－</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
