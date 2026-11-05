import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../components/useAuth.js'
import { fetchMyIssues } from '../services/issuesService.js'
import {
  createIssueNotifications,
  formatNotificationDate,
  getReadNotificationIds,
  saveReadNotificationIds,
} from '../utils/issueNotifications.js'
import './Notifications.css'

function Notifications() {
  const { user } = useAuth()
  const storageKey = `library-read-notifications:${user?.id || user?.registerNumber || 'account'}`
  const [issues, setIssues] = useState([])
  const [readIds, setReadIds] = useState(() => new Set(getReadNotificationIds(storageKey)))
  const [loadState, setLoadState] = useState('loading')
  const [retryKey, setRetryKey] = useState(0)
  const notifications = useMemo(() => createIssueNotifications(issues), [issues])
  const unreadCount = notifications.filter((notification) => !readIds.has(notification.id)).length

  useEffect(() => {
    saveReadNotificationIds(storageKey, [...readIds])
  }, [readIds, storageKey])

  useEffect(() => {
    const controller = new AbortController()
    fetchMyIssues({ signal: controller.signal })
      .then((result) => {
        setIssues(result)
        setLoadState('ready')
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('Unable to load student notifications.', error)
        setLoadState('error')
      })
    return () => controller.abort()
  }, [retryKey])

  useEffect(() => {
    function refreshNotifications() {
      setLoadState('loading')
      setRetryKey((current) => current + 1)
    }
    window.addEventListener('library:issues-updated', refreshNotifications)
    return () => window.removeEventListener('library:issues-updated', refreshNotifications)
  }, [])

  const markRead = useCallback((id) => {
    setReadIds((current) => new Set(current).add(id))
  }, [])

  function markAllRead() {
    setReadIds((current) => new Set([...current, ...notifications.map((notification) => notification.id)]))
  }

  return (
    <section className="notifications-page">
      <header className="notifications-header">
        <div>
          <p>YOUR LIBRARY ACCOUNT</p>
          <h1>Notifications</h1>
          <span>Updates about your books, due dates, and fines.</span>
        </div>
        {loadState === 'ready' && unreadCount > 0 && (
          <button className="notifications-mark-all" type="button" onClick={markAllRead}>
            Mark all as read
          </button>
        )}
      </header>

      {loadState === 'loading' && <div className="notifications-state" role="status">Loading your notifications…</div>}
      {loadState === 'error' && (
        <div className="notifications-state notifications-state--error" role="alert">
          <strong>Notifications could not be loaded.</strong>
          <span>Your account updates are unavailable right now.</span>
          <button type="button" onClick={() => {
            setLoadState('loading')
            setRetryKey((current) => current + 1)
          }}>Try again</button>
        </div>
      )}
      {loadState === 'ready' && notifications.length === 0 && (
        <div className="notifications-state">
          <strong>You’re all caught up</strong>
          <span>Book issues, returns, due-date reminders, and fines will appear here.</span>
          <Link to="/books">Browse available books</Link>
        </div>
      )}
      {loadState === 'ready' && notifications.length > 0 && (
        <ul className="notifications-list">
          {notifications.map((notification) => {
            const isRead = readIds.has(notification.id)
            return (
              <li
                className={`notification-item notification-item--${notification.type}${isRead ? ' notification-item--read' : ''}`}
                key={notification.id}
              >
                <span className="notification-unread-dot" aria-label={isRead ? 'Read' : 'Unread'} />
                <span className="notification-icon" aria-hidden="true">
                  {notification.type === 'returned' ? '↙'
                    : notification.type === 'due' ? '◷'
                      : notification.type === 'overdue' ? '!'
                        : notification.type === 'fine' ? '₹' : '↗'}
                </span>
                <span className="notification-copy">
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <time dateTime={notification.occurredAt}>{formatNotificationDate(notification.occurredAt)}</time>
                </span>
                <Link className="notification-book-link" to="/history">History</Link>
                {!isRead && (
                  <button type="button" onClick={() => markRead(notification.id)}>
                    Mark as read
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {loadState === 'ready' && notifications.length > 0 && unreadCount === 0 && (
        <p className="notifications-all-read" role="status">All notifications are marked as read.</p>
      )}
    </section>
  )
}

export default Notifications
