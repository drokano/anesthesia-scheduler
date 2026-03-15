import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/shift',     label: '詳細設定' },
  { to: '/calendar',  label: '勤務一覧' },
  { to: '/table',     label: '人事表' },
  { to: '/workers',   label: '勤務者登録' },
  { to: '/hospitals', label: '外勤先登録' },
]

export default function Header() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const h = Math.round(el.getBoundingClientRect().height)
      document.documentElement.style.setProperty('--header-h', h + 'px')
      console.log('[Header] height =', h, 'px  --header-h updated')
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <header className="header" ref={ref}>
      <div className="header__top">
        <div className="header__title">東京女子医科大学麻酔科スケジュール</div>
      </div>
      <nav className="header__nav">
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `header__nav-item${isActive ? ' active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
