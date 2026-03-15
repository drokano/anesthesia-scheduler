import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/table',     icon: '📋', label: '人事表' },
  { path: '/shift',     icon: '✏️', label: 'シフト入力' },
  { path: '/workers',   icon: '👤', label: '勤務者管理' },
  { path: '/hospitals', icon: '🏥', label: '外勤先一覧' },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ path, icon, label }) => (
        <Link
          key={path}
          to={path}
          className={`bottom-nav__item ${location.pathname === path ? 'active' : ''}`}
        >
          <span className="bottom-nav__icon">{icon}</span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
