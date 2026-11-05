import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookCard from '../components/BookCard.jsx'
import BookDetailsDialog from '../components/BookDetailsDialog.jsx'
import IssueBookDialog from '../components/IssueBookDialog.jsx'
import { BooksApiUnavailableError, fetchBooks } from '../services/booksService.js'
import { issueBook as issueBookRequest } from '../services/issuesService.js'
import './Books.css'

const categories = [
  'All Books',
  'Programming',
  'Database',
  'Web Development',
  'AI & Machine Learning',
  'Computer Networks',
  'Operating Systems',
  'Other',
]

const categoriesByKey = new Map(
  categories.slice(1, -1).map((category) => [category.toLocaleLowerCase(), category]),
)

function getBookCategory(book) {
  const category = typeof book.category === 'string' ? book.category.trim() : ''
  if (!category) return 'Other'
  return categoriesByKey.get(category.toLocaleLowerCase()) || 'Other'
}

function BookStateIcon({ kind }) {
  if (kind === 'error') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 2.8 19h18.4L12 3Z" />
        <path d="M12 9v4m0 3h.01" />
      </svg>
    )
  }

  if (kind === 'search') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.8" cy="10.8" r="6.3" />
        <path d="m15.5 15.5 4 4" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5.5h11.5A2.5 2.5 0 0 1 19 8v11H7a2 2 0 0 1-2-2V5.5Z" />
      <path d="M8.5 9h7M8.5 12h7M5 16.5h14" />
    </svg>
  )
}

function BooksPageState({ kind, title, description, onRetry }) {
  return (
    <div className={`books-state${kind === 'error' ? ' books-state--error' : ''}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'loading' ? (
        <span className="books-spinner" aria-hidden="true" />
      ) : (
        <span className="books-state-icon"><BookStateIcon kind={kind} /></span>
      )}
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry && (
        <button className="books-state-action" type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

function Books() {
  const navigate = useNavigate()
  const [books, setBooks] = useState([])
  const [loadState, setLoadState] = useState('loading')
  const [category, setCategory] = useState('All Books')
  const [selectedBook, setSelectedBook] = useState(null)
  const [issueTarget, setIssueTarget] = useState(null)
  const [issueSubmitting, setIssueSubmitting] = useState(false)
  const [issueError, setIssueError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    fetchBooks({ signal: controller.signal })
      .then((result) => {
        setBooks(result)
        setLoadState('ready')
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        if (error instanceof BooksApiUnavailableError) {
          setBooks([])
          setLoadState('unavailable')
          return
        }
        console.error('Unable to load books from the library catalogue.', error)
        setLoadState('error')
      })

    return () => controller.abort()
  }, [retryKey])

  const availableBooks = useMemo(
    () => books.filter((book) => Number.isFinite(book.availableCopies) && book.availableCopies > 0),
    [books],
  )

  const filteredBooks = useMemo(() => {
    return availableBooks.filter((book) => {
      return category === 'All Books' || getBookCategory(book) === category
    })
  }, [availableBooks, category])

  const closeDetails = useCallback(() => setSelectedBook(null), [])

  function showIssueDialog(book) {
    setSelectedBook(null)
    setIssueError('')
    setIssueTarget(book)
  }

  async function confirmIssue(book) {
    setIssueSubmitting(true)
    setIssueError('')
    try {
      const issue = await issueBookRequest(book.id || book._id)
      const updatedBook = issue?.book
      if (updatedBook) {
        const updatedId = updatedBook.id || updatedBook._id
        setBooks((current) => current.map((item) => (
          (item.id || item._id) === updatedId ? { ...item, ...updatedBook } : item
        )))
      }
      setIssueTarget(null)
      navigate('/my-books', {
        state: { issueNotice: `“${book.title}” was issued successfully.` },
      })
    } catch (error) {
      setIssueError(error.response?.data?.message || 'The book could not be issued. Please try again.')
    } finally {
      setIssueSubmitting(false)
    }
  }

  let stateContent = null
  if (loadState === 'loading') {
    stateContent = (
      <BooksPageState
        kind="loading"
        title="Loading books"
        description="Connecting to the library catalogue."
      />
    )
  } else if (loadState === 'unavailable') {
    stateContent = (
      <BooksPageState
        kind="empty"
        title="Catalogue not connected"
        description="The books API is not available yet. Titles and availability will appear here when the library catalogue endpoint is ready."
      />
    )
  } else if (loadState === 'error') {
    stateContent = (
      <BooksPageState
        kind="error"
        title="Books could not be loaded"
        description="We couldn't retrieve the library catalogue. Check your connection and try again."
        onRetry={() => {
          setLoadState('loading')
          setRetryKey((key) => key + 1)
        }}
      />
    )
  } else if (books.length === 0) {
    stateContent = (
      <BooksPageState
        kind="empty"
        title="No books in the collection yet"
        description="The library catalogue is empty. Ask a library administrator to add books in Manage Books; titles will appear here as soon as they have available copies."
      />
    )
  } else if (availableBooks.length === 0) {
    stateContent = (
      <BooksPageState
        kind="empty"
        title="No books currently available"
        description="The books in the catalogue are currently unavailable. Please check back after copies have been returned."
      />
    )
  } else if (filteredBooks.length === 0) {
    stateContent = (
      <BooksPageState
        kind="search"
        title="No books in this category"
        description="Choose another category to browse available titles in the library catalogue."
      />
    )
  }

  return (
    <section className="books-page">
      <header className="books-page-header">
        <div className="books-heading-copy">
          <p>EXPLORE THE COLLECTION</p>
          <h1>Available Books</h1>
          <span>Browse available books and learning resources in your college library.</span>
        </div>
      </header>

      <nav className="book-categories" aria-label="Filter books by category">
        {categories.map((item) => (
          <button
            className={`book-category-filter${category === item ? ' book-category-filter--active' : ''}`}
            key={item}
            type="button"
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="books-results-heading">
        <strong>{category}</strong>
        {loadState === 'ready' && (
          <span>{filteredBooks.length} {filteredBooks.length === 1 ? 'title' : 'titles'}</span>
        )}
      </div>

      {stateContent || (
        <div className="books-grid">
          {filteredBooks.map((book) => (
            <BookCard
              book={{ ...book, category: getBookCategory(book) }}
              key={book.id || book._id || `${book.isbn}-${book.title}`}
              onViewDetails={setSelectedBook}
              onIssue={showIssueDialog}
            />
          ))}
        </div>
      )}

      {loadState === 'ready' && filteredBooks.length > 0 && (
        <p className="books-results-summary">
          Showing {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'} from the library catalogue.
        </p>
      )}

      <BookDetailsDialog book={selectedBook} onClose={closeDetails} onIssue={showIssueDialog} />
      <IssueBookDialog
        book={issueTarget}
        submitting={issueSubmitting}
        error={issueError}
        onCancel={() => {
          if (!issueSubmitting) setIssueTarget(null)
        }}
        onConfirm={confirmIssue}
      />
    </section>
  )
}

export default Books
