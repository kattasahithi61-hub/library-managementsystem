import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminBookForm from '../components/AdminBookForm.jsx'
import {
  createBook,
  deleteBook,
  fetchAdminBooks,
  updateBook,
} from '../services/adminBooksService.js'
import './AdminBooks.css'

function getId(book) {
  return book.id || book._id
}

function BookCover({ book }) {
  return (
    <span className="admin-books-cover">
      {book.coverImage
        ? <img src={book.coverImage} alt="" loading="lazy" />
        : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5.5h8A2 2 0 0 1 14 7.5v12H6a2 2 0 0 1-2-2v-12Z" />
            <path d="M20 5.5h-4a2 2 0 0 0-2 2v12h4a2 2 0 0 0 2-2v-12Z" />
          </svg>
        )}
    </span>
  )
}

function AdminBooks() {
  const [books, setBooks] = useState([])
  const [loadState, setLoadState] = useState('loading')
  const [retryKey, setRetryKey] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All Books')
  const [formBook, setFormBook] = useState(undefined)
  const [detailsBook, setDetailsBook] = useState(null)
  const [deleteBookTarget, setDeleteBookTarget] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formError, setFormError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [feedbackType, setFeedbackType] = useState('success')

  useEffect(() => {
    const controller = new AbortController()
    fetchAdminBooks({ signal: controller.signal })
      .then((result) => {
        setBooks(result)
        setLoadState('ready')
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('Unable to load admin book catalogue.', error)
        setLoadState(error.response?.status === 403 ? 'forbidden' : 'error')
      })
    return () => controller.abort()
  }, [retryKey])

  const categories = useMemo(
      () => [...new Set([
        'Programming',
        'Database',
        'Web Development',
        'AI & Machine Learning',
        'Computer Networks',
        'Operating Systems',
        'Other',
        ...books.map((book) => book.category).filter(Boolean),
      ])].sort((a, b) => a.localeCompare(b)),
    [books],
  )
  const filteredBooks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return books.filter((book) => {
      if (category !== 'All Books' && book.category !== category) return false
      if (!query) return true
      return [book.title, book.author, book.isbn]
        .some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(query))
    })
  }, [books, category, search])

  const clearFeedback = useCallback(() => {
    setFeedback('')
    setFeedbackType('success')
  }, [])

  function openCreateForm() {
    setFormError('')
    setFormBook(null)
  }

  function openEditForm(book) {
    setFormError('')
    setFormBook(book)
  }

  async function handleSave(payload) {
    setIsSaving(true)
    setFormError('')
    clearFeedback()
    try {
      if (formBook) {
        const updated = await updateBook(getId(formBook), payload)
        setBooks((current) => current.map((book) => getId(book) === getId(formBook) ? updated : book))
        setFeedback('Book updated successfully.')
      } else {
        const created = await createBook(payload)
        setBooks((current) => [...current, created].sort((a, b) => a.title.localeCompare(b.title)))
        setFeedback('Book added successfully.')
      }
      setFormBook(undefined)
    } catch (error) {
      const message = error.response?.data?.message
        || 'The book could not be saved. Check your administrator access and try again.'
      const fieldErrors = error.response?.data?.errors
      setFormError(fieldErrors
        ? `${message} ${Object.values(fieldErrors).join(' ')}`
        : message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteBookTarget) return
    setIsDeleting(true)
    clearFeedback()
    try {
      await deleteBook(getId(deleteBookTarget))
      setBooks((current) => current.filter((book) => getId(book) !== getId(deleteBookTarget)))
      setFeedback(`“${deleteBookTarget.title}” was deleted.`)
      setDeleteBookTarget(null)
    } catch (error) {
      setFeedbackType('error')
      setFeedback(error.response?.data?.message || 'The book could not be deleted. Check your administrator access and try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  let tableContent
  if (loadState === 'loading') {
    tableContent = <div className="admin-books-state" role="status"><strong>Loading books</strong><span>Retrieving the library catalogue.</span></div>
  } else if (loadState === 'forbidden') {
    tableContent = <div className="admin-books-state" role="alert"><strong>Administrator access required</strong><span>Your account is not authorized to manage books.</span></div>
  } else if (loadState === 'error') {
    tableContent = (
      <div className="admin-books-state" role="alert">
        <strong>Books could not be loaded</strong>
        <span>Check your connection and administrator access, then try again.</span>
        <button type="button" onClick={() => {
          setLoadState('loading')
          setRetryKey((current) => current + 1)
        }}>Try again</button>
      </div>
    )
  } else if (filteredBooks.length === 0) {
    tableContent = (
      <div className="admin-books-state" role="status">
        <strong>{books.length ? 'No books match your filters' : 'No books in the catalogue yet'}</strong>
        <span>{books.length ? 'Adjust your search or category filter.' : 'Add the first catalogue entry when you are ready.'}</span>
      </div>
    )
  } else {
    tableContent = (
      <div className="admin-books-table-wrap">
        <table className="admin-books-table">
          <thead>
            <tr>
              <th scope="col">COVER</th>
              <th scope="col">BOOK</th>
              <th scope="col">ISBN</th>
              <th scope="col">CATEGORY</th>
              <th scope="col">TOTAL</th>
              <th scope="col">AVAILABLE</th>
              <th scope="col">STATUS</th>
              <th scope="col">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.map((book) => {
              const isAvailable = book.availableCopies > 0
              return (
                <tr key={getId(book)}>
                  <td><BookCover book={book} /></td>
                  <td className="admin-book-title-cell">
                    <strong>{book.title}</strong>
                    <small>{book.author}</small>
                  </td>
                  <td>{book.isbn}</td>
                  <td>{book.category}</td>
                  <td>{book.totalCopies}</td>
                  <td>{book.availableCopies}</td>
                  <td>
                    <span className={`admin-book-status${isAvailable ? '' : ' admin-book-status--unavailable'}`}>
                      {isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-book-actions">
                      <button type="button" onClick={() => setDetailsBook(book)}>View</button>
                      <button type="button" onClick={() => openEditForm(book)}>Edit</button>
                      <button className="admin-delete-action" type="button" onClick={() => setDeleteBookTarget(book)}>Delete</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <section className="admin-books-page">
      <header className="admin-books-header">
        <div>
          <p>LIBRARY ADMINISTRATION</p>
          <h1>Manage Books</h1>
          <span>Add, review, and maintain the library catalogue.</span>
        </div>
        <button className="admin-add-book-button" type="button" onClick={openCreateForm}>
          <span aria-hidden="true">+</span> Add New Book
        </button>
      </header>

      {feedback && (
        <div className={`admin-books-feedback${feedbackType === 'error' ? ' admin-books-feedback--error' : ''}`} role={feedbackType === 'error' ? 'alert' : 'status'}>
          {feedback}
        </div>
      )}

      <div className="admin-books-toolbar">
        <label className="admin-books-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4 4" /></svg>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, author, or ISBN"
            aria-label="Search books by title, author, or ISBN"
          />
        </label>
        <select className="admin-books-category" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter books by category">
          <option value="All Books">All categories</option>
          {categories.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
      </div>

      {loadState === 'ready' && (
        <p className="admin-books-count">{filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}</p>
      )}
      <div className="admin-books-panel">{tableContent}</div>

      {formBook !== undefined && (
        <AdminBookForm
          key={formBook ? getId(formBook) : 'new-book'}
          book={formBook}
          submitting={isSaving}
          serverError={formError}
          onCancel={() => {
            if (!isSaving) setFormBook(undefined)
          }}
          onSubmit={handleSave}
        />
      )}

      {detailsBook && (
        <AdminBookDetails book={detailsBook} onClose={() => setDetailsBook(null)} />
      )}

      {deleteBookTarget && (
        <div className="book-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isDeleting) setDeleteBookTarget(null)
        }}>
          <section className="admin-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-book-title">
            <h2 id="delete-book-title">Delete this book?</h2>
            <p>This will permanently remove “{deleteBookTarget.title}” from the library catalogue. This action cannot be undone.</p>
            {feedbackType === 'error' && feedback && <p className="admin-form-server-error" role="alert">{feedback}</p>}
            <div className="admin-delete-actions">
              <button type="button" disabled={isDeleting} onClick={() => setDeleteBookTarget(null)}>Cancel</button>
              <button className="admin-delete-confirm" type="button" disabled={isDeleting} onClick={handleDelete}>
                {isDeleting ? 'Deleting…' : 'Delete book'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

function AdminBookDetails({ book, onClose }) {
  return (
    <div className="book-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="book-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-book-detail-title">
        <button className="book-dialog-close" type="button" onClick={onClose} aria-label="Close book details">×</button>
        <p className="book-dialog-eyebrow">{book.category}</p>
        <h2 id="admin-book-detail-title">{book.title}</h2>
        <p className="book-dialog-author">by {book.author}</p>
        <p className="book-dialog-description">{book.description || 'No description provided.'}</p>
        <dl className="book-dialog-details">
          <div><dt>ISBN</dt><dd>{book.isbn}</dd></div>
          <div><dt>Publisher</dt><dd>{book.publisher || '—'}</dd></div>
          <div><dt>Total copies</dt><dd>{book.totalCopies}</dd></div>
          <div><dt>Available copies</dt><dd>{book.availableCopies}</dd></div>
          <div><dt>Availability</dt><dd>{book.availableCopies > 0 ? 'Available' : 'Unavailable'}</dd></div>
          <div><dt>Cover image</dt><dd>{book.coverImage || 'Not provided'}</dd></div>
        </dl>
        <div className="book-dialog-actions">
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  )
}

export default AdminBooks
