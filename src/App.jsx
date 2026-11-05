import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './components/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Books from './pages/Books.jsx'
import AdminBooks from './pages/AdminBooks.jsx'
import AdminStudents from './pages/AdminStudents.jsx'
import AdminIssues from './pages/AdminIssues.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import { AuthLayout, ForgotPasswordPage, LoginPage, RegisterPage } from './pages/AuthPages.jsx'
import MyBooks from './pages/MyBooks.jsx'
import Notifications from './pages/Notifications.jsx'
import Profile from './pages/Profile.jsx'
import ReturnBooks from './pages/ReturnBooks.jsx'
import SearchBooks from './pages/SearchBooks.jsx'
import Settings from './pages/Settings.jsx'

function PublicAuthRoute({ children }) {
  return <AuthLayout>{children}</AuthLayout>
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicAuthRoute><LoginPage /></PublicAuthRoute>} />
          <Route path="/register" element={<PublicAuthRoute><RegisterPage /></PublicAuthRoute>} />
          <Route path="/forgot-password" element={<PublicAuthRoute><ForgotPasswordPage /></PublicAuthRoute>} />
          <Route
            path="/change-password"
            element={<ProtectedRoute><PublicAuthRoute><ForgotPasswordPage /></PublicAuthRoute></ProtectedRoute>}
          />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/books" element={<Books />} />
            <Route path="/search-books" element={<SearchBooks />} />
            <Route path="/search" element={<Navigate to="/search-books" replace />} />
            <Route path="/my-books" element={<MyBooks />} />
            <Route path="/return-books" element={<ReturnBooks />} />
            <Route path="/history" element={<History />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route
            path="/admin/books"
            element={<AdminRoute><Layout><AdminBooks /></Layout></AdminRoute>}
          />
          <Route
            path="/admin/students"
            element={<AdminRoute><Layout><AdminStudents /></Layout></AdminRoute>}
          />
          <Route
            path="/admin/issues"
            element={<AdminRoute><Layout><AdminIssues /></Layout></AdminRoute>}
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
