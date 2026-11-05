import { useEffect, useState } from 'react'
import { fetchAdminIssue, fetchAdminIssues } from '../services/adminIssuesService.js'
import './AdminIssues.css'

const filters = [
  ['all', 'All'],
  ['issued', 'Issued'],
  ['returned', 'Returned'],
  ['overdue', 'Overdue'],
]

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function IssueDetails({ issue, onClose }) {
  if (!issue) return null

  return (
    <div className="admin-issues-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section
        className="admin-issues-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-issue-details-title"
      >
        <button className="admin-issues-dialog-close" type="button" onClick={onClose} aria-label="Close issue details">×</button>
        <p>LIBRARY ISSUE RECORD</p>
        <h2 id="admin-issue-details-title">{issue.book?.title || 'Book record unavailable'}</h2>
        <span className="admin-issues-dialog-subtitle">{issue.book?.author || '—'} · ISBN {issue.book?.isbn || '—'}</span>

        <div className="admin-issues-detail-section">
          <h3>Student</h3>
          <dl className="admin-issues-detail-grid">
            <div><dt>Name</dt><dd>{issue.student?.name || 'Student record unavailable'}</dd></div>
            <div><dt>Register number</dt><dd>{issue.student?.registerNumber || '—'}</dd></div>
            <div><dt>Phone</dt><dd>{issue.student?.phone || '—'}</dd></div>
            <div><dt>Department / year</dt><dd>{issue.student ? `${issue.student.department || '—'} · ${issue.student.year || '—'}` : '—'}</dd></div>
          </dl>
        </div>

        <div className="admin-issues-detail-section">
          <h3>Book</h3>
          <dl className="admin-issues-detail-grid">
            <div><dt>Title</dt><dd>{issue.book?.title || '—'}</dd></div>
            <div><dt>Author</dt><dd>{issue.book?.author || '—'}</dd></div>
            <div><dt>Category</dt><dd>{issue.book?.category || '—'}</dd></div>
            <div><dt>Publisher</dt><dd>{issue.book?.publisher || '—'}</dd></div>
          </dl>
        </div>

        <div className="admin-issues-detail-section">
          <h3>Issue summary</h3>
          <dl className="admin-issues-detail-grid">
            <div><dt>Issue date</dt><dd>{formatDate(issue.issueDate)}</dd></div>
            <div><dt>Due date</dt><dd>{formatDate(issue.dueDate)}</dd></div>
            <div><dt>Return date</dt><dd>{formatDate(issue.returnDate)}</dd></div>
            <div><dt>Status</dt><dd><span className={`admin-issue-status admin-issue-status--${issue.status}`}>{statusLabel(issue.status)}</span></dd></div>
            <div><dt>Fine</dt><dd>₹{issue.fine}</dd></div>
          </dl>
        </div>
        <p className="admin-issues-readonly-note">Issue records are read-only here. Issue, return, inventory, and fine rules remain managed by the student library workflow.</p>
      </section>
    </div>
  )
}

function AdminIssues() {
  const [issues, setIssues] = useState([])
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [loadState, setLoadState] = useState('loading')
  const [retryKey, setRetryKey] = useState(0)
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [detailsError, setDetailsError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoadState('loading')
      fetchAdminIssues({ search, status, signal: controller.signal })
        .then((result) => {
          setIssues(result)
          setLoadState('ready')
        })
        .catch((error) => {
          if (controller.signal.aborted) return
          console.error('Unable to load admin issue records.', error)
          setLoadState(error.response?.status === 403 ? 'forbidden' : 'error')
        })
    }, search.trim() ? 250 : 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search, status, retryKey])

  async function openDetails(issue) {
    setDetailsError('')
    setSelectedIssue({ loading: true })
    try {
      setSelectedIssue(await fetchAdminIssue(issue.id))
    } catch (error) {
      console.error('Unable to load admin issue details.', error)
      setSelectedIssue(null)
      setDetailsError(error.response?.data?.message || 'Issue details could not be loaded.')
    }
  }

  let content
  if (loadState === 'loading') {
    content = <div className="admin-issues-state" role="status"><strong>Loading issue records</strong><span>Retrieving real issue and return activity.</span></div>
  } else if (loadState === 'forbidden') {
    content = <div className="admin-issues-state" role="alert"><strong>Administrator access required</strong><span>Your account is not authorized to view issue records.</span></div>
  } else if (loadState === 'error') {
    content = (
      <div className="admin-issues-state" role="alert">
        <strong>Issue records could not be loaded</strong>
        <span>Check your connection and administrator access, then try again.</span>
        <button type="button" onClick={() => {
          setLoadState('loading')
          setRetryKey((current) => current + 1)
        }}>Try again</button>
      </div>
    )
  } else if (issues.length === 0) {
    const hasFilters = search.trim() || status !== 'all'
    content = (
      <div className="admin-issues-state" role="status">
        <strong>{hasFilters ? 'No issue records match your filters' : 'No issue records yet'}</strong>
        <span>{hasFilters ? 'Try another search or choose a different status.' : 'Book issues and returns will appear here when recorded.'}</span>
      </div>
    )
  } else {
    content = (
      <div className="admin-issues-table-wrap">
        <table className="admin-issues-table">
          <thead>
            <tr>
              <th scope="col">STUDENT</th>
              <th scope="col">BOOK</th>
              <th scope="col">ISSUED</th>
              <th scope="col">DUE</th>
              <th scope="col">RETURNED</th>
              <th scope="col">STATUS</th>
              <th scope="col">FINE</th>
              <th scope="col">DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={issue.id}>
                <td className="admin-issue-person">
                  <strong>{issue.student?.name || 'Student record unavailable'}</strong>
                  <small>{issue.student?.registerNumber || '—'}</small>
                </td>
                <td className="admin-issue-book">
                  <strong>{issue.book?.title || 'Book record unavailable'}</strong>
                  <small>{issue.book?.author || '—'}{issue.book?.isbn ? ` · ${issue.book.isbn}` : ''}</small>
                </td>
                <td>{formatDate(issue.issueDate)}</td>
                <td>{formatDate(issue.dueDate)}</td>
                <td>{formatDate(issue.returnDate)}</td>
                <td><span className={`admin-issue-status admin-issue-status--${issue.status}`}>{statusLabel(issue.status)}</span></td>
                <td>₹{issue.fine}</td>
                <td><button className="admin-issue-details-button" type="button" onClick={() => openDetails(issue)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <section className="admin-issues-page">
      <header className="admin-issues-header">
        <div>
          <p>LIBRARY ADMINISTRATION</p>
          <h1>Manage Issues</h1>
          <span>Review real book issue, due, and return records.</span>
        </div>
      </header>

      <div className="admin-issues-toolbar">
        <label className="admin-issues-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student, register number, book, or ISBN"
            aria-label="Search issue records"
          />
        </label>
      </div>

      <nav className="admin-issues-filters" aria-label="Filter issue records">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`admin-issues-filter${status === value ? ' admin-issues-filter--active' : ''}`}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {detailsError && <p className="admin-issues-feedback" role="alert">{detailsError}</p>}
      <p className="admin-issues-count">{loadState === 'ready' ? `${issues.length} issue record${issues.length === 1 ? '' : 's'}${search.trim() || status !== 'all' ? ' found' : ''}` : ' '}</p>
      <div className="admin-issues-panel">{content}</div>

      {selectedIssue && (
        selectedIssue.loading
          ? <div className="admin-issues-dialog-backdrop"><div className="admin-issues-state" role="status">Loading issue details…</div></div>
          : <IssueDetails issue={selectedIssue} onClose={() => setSelectedIssue(null)} />
      )}
    </section>
  )
}

export default AdminIssues
