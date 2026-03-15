import { useEffect, useRef } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Header from './components/Layout/Header'
import PersonnelTablePage from './pages/PersonnelTablePage'
import ShiftInputPage from './pages/ShiftInputPage'
import WorkersPage    from './pages/WorkersPage'
import HospitalsPage  from './pages/HospitalsPage'
import CalendarListPage from './pages/CalendarListPage'

// タブ切替時に page-content のスクロール位置を先頭にリセット
function ScrollReset({ containerRef }) {
  const { pathname } = useLocation()
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function App() {
  const pageRef = useRef(null)

  useEffect(() => {
    const page = pageRef.current
    if (!page) return
    const rect = page.getBoundingClientRect()
    const cs   = getComputedStyle(page)
    console.log('[page-content] top:', rect.top, '  height:', rect.height, '  viewport:', window.innerHeight)
    console.log('[page-content] position:', cs.position, '  overflowY:', cs.overflowY)
    console.log('[window] scrollY:', window.scrollY, '  ← should be 0 always')
    // ユーザー検証コード
    document.querySelectorAll('main, .main-content, .page-content').forEach(el => {
      const r = el.getBoundingClientRect()
      console.log(el.className, 'top:', r.top, 'paddingTop:', getComputedStyle(el).paddingTop)
    })
  }, [])

  return (
    <HashRouter>
      <div className="app-layout">
        <Header />
        <main className="page-content" ref={pageRef}>
          <ScrollReset containerRef={pageRef} />
          <Routes>
            <Route path="/" element={<Navigate to="/table" replace />} />
            <Route path="/table"     element={<PersonnelTablePage />} />
            <Route path="/shift"     element={<ShiftInputPage />} />
            <Route path="/workers"   element={<WorkersPage />} />
            <Route path="/hospitals" element={<HospitalsPage />} />
            <Route path="/calendar"  element={<CalendarListPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
