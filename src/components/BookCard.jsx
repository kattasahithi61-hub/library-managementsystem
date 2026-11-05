import './BookCard.css'
import BookCover from './BookCover.jsx'

function BookCard({ book, onViewDetails, onIssue }) {
  const isAvailable = Number.isFinite(book.availableCopies) && book.availableCopies > 0

  return (
    <article className="book-card">
      <BookCover book={book} className="book-cover" />

      <div className="book-card-body">
        <span className="book-category">{book.category}</span>
        <h2 title={book.title}>{book.title}</h2>
        <p className="book-author">by {book.author || 'Author unavailable'}</p>
        <p className="book-copies-available">
          {book.availableCopies} {book.availableCopies === 1 ? 'copy' : 'copies'} available
        </p>
        <div className="book-card-actions">
          <button className="book-details-button" type="button" onClick={() => onViewDetails(book)}>
            View Details
          </button>
          {isAvailable && (
            <button className="book-issue-button" type="button" onClick={() => onIssue(book)}>
              Issue Book
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default BookCard
