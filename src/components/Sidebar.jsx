import { NavLink, useNavigate } from 'react-router-dom'
import useAuth from './useAuth.js'
import './Sidebar.css'

const menuItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '⌂' },
  { to: '/books', label: 'Books', icon: '▤' },
  { to: '/search-books', label: 'Search Books', icon: '⌕' },
  { to: '/my-books', label: 'My Issued Books', icon: '▣' },
  { to: '/return-books', label: 'Return Books', icon: '↩' },
  { to: '/history', label: 'Issue/Return History', icon: '◷' },
  { to: '/profile', label: 'My Profile', icon: '♙' },
  { to: '/notifications', label: 'Notifications', icon: '♧' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

function Sidebar({ open, onNavigate }) {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const visibleMenuItems = user?.role === 'admin'
    ? [
      ...menuItems,
      { to: '/admin/books', label: 'Manage Books', icon: '▥' },
      { to: '/admin/students', label: 'Manage Students', icon: '♙' },
      { to: '/admin/issues', label: 'Manage Issues', icon: '◷' },
    ]
    : menuItems

  function handleLogout() {
    signOut()
    navigate('/login', { replace: true })
    onNavigate()
  }

  return (
    <>
      {open && <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={onNavigate} />}
      <aside className={`app-sidebar ${open ? 'app-sidebar--open' : ''}`} aria-label="Main navigation">
        <p className="sidebar-label">LIBRARY MENU</p>
        <nav className="sidebar-nav">
          {visibleMenuItems.map((item) => (
            <NavLink
              className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link--active' : ''}`}
              key={item.to}
              to={item.to}
              onClick={onNavigate}
            >
              <span className="sidebar-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="help-mark" aria-hidden="true">i</span>
            <span><strong>Need a hand?</strong><small>Library support is here.</small></span>
          </div>
          <button className="sidebar-logout" type="button" onClick={handleLogout}>
            <span className="sidebar-icon" aria-hidden="true">↪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
