import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'

// 特定日の全データを取得（人事表用）
export function usePersonnelData(dateStr) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!dateStr) return
    setLoading(true)
    setError(null)
    try {
      // 前日の文字列（明け判定用）
      const d = new Date(dateStr + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      const prevDay = d.toISOString().slice(0, 10)

      const [workersSnap, shiftsSnap, leavesSnap, outsideSnap, absencesSnap, oncallSnap, oncallPrevSnap] = await Promise.all([
        getDocs(query(collection(db, 'workers'), orderBy('nameKana'))),
        getDocs(query(collection(db, 'shifts'), where('date', '==', dateStr))),
        getDocs(query(collection(db, 'leaves'), where('date', '==', dateStr))),
        getDocs(query(collection(db, 'outsideWork'), where('date', '==', dateStr))),
        getDocs(query(collection(db, 'absences'), where('date', '==', dateStr))),
        getDocs(query(collection(db, 'oncallAssignments'), where('date', '==', dateStr))),
        getDocs(query(collection(db, 'oncallAssignments'), where('date', '==', prevDay))),
      ])

      const workers  = workersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const shifts   = shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const leaves   = leavesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const outside  = outsideSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const absences = absencesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const oncall     = oncallSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const oncallPrev = oncallPrevSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      // workerごとにデータをまとめる
      const merged = workers.map(worker => ({
        worker,
        shift:      shifts.find(s => s.workerId === worker.id) ?? null,
        leave:      leaves.find(l => l.workerId === worker.id) ?? null,
        outside:    outside.find(o => o.workerId === worker.id) ?? null,
        absences:   absences.filter(a => a.workerId === worker.id),
        oncall:     oncall.find(o => o.workerId === worker.id) ?? null,
        oncallPrev: oncallPrev.find(o => o.workerId === worker.id) ?? null,
      }))

      setData(merged)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [dateStr])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { data, loading, error, refetch: fetchAll }
}

// 勤務者一覧（refetch対応）
export function useWorkers() {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'workers'), orderBy('nameKana')))
      setWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { workers, loading, refetch: fetch }
}

// 勤務者 CRUD
export async function addWorker(data) {
  return addDoc(collection(db, 'workers'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateWorker(id, data) {
  return updateDoc(doc(db, 'workers', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteWorker(id) {
  return deleteDoc(doc(db, 'workers', id))
}

// 汎用: ドキュメント追加
export async function addDocument(collectionName, data) {
  return addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// 汎用: ドキュメント更新
export async function updateDocument(collectionName, id, data) {
  return updateDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

// 汎用: ドキュメント削除
export async function deleteDocument(collectionName, id) {
  return deleteDoc(doc(db, collectionName, id))
}

// 特定ワーカーの月間データ（カレンダー表示用・リアルタイム）
// workerId のみで絞り込み、日付はクライアント側でフィルタ（複合インデックス不要）
export function useWorkerMonthData(workerId, yearMonth) {
  const [data, setData] = useState({ shifts: [], leaves: [], outsideWork: [], absences: [], codes: [] })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!workerId || !yearMonth) {
      setData({ shifts: [], leaves: [], outsideWork: [], absences: [], codes: [] })
      return
    }
    setLoading(true)

    const byMonth = (docs) =>
      docs.filter(r => r.date && r.date.startsWith(yearMonth))

    // 5つのリスナーが全て初回イベントを返したらローディング解除
    let initialCount = 0
    const TOTAL = 5
    const checkInitial = () => {
      initialCount++
      if (initialCount >= TOTAL) setLoading(false)
    }

    const make = (key, collName) =>
      onSnapshot(
        query(collection(db, collName), where('workerId', '==', workerId)),
        (snap) => {
          const items = byMonth(snap.docs.map(d => ({ id: d.id, ...d.data() })))
          setData(prev => ({ ...prev, [key]: items }))
          checkInitial()
        },
        (err) => { console.error(err); checkInitial() },
      )

    const unsubs = [
      make('shifts',      'shifts'),
      make('leaves',      'leaves'),
      make('outsideWork', 'outsideWork'),
      make('absences',    'absences'),
      make('codes',       'dailyCodes'),
    ]

    return () => unsubs.forEach(u => u())
  }, [workerId, yearMonth])

  // onSnapshot でリアルタイム更新されるため refetch は no-op
  return { data, loading, refetch: () => {} }
}

// 特定ワーカーの当月当直データ（リアルタイム）
export function useWorkerOncallData(workerId, yearMonth) {
  const [oncall, setOncall] = useState([])
  useEffect(() => {
    if (!workerId || !yearMonth) { setOncall([]); return }
    const q = query(
      collection(db, 'oncallAssignments'),
      where('workerId', '==', workerId),
    )
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setOncall(all.filter(r => r.yearMonth === yearMonth))
    })
    return () => unsub()
  }, [workerId, yearMonth])
  return oncall
}

// 日次コードの保存（upsert）・削除
export async function saveCode(workerId, date, code) {
  const existing = await findExistingRecord('dailyCodes', workerId, date)
  if (!code) {
    if (existing) await deleteDoc(doc(db, 'dailyCodes', existing.id))
    return
  }
  if (existing) {
    await updateDoc(doc(db, 'dailyCodes', existing.id), { code, updatedAt: serverTimestamp() })
  } else {
    await addDoc(collection(db, 'dailyCodes'), { workerId, date, code, createdAt: serverTimestamp() })
  }
}

// 特定ワーカーの既存シフトを検索
export async function findExistingRecord(collectionName, workerId, date) {
  const snap = await getDocs(
    query(
      collection(db, collectionName),
      where('workerId', '==', workerId),
      where('date', '==', date),
    )
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}
