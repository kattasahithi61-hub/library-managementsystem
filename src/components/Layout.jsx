import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import Sidebar from './Sidebar.jsx'
import './Layout.css'

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="library-app">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="app-body">
        <Sidebar open={sidebarOpen} onNavigate={closeSidebar} />
        <div className="app-main-column">
          <main className="app-main-content">{children || <Outlet />}</main>
          <footer className="app-footer">
            <span>Library Management System</span>
            <span>Supporting your learning, every day.</span>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default Layout
