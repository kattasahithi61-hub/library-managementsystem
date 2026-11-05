import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardActivity from '../components/DashboardActivity.jsx'
import DashboardStatCard from '../components/DashboardStatCard.jsx'
import useAuth from '../components/useAuth.js'
import { DashboardApiUnavailableError, fetchDashboardData } from '../services/dashboardService.js'
import { fetchMyIssues, returnBook } from '../services/issuesService.js'
import {
  createIssueNotifications,
  formatNotificationDate,
  getCurrentIssueStatus,
  getIssueDaysRemaining,
  getReadNotificationIds,
} from '../utils/issueNotifications.js'
import './Dashboard.css'

const initialDashboard = {
  stats: null,
  issuedBooks: [],
  recentActivity: [],
}

function formatCount(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat().format(value) : '—'
}

function formatFine(value, currency) {
  if (!Number.isFinite(value)) return '—'
  const formattedAmount = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value)
  return currency ? `${currency} ${formattedAmount}` : formattedAmount
}

function parseCalendarDate(value) {
  if (typeof value !== 'string' && !(value instanceof Date)) return null
  const dateOnly = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatBookDate(value) {
  const date = parseCalendarDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function getDaysRemaining(value) {
  const dueDate = parseCalendarDate(value)
  if (!dueDate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  dueDate.setHours(0, 0, 0, 0)
  return Math.round((dueDate.getTime() - today.getTime()) / 86_400_000)
}

function formatDaysRemaining(days) {
  if (days === null) return '—'
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
  if (days === 0) return 'Due today'
  return `${days} day${days === 1 ? '' : 's'} left`
}

function getBookStatus(book, daysRemaining) {
  if (daysRemaining !== null && daysRemaining < 0) return 'Overdue'
  if (daysRemaining === 0) return 'Due today'
  if (typeof book.status === 'string' && book.status.trim()) {
    return book.status[0].toUpperCase() + book.status.slice(1)
  }
  return 'Issued'
}

function DashboardLoading() {
  return (
    <div className="dashboard-loading-card" role="status">
      <span className="dashboard-loading-indicator">
        <span className="loading-spinner" aria-hidden="true" />
        Loading your library dashboard…
      </span>
    </div>
  )
}

function QuickAction({ to, label, icon }) {
  return (
    <Link className="quick-action" to={to}>
      <span className="quick-action-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <span className="quick-action-arrow" aria-hidden="true">→</span>
    </Link>
  )
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4 4" /></svg>
}

function IssueIcon() {
  return <svg viewBox="0 0 24 24"><path d="M5 5.5h11.5A2.5 2.5 0 0 1 19 8v11H7a2 2 0 0 1-2-2v-11.5Z" /><path d="M8.5 9h7M8.5 12h5" /><path d="M16 16h5m-2.5-2.5L21 16l-2.5 2.5" /></svg>
}

function ReturnIcon() {
  return <svg viewBox="0 0 24 24"><path d="M9 8H5V4" /><path d="M5.2 8a7.5 7.5 0 1 1-1 6" /><path d="m9 12 2 2 4-4" /></svg>
}

function HistoryIcon() {
  return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></svg>
}

function IssuedBooks({ books, dataUnavailable, returningId, onReturn }) {
  if (books.length === 0) {
    const message = dataUnavailable
      ? 'Issued-book information is currently unavailable.'
      : 'No books currently issued.'
    return <p className="issued-empty">{message}</p>
  }

  return (
    <div className="issued-table-wrap">
      <table className="issued-table">
        <thead>
          <tr>
            <th scope="col">BOOK</th>
            <th scope="col">ISSUED</th>
            <th scope="col">DUE DATE</th>
            <th scope="col">STATUS</th>
            <th scope="col">REMAINING</th>
            <th scope="col"><span className="visually-hidden">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {books.map((book) => {
            const daysRemaining = getDaysRemaining(book.dueDate)
            const status = getBookStatus(book, daysRemaining)
            const overdue = status.toLowerCase() === 'overdue'
            return (
              <tr key={book.id || book._id || `${book.title}-${book.issueDate}`}>
                <td className="issued-title">
                  <strong>{book.title}</strong>
                  <small>{book.author}</small>
                </td>
                <td>{formatBookDate(book.issueDate)}</td>
                <td>{formatBookDate(book.dueDate)}</td>
                <td><span className={`book-status${overdue ? ' book-status--overdue' : ''}`}>{status}</span></td>
                <td>{formatDaysRemaining(daysRemaining)}</td>
                <td>
                  <button
                    className="return-book-link"
                    type="button"
                    disabled={returningId === (book.id || book._id)}
                    onClick={() => onReturn(book)}
                  >
                    {returningId === (book.id || book._id) ? 'Returning…' : 'Return Book'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DueDateAlerts({ books }) {
  const alerts = books.flatMap((book) => {
    const daysRemaining = getDaysRemaining(book.dueDate)
    if (daysRemaining === null || daysRemaining > 3) return []
    return [{ ...book, daysRemaining }]
  })

  if (!alerts.length) return null

  return (
    <div className="dashboard-alerts" aria-label="Book due date alerts">
      {alerts.map((book) => {
        const overdue = book.daysRemaining < 0
        const message = overdue
          ? `${book.title} is overdue.`
          : book.daysRemaining === 0
            ? `${book.title} is due today.`
            : `${book.title} is due in ${book.daysRemaining} day${book.daysRemaining === 1 ? '' : 's'}.`
        return (
          <div
            className={`due-alert${overdue ? ' due-alert--overdue' : ''}`}
            key={book.id || book._id || `${book.title}-${book.dueDate}`}
            role="status"
          >
            <span className="due-alert-icon" aria-hidden="true">!</span>
            <span>{message}</span>
          </div>
        )
      })}
    </div>
  )
}

function DashboardDueBooks({ issues, unavailable }) {
  if (unavailable) return <p className="dashboard-empty-note">Due-date information is currently unavailable.</p>

  const dueIssues = issues
    .filter((issue) => {
      const daysRemaining = getIssueDaysRemaining(issue.dueDate)
      return issue.status !== 'returned' && daysRemaining !== null && daysRemaining <= 3
    })
    .sort((left, right) => new Date(left.dueDate) - new Date(right.dueDate))

  if (!dueIssues.length) return <p className="dashboard-empty-note">No books are due soon or overdue.</p>

  return (
    <ul className="dashboard-due-list">
      {dueIssues.map((issue) => {
        const status = getCurrentIssueStatus(issue)
        const days = getIssueDaysRemaining(issue.dueDate)
        const message = status === 'overdue'
          ? `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
          : days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`
        return (
          <li className={status === 'overdue' ? 'dashboard-due-item dashboard-due-item--overdue' : 'dashboard-due-item'} key={issue.id}>
            <span>
              <strong>{issue.book?.title || 'Book no longer in catalogue'}</strong>
              <small>{issue.book?.author || '—'}</small>
            </span>
            <em>{message}</em>
          </li>
        )
      })}
    </ul>
  )
}

function DashboardNotifications({ notifications, readIds, unavailable }) {
  if (unavailable) return <p className="dashboard-empty-note">Notifications are currently unavailable.</p>
  if (!notifications.length) return <p className="dashboard-empty-note">No recent notifications.</p>

  return (
    <ul className="dashboard-notification-list">
      {notifications.slice(0, 5).map((notification) => (
        <li key={notification.id}>
          <span className={`dashboard-notification-dot${readIds.has(notification.id) ? ' dashboard-notification-dot--read' : ''}`} />
          <span>
            <strong>{notification.title}</strong>
            <small>{notification.message}</small>
          </span>
          <time dateTime={notification.occurredAt}>{formatNotificationDate(notification.occurredAt)}</time>
        </li>
      ))}
    </ul>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadState, setLoadState] = useState('loading')
  const [dashboardData, setDashboardData] = useState(initialDashboard)
  const [returningId, setReturningId] = useState(null)
  const [returnError, setReturnError] = useState('')
  const [returnNotice, setReturnNotice] = useState('')
  const [myIssues, setMyIssues] = useState([])
  const [issuesLoadState, setIssuesLoadState] = useState('loading')
  const notificationStorageKey = `library-read-notifications:${user?.id || user?.registerNumber || 'account'}`
  const readNotificationIds = useMemo(
    () => new Set(getReadNotificationIds(notificationStorageKey)),
    [notificationStorageKey],
  )
  const displayName = user?.name || user?.studentName
  const registerNumber = user?.registerNumber
  const stats = dashboardData.stats
  const unavailable = loadState === 'unavailable'

  useEffect(() => {
    const controller = new AbortController()

    fetchDashboardData(controller.signal)
      .then((data) => {
        setDashboardData(data)
        setLoadState('ready')
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        if (error instanceof DashboardApiUnavailableError) {
          setDashboardData(initialDashboard)
          setLoadState('unavailable')
          return
        }
        console.error('Unable to load dashboard data.', error)
        setLoadState('error')
      })

    return () => controller.abort()
  }, [refreshKey])

  useEffect(() => {
    const controller = new AbortController()
    fetchMyIssues({ signal: controller.signal })
      .then((issues) => {
        setMyIssues(issues)
        setIssuesLoadState('ready')
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('Unable to load dashboard issue notifications.', error)
        setIssuesLoadState('error')
      })
    return () => controller.abort()
  }, [refreshKey])

  useEffect(() => {
    function refreshIssues() {
      setLoadState('loading')
      setRefreshKey((key) => key + 1)
    }
    window.addEventListener('library:issues-updated', refreshIssues)
    return () => window.removeEventListener('library:issues-updated', refreshIssues)
  }, [])

  async function handleReturn(issue) {
    setReturningId(issue.id)
    setReturnError('')
    setReturnNotice('')
    try {
      const returned = await returnBook(issue.id)
      setReturnNotice(`“${returned.book?.title || 'Book'}” was returned successfully.`)
      setLoadState('loading')
      setRefreshKey((key) => key + 1)
    } catch (error) {
      setReturnError(error.response?.data?.message || 'The book could not be returned. Please try again.')
    } finally {
      setReturningId(null)
    }
  }

  const quickActions = useMemo(() => [
    { to: '/search-books', label: 'Search Books', icon: <SearchIcon /> },
    { to: '/books', label: 'Issue a Book', icon: <IssueIcon /> },
    { to: '/return-books', label: 'Return a Book', icon: <ReturnIcon /> },
    { to: '/history', label: 'View History', icon: <HistoryIcon /> },
  ], [])

  const statCards = [
    { icon: 'books', tone: 'green', label: 'Total Books Available', value: formatCount(stats?.totalBooksAvailable), note: 'In the library collection' },
    { icon: 'issued', tone: 'blue', label: 'Currently Issued', value: formatCount(stats?.currentlyIssued), note: 'On your account' },
    { icon: 'due', tone: 'amber', label: 'Due Soon', value: formatCount(stats?.dueSoon), note: 'Due within the next few days' },
    { icon: 'returned', tone: 'green', label: 'Returned Books', value: formatCount(stats?.returnedBooks), note: 'Returned by you' },
    {
      icon: 'fine',
      tone: 'rose',
      label: 'Pending Fine',
      value: formatFine(stats?.pendingFine, stats?.currency),
      note: stats?.currency || 'Outstanding balance',
    },
  ]
  const recentNotifications = useMemo(() => createIssueNotifications(myIssues), [myIssues])

  return (
    <section className="dashboard-page">
      <header className="dashboard-welcome">
        <div className="welcome-copy">
          <p className="welcome-eyebrow">YOUR LIBRARY, AT A GLANCE</p>
          <h1>Welcome back{displayName ? `, ${displayName}` : ''}</h1>
          <p>Manage your library books and activity from here.</p>
        </div>
        <div className="welcome-register">
          <span>Register number</span>
          <strong>{registerNumber || 'Not available'}</strong>
        </div>
      </header>

      {unavailable && (
        <div className="dashboard-api-notice" role="status">
          Dashboard data is not connected yet. Statistics and activity will appear when the dashboard API is available.
        </div>
      )}
      {loadState === 'error' && (
        <div className="dashboard-error" role="alert">
          <span>Dashboard data could not be loaded. Please try again.</span>
          <button
            type="button"
            onClick={() => {
              setLoadState('loading')
              setRefreshKey((key) => key + 1)
            }}
          >
            Retry
          </button>
        </div>
      )}
      {returnNotice && <div className="dashboard-api-notice" role="status">{returnNotice}</div>}
      {returnError && <div className="dashboard-error" role="alert">{returnError}</div>}

      <DueDateAlerts books={loadState === 'ready' ? dashboardData.issuedBooks : []} />

      <section className="dashboard-section" aria-labelledby="dashboard-stats-title">
        <div className="dashboard-section-heading">
          <div>
            <h2 id="dashboard-stats-title">Library overview</h2>
            <p>Your current library account at a glance.</p>
          </div>
        </div>
        {loadState === 'loading' ? <DashboardLoading /> : (
          <div className="dashboard-stats-grid">
            {statCards.map((card) => <DashboardStatCard key={card.label} {...card} />)}
          </div>
        )}
      </section>

      <section className="dashboard-section" aria-labelledby="quick-actions-title">
        <div className="dashboard-section-heading">
          <div>
            <h2 id="quick-actions-title">Quick actions</h2>
            <p>Get to where you need to be.</p>
          </div>
        </div>
        <div className="quick-actions-grid">
          {quickActions.map((action) => <QuickAction key={action.to} {...action} />)}
        </div>
      </section>

      <div className="dashboard-section dashboard-lower-grid">
        <section className="dashboard-panel" aria-labelledby="issued-books-title">
          <header className="dashboard-panel-heading">
            <div>
              <h2 id="issued-books-title">Currently issued books</h2>
              <p>Your books and upcoming due dates.</p>
            </div>
            <Link className="dashboard-link" to="/my-books">View all <span aria-hidden="true">→</span></Link>
          </header>
          {loadState === 'loading' ? <DashboardLoading /> : (
            <IssuedBooks
              books={loadState === 'ready' ? dashboardData.issuedBooks : []}
              dataUnavailable={loadState !== 'ready'}
              returningId={returningId}
              onReturn={handleReturn}
            />
          )}
        </section>

        <section className="dashboard-panel" aria-labelledby="recent-activity-title">
          <header className="dashboard-panel-heading">
            <div>
              <h2 id="recent-activity-title">Recent activity</h2>
              <p>Your latest library account updates.</p>
            </div>
            <Link className="dashboard-link" to="/history">History <span aria-hidden="true">→</span></Link>
          </header>
          {loadState === 'loading' ? <DashboardLoading /> : (
            <DashboardActivity
              activities={loadState === 'ready' ? dashboardData.recentActivity : []}
              unavailable={loadState !== 'ready'}
            />
          )}
        </section>
      </div>

      <div className="dashboard-section dashboard-lower-grid">
        <section className="dashboard-panel" aria-labelledby="due-books-title">
          <header className="dashboard-panel-heading">
            <div>
              <h2 id="due-books-title">Due soon &amp; overdue</h2>
              <p>Books that need your attention.</p>
            </div>
            <Link className="dashboard-link" to="/my-books">My books <span aria-hidden="true">→</span></Link>
          </header>
          <DashboardDueBooks issues={myIssues} unavailable={issuesLoadState !== 'ready'} />
        </section>

        <section className="dashboard-panel" aria-labelledby="dashboard-notifications-title">
          <header className="dashboard-panel-heading">
            <div>
              <h2 id="dashboard-notifications-title">Recent notifications</h2>
              <p>Issue, return, due-date, and fine updates.</p>
            </div>
            <Link className="dashboard-link" to="/notifications">View all <span aria-hidden="true">→</span></Link>
          </header>
          <DashboardNotifications
            notifications={recentNotifications}
            readIds={readNotificationIds}
            unavailable={issuesLoadState !== 'ready'}
          />
        </section>
      </div>
    </section>
  )
}

export default Dashboard
