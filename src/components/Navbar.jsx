import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from './useAuth.js'
import './Navbar.css'

function BookLogo() {
  return (
    <span className="app-logo-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M5 8.5c4.2-1.6 7.8-.9 11 1.8v14c-3.2-2.7-6.8-3.4-11-1.8v-14Z" />
        <path d="M27 8.5c-4.2-1.6-7.8-.9-11 1.8v14c3.2-2.7 6.8-3.4 11-1.8v-14Z" />
        <path d="M16 10v14" />
      </svg>
    </span>
  )
}

function Navbar({ onMenuClick }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const displayName = user?.name || user?.registerNumber || 'Student account'

  function handleLogout() {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="app-navbar">
      <div className="navbar-brand-area">
        <button className="mobile-menu-button" type="button" onClick={onMenuClick} aria-label="Open navigation menu">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <Link className="app-brand" to="/dashboard" aria-label="Library Management System dashboard">
          <BookLogo />
          <span>
            <strong>Library Management System</strong>
            <small>STUDENT PORTAL</small>
          </span>
        </Link>
      </div>

      <div className="navbar-actions">
        <Link className="navbar-icon-button" to="/notifications" aria-label="Notifications">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
          </svg>
          <span className="notification-indicator" />
        </Link>
        <div className="profile-menu-wrap">
          <button
            className="profile-trigger"
            type="button"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((open) => !open)}
          >
            <span className="profile-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>
            </span>
            <span className="profile-label">{displayName}</span>
            <svg className="profile-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
          </button>
          {profileOpen && (
            <div className="profile-dropdown">
              <Link to="/profile" onClick={() => setProfileOpen(false)}>My profile</Link>
              <button type="button" onClick={handleLogout}>Log out</button>
            </div>
          )}
        </div>
        <button className="navbar-logout" type="button" onClick={handleLogout}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 3H4v14h4M12 6l4 4-4 4M7 10h9" /></svg>
          <span>Log out</span>
        </button>
      </div>
    </header>
  )
}

export default Navbar
