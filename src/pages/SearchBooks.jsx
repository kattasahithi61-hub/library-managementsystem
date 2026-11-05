import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookCard from '../components/BookCard.jsx'
import BookDetailsDialog from '../components/BookDetailsDialog.jsx'
import IssueBookDialog from '../components/IssueBookDialog.jsx'
import { BooksApiUnavailableError, fetchBooks } from '../services/booksService.js'
import { issueBook as issueBookRequest } from '../services/issuesService.js'
import './SearchBooks.css'

const categories = [
  'Programming',
  'Database',
  'Web Development',
  'AI & Machine Learning',
  'Computer Networks',
  'Operating Systems',
  'Other',
]

const standardCategories = new Set(categories.slice(0, -1).map((category) => category.toLocaleLowerCase()))

function isOtherCategory(category) {
  const normalized = typeof category === 'string' ? category.trim().toLocaleLowerCase() : ''
  return !normalized || !standardCategories.has(normalized)
}

function SearchBooks() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [request, setRequest] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [books, setBooks] = useState([])
  const [loadState, setLoadState] = useState('initial')
  const [validationError, setValidationError] = useState('')
  const [selectedBook, setSelectedBook] = useState(null)
  const [issueTarget, setIssueTarget] = useState(null)
  const [issueSubmitting, setIssueSubmitting] = useState(false)
  const [issueError, setIssueError] = useState('')

  useEffect(() => {
    if (!request) return undefined
    const controller = new AbortController()

    fetchBooks({
      signal: controller.signal,
      ...(request.query ? { search: request.query } : {}),
      ...(request.category && request.category !== 'Other' ? { category: request.category } : {}),
    })
      .then((result) => {
        const matchingBooks = request.category === 'Other'
          ? result.filter((book) => isOtherCategory(book.category))
          : result
        setBooks(matchingBooks)
        setLoadState('ready')
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('Unable to search the library catalogue.', error)
        setLoadState(error instanceof BooksApiUnavailableError ? 'unavailable' : 'error')
      })

    return () => controller.abort()
  }, [request, retryKey])

  const closeDetails = useCallback(() => setSelectedBook(null), [])

  function handleSearch(event) {
    event.preventDefault()
    const normalizedQuery = query.trim()
    if (!normalizedQuery && !category) {
      setValidationError('Enter a title, author, or ISBN, or choose a category.')
      return
    }

    setValidationError('')
    setRequest({ query: normalizedQuery, category })
    setBooks([])
    setLoadState('loading')
  }

  function clearSearch() {
    setQuery('')
    setCategory('')
    setValidationError('')
    setBooks([])
    setRequest(null)
    setLoadState('initial')
  }

  function retrySearch() {
    setLoadState('loading')
    setBooks([])
    setRetryKey((current) => current + 1)
  }

  function showIssueDialog(book) {
    setSelectedBook(null)
    setIssueError('')
    setIssueTarget(book)
  }

  async function confirmIssue(book) {
    setIssueSubmitting(true)
    setIssueError('')
    try {
      await issueBookRequest(book.id || book._id)
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

  let resultsContent
  if (loadState === 'initial') {
    resultsContent = (
      <div className="search-books-state" role="status">
        <span className="search-books-state-icon" aria-hidden="true">⌕</span>
        <h2>Search the library catalogue to find a book.</h2>
        <p>Search by title, author, or ISBN, or narrow your results by category.</p>
      </div>
    )
  } else if (loadState === 'loading') {
    resultsContent = (
      <div className="search-books-state" role="status">
        <span className="search-books-spinner" aria-hidden="true" />
        <h2>Searching the catalogue</h2>
        <p>Looking for matching books in the library database.</p>
      </div>
    )
  } else if (loadState === 'unavailable') {
    resultsContent = (
      <div className="search-books-state search-books-state--error" role="alert">
        <h2>Catalogue not connected</h2>
        <p>The library catalogue is not available right now. Please try again later.</p>
      </div>
    )
  } else if (loadState === 'error') {
    resultsContent = (
      <div className="search-books-state search-books-state--error" role="alert">
        <h2>Search could not be completed</h2>
        <p>We couldn't retrieve matching books. Check your connection and try again.</p>
        <button type="button" onClick={retrySearch}>Try again</button>
      </div>
    )
  } else if (books.length === 0) {
    resultsContent = (
      <div className="search-books-state" role="status">
        <h2>{request.query ? `No books found for "${request.query}".` : 'No books found in this category.'}</h2>
        <p>Try a different title, author, ISBN, or category.</p>
      </div>
    )
  } else {
    resultsContent = (
      <div className="search-books-results-grid">
        {books.map((book) => (
          <BookCard
            book={book}
            key={book.id || book._id || `${book.isbn}-${book.title}`}
            onViewDetails={setSelectedBook}
            onIssue={showIssueDialog}
          />
        ))}
      </div>
    )
  }

  return (
    <section className="search-books-page">
      <header className="search-books-heading">
        <p>LIBRARY CATALOGUE</p>
        <h1>Search Books</h1>
        <span>Quickly find a title, author, or ISBN in the college library.</span>
      </header>

      <form className="search-books-form" onSubmit={handleSearch}>
        <label className="search-books-query">
          <span className="search-books-query-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, author, or ISBN"
            aria-label="Search by title, author, or ISBN"
          />
        </label>
        <label className="search-books-category">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button className="search-books-submit" type="submit">Search</button>
        {(query || category || request) && (
          <button className="search-books-clear" type="button" onClick={clearSearch}>Clear Search</button>
        )}
      </form>

      {validationError && <p className="search-books-validation" role="alert">{validationError}</p>}

      {request && loadState !== 'initial' && (
        <div className="search-books-results-heading" aria-live="polite">
          <div>
            <p>SEARCH RESULTS</p>
            <h2>
              {request.query
                ? `Results for “${request.query}”`
                : `${request.category} books`}
            </h2>
          </div>
          {loadState === 'ready' && (
            <span>{books.length} {books.length === 1 ? 'result' : 'results'} found</span>
          )}
        </div>
      )}

      {resultsContent}

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

export default SearchBooks
