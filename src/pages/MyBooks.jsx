import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BookCover from '../components/BookCover.jsx'
import { fetchMyIssues, returnBook } from '../services/issuesService.js'
import './MyBooks.css'

function formatDate(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

function getDaysRemaining(value) {
  const due = new Date(value)
  if (!value || Number.isNaN(due.getTime())) return null
  const today = new Date()
  const utcDay = (date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.floor((utcDay(due) - utcDay(today)) / 86_400_000)
}

function daysLabel(days) {
  if (days === null) return '—'
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
  if (days === 0) return 'Due today'
  return `${days} day${days === 1 ? '' : 's'} left`
}

function MyBooks({ returnOnly = false }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [issues, setIssues] = useState([])
  const [loadState, setLoadState] = useState('loading')
  const [retryKey, setRetryKey] = useState(0)
  const [returningId, setReturningId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(() => location.state?.issueNotice || '')

  useEffect(() => {
    if (location.state?.issueNotice) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    const controller = new AbortController()
    fetchMyIssues({ signal: controller.signal })
      .then((result) => {
        setIssues(result)
        setLoadState('ready')
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return
        console.error('Unable to load the student issue list.', requestError)
        setLoadState('error')
      })
    return () => controller.abort()
  }, [retryKey])

  const activeIssues = useMemo(() => issues.filter((issue) => ['issued', 'overdue'].includes(issue.status)), [issues])
  const returnedIssues = useMemo(() => issues.filter((issue) => issue.status === 'returned'), [issues])

  async function handleReturn(issue) {
    setReturningId(issue.id)
    setError('')
    setNotice('')
    try {
      const returned = await returnBook(issue.id)
      setIssues((current) => current.map((item) => item.id === returned.id ? returned : item))
      setNotice(`“${returned.book?.title || 'Book'}” was returned successfully. Fine: ₹${returned.fine}.`)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The book could not be returned. Please try again.')
    } finally {
      setReturningId(null)
    }
  }

  return (
    <section className="my-books-page">
      <header className="my-books-header">
        <p>YOUR LIBRARY ACCOUNT</p>
        <h1>{returnOnly ? 'Return Books' : 'My Issued Books'}</h1>
        <span>{returnOnly ? 'Select an issued book to complete its return.' : 'Review your current loans and return history.'}</span>
      </header>

      {notice && <p className="my-books-notice" role="status">{notice}</p>}
      {error && <p className="my-books-error" role="alert">{error}</p>}

      {!returnOnly && loadState === 'ready' && (
        <nav className="my-books-tabs" aria-label="Issue categories">
          <a href="#currently-issued">Currently Issued <span>{activeIssues.length}</span></a>
          <a href="#returned-books">Returned <span>{returnedIssues.length}</span></a>
        </nav>
      )}

      {returnOnly ? (
        <IssueSection
          title="Currently issued"
          issues={activeIssues}
          loadState={loadState}
          returningId={returningId}
          onReturn={handleReturn}
          onRetry={() => {
            setLoadState('loading')
            setRetryKey((current) => current + 1)
          }}
          emptyTitle="No books to return"
          emptyDescription="Books issued to your account will appear here."
        />
      ) : (
        <>
          <IssueSection
            id="currently-issued"
            title="Currently issued"
            issues={activeIssues}
            loadState={loadState}
            returningId={returningId}
            onReturn={handleReturn}
            onRetry={() => {
              setLoadState('loading')
              setRetryKey((current) => current + 1)
            }}
            emptyTitle="No books currently issued"
            emptyDescription="Books you issue from the catalogue will appear here."
          />
          {loadState === 'ready' && (
            <IssueSection
              id="returned-books"
              title="Returned books"
              issues={returnedIssues}
              loadState={loadState}
              emptyTitle="No returned books yet"
              emptyDescription="Your completed returns and any fines will be listed here."
            />
          )}
        </>
      )}
    </section>
  )
}

function IssueSection({
  id,
  title,
  issues,
  loadState,
  returningId,
  onReturn,
  onRetry,
  emptyTitle,
  emptyDescription,
}) {
  return (
    <section className="my-books-section" id={id} aria-labelledby={`${id || 'return'}-title`}>
      <header className="my-books-section-heading"><h2 id={`${id || 'return'}-title`}>{title}</h2></header>
      {loadState === 'loading' && <p className="my-books-state" role="status">Loading your issue records…</p>}
      {loadState === 'error' && (
        <div className="my-books-state my-books-state--error" role="alert">
          <strong>Issue records could not be loaded.</strong>
          <button type="button" onClick={onRetry}>Try again</button>
        </div>
      )}
      {loadState === 'ready' && issues.length === 0 && (
        <div className="my-books-state">
          <strong>{emptyTitle}</strong>
          <span>{emptyDescription}</span>
        </div>
      )}
      {loadState === 'ready' && issues.length > 0 && (
        <div className="my-books-table-wrap">
          <table className="my-books-table">
            <thead>
              <tr>
                <th scope="col">BOOK</th>
                <th scope="col">ISSUE DATE</th>
                {issues[0].status === 'returned' ? (
                  <>
                    <th scope="col">RETURN DATE</th>
                    <th scope="col">FINE</th>
                  </>
                ) : (
                  <>
                    <th scope="col">DUE DATE</th>
                    <th scope="col">DAYS REMAINING</th>
                  </>
                )}
                <th scope="col">STATUS</th>
                {onReturn && <th scope="col"><span className="visually-hidden">Action</span></th>}
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => {
                const isReturned = issue.status === 'returned'
                const days = getDaysRemaining(issue.dueDate)
                return (
                  <tr key={issue.id}>
                    <td className="my-books-title">
                      <div className="my-books-book-cell">
                        <BookCover
                          book={issue.book || { title: 'Book no longer in catalogue' }}
                          className="my-books-cover"
                        />
                        <span>
                          <strong>{issue.book?.title || 'Book no longer in catalogue'}</strong>
                          <small>{issue.book?.author || '—'}</small>
                        </span>
                      </div>
                    </td>
                    <td>{formatDate(issue.issueDate)}</td>
                    {isReturned ? (
                      <>
                        <td>{formatDate(issue.returnDate)}</td>
                        <td>₹{issue.fine}</td>
                      </>
                    ) : (
                      <>
                        <td>{formatDate(issue.dueDate)}</td>
                        <td>{daysLabel(days)}</td>
                      </>
                    )}
                    <td><span className={`my-books-status${issue.status === 'overdue' ? ' my-books-status--overdue' : ''}`}>{issue.status}</span></td>
                    {onReturn && (
                      <td>
                        <button
                          className="my-books-return-button"
                          type="button"
                          disabled={returningId === issue.id}
                          onClick={() => onReturn(issue)}
                        >
                          {returningId === issue.id ? 'Returning…' : 'Return Book'}
                        </button>
                      </td>
                    )}
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

export default MyBooks
