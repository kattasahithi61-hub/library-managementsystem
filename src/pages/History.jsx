import { useEffect, useMemo, useState } from 'react'
import BookCover from '../components/BookCover.jsx'
import { fetchMyIssues } from '../services/issuesService.js'
import { getCurrentIssueStatus } from '../utils/issueNotifications.js'
import './History.css'

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Issued', value: 'issued' },
  { label: 'Returned', value: 'returned' },
  { label: 'Overdue', value: 'overdue' },
]

function formatDate(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

function History() {
  const [issues, setIssues] = useState([])
  const [filter, setFilter] = useState('all')
  const [loadState, setLoadState] = useState('loading')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchMyIssues({ signal: controller.signal })
      .then((result) => {
        setIssues(result)
        setLoadState('ready')
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('Unable to load student book history.', error)
        setLoadState('error')
      })
    return () => controller.abort()
  }, [retryKey])

  useEffect(() => {
    function refreshHistory() {
      setLoadState('loading')
      setRetryKey((current) => current + 1)
    }
    window.addEventListener('library:issues-updated', refreshHistory)
    return () => window.removeEventListener('library:issues-updated', refreshHistory)
  }, [])

  const filteredIssues = useMemo(() => issues.filter((issue) => (
    filter === 'all' || getCurrentIssueStatus(issue) === filter
  )), [filter, issues])

  return (
    <section className="history-page">
      <header className="history-header">
        <p>YOUR LIBRARY ACCOUNT</p>
        <h1>Issue &amp; Return History</h1>
        <span>Review your book activity and return records.</span>
      </header>

      <nav className="history-filters" aria-label="Filter book history">
        {filters.map((item) => (
          <button
            type="button"
            key={item.value}
            className={filter === item.value ? 'history-filter history-filter--active' : 'history-filter'}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
            {loadState === 'ready' && (
              <span>{item.value === 'all'
                ? issues.length
                : issues.filter((issue) => getCurrentIssueStatus(issue) === item.value).length}</span>
            )}
          </button>
        ))}
      </nav>

      {loadState === 'loading' && <div className="history-state" role="status">Loading your book history…</div>}
      {loadState === 'error' && (
        <div className="history-state history-state--error" role="alert">
          <strong>History could not be loaded.</strong>
          <span>Your account history is unavailable right now.</span>
          <button type="button" onClick={() => {
            setLoadState('loading')
            setRetryKey((current) => current + 1)
          }}>Try again</button>
        </div>
      )}
      {loadState === 'ready' && filteredIssues.length === 0 && (
        <div className="history-state">
          <strong>{issues.length === 0 ? 'No book activity yet' : `No ${filter} records`}</strong>
          <span>{issues.length === 0
            ? 'Books you issue or return will appear here.'
            : 'Try another history filter to see your book activity.'}</span>
        </div>
      )}
      {loadState === 'ready' && filteredIssues.length > 0 && (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th scope="col">BOOK</th>
                <th scope="col">ISSUED</th>
                <th scope="col">DUE</th>
                <th scope="col">RETURNED</th>
                <th scope="col">STATUS</th>
                <th scope="col">FINE</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((issue) => {
                const status = getCurrentIssueStatus(issue)
                return (
                  <tr key={issue.id}>
                    <td className="history-book">
                      <BookCover
                        book={issue.book || { title: 'Book no longer in catalogue' }}
                        className="history-book-cover"
                      />
                      <span>
                        <strong>{issue.book?.title || 'Book no longer in catalogue'}</strong>
                        <small>{issue.book?.author || '—'}</small>
                      </span>
                    </td>
                    <td>{formatDate(issue.issueDate)}</td>
                    <td>{formatDate(issue.dueDate)}</td>
                    <td>{formatDate(issue.returnDate)}</td>
                    <td><span className={`history-status history-status--${status}`}>{status}</span></td>
                    <td>₹{Number.isFinite(issue.fine) ? issue.fine : 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default History
