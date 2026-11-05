import { useEffect } from 'react'
import BookCover from './BookCover.jsx'
import './BookDetailsDialog.css'

function BookDetailsDialog({ book, onClose, onIssue }) {
  useEffect(() => {
    if (!book) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [book, onClose])

  if (!book) return null

  const available = Number.isFinite(book.availableCopies) && book.availableCopies > 0

  return (
    <div className="book-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section
        className="book-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-dialog-title"
      >
        <button className="book-dialog-close" type="button" onClick={onClose} aria-label="Close book details">×</button>
        <div className="book-dialog-heading">
          <BookCover book={book} className="book-dialog-cover" />
          <div>
            <p className="book-dialog-eyebrow">{book.category || 'LIBRARY BOOK'}</p>
            <h2 id="book-dialog-title">{book.title}</h2>
            <p className="book-dialog-author">by {book.author || 'Author unavailable'}</p>
          </div>
        </div>
        <p className="book-dialog-section-label">Description</p>
        <p className="book-dialog-description">
          {book.description || 'A description has not been provided for this title.'}
        </p>
        <dl className="book-dialog-details">
          <div><dt>ISBN</dt><dd>{book.isbn || '—'}</dd></div>
          <div><dt>Publisher</dt><dd>{book.publisher || '—'}</dd></div>
          <div><dt>Category</dt><dd>{book.category || '—'}</dd></div>
          <div><dt>Total copies</dt><dd>{Number.isFinite(book.totalCopies) ? book.totalCopies : '—'}</dd></div>
          <div><dt>Available copies</dt><dd>{Number.isFinite(book.availableCopies) ? book.availableCopies : '—'}</dd></div>
          <div><dt>Availability</dt><dd>{available ? 'Available' : Number.isFinite(book.availableCopies) ? 'Currently unavailable' : 'Unknown'}</dd></div>
        </dl>
        <div className="book-dialog-actions">
          <button className="book-dialog-secondary" type="button" onClick={onClose}>Close</button>
          <button
            className="book-dialog-primary"
            type="button"
            onClick={() => onIssue(book)}
            disabled={!available}
          >
            {available ? 'Issue Book' : 'Not Available'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default BookDetailsDialog
