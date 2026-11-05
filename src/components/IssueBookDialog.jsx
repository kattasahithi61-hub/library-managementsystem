import { useEffect } from 'react'
import './IssueBookDialog.css'

const issuePeriodDays = 14

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(value)
}

function getIssueDates() {
  const issueDate = new Date()
  const dueDate = new Date(issueDate)
  dueDate.setDate(dueDate.getDate() + issuePeriodDays)
  return { issueDate, dueDate }
}

function IssueBookDialog({ book, submitting, error, onCancel, onConfirm }) {
  const dates = getIssueDates()

  useEffect(() => {
    if (!book) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !submitting) onCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [book, onCancel, submitting])

  if (!book) return null

  return (
    <div className="issue-confirm-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onCancel()
    }}>
      <section
        className="issue-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-confirm-title"
      >
        <button className="issue-confirm-close" type="button" onClick={onCancel} disabled={submitting} aria-label="Close issue confirmation">×</button>
        <p className="issue-confirm-eyebrow">BOOK ISSUE REQUEST</p>
        <h2 id="issue-confirm-title">Issue this book?</h2>
        <p className="issue-confirm-book-title">{book.title}</p>
        <p className="issue-confirm-author">by {book.author}</p>
        <dl className="issue-confirm-details">
          <div><dt>Available copies</dt><dd>{book.availableCopies}</dd></div>
          <div><dt>Issue date</dt><dd>{formatDate(dates.issueDate)}</dd></div>
          <div><dt>Due date</dt><dd>{formatDate(dates.dueDate)}</dd></div>
        </dl>
        <p className="issue-fine-policy">
          Return by the due date to avoid a fine. Late returns are charged ₹10 per calendar day.
        </p>
        {error && <p className="issue-confirm-error" role="alert">{error}</p>}
        <div className="issue-confirm-actions">
          <button type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
          <button className="issue-confirm-primary" type="button" onClick={() => onConfirm(book)} disabled={submitting || book.availableCopies < 1}>
            {submitting ? 'Issuing…' : 'Confirm Issue'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default IssueBookDialog
