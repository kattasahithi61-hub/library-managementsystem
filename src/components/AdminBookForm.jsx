import { useState } from 'react'
import './AdminBookForm.css'

function getInitialForm(book) {
  return {
    title: book?.title || '',
    author: book?.author || '',
    isbn: book?.isbn || '',
    category: book?.category || '',
    publisher: book?.publisher || '',
    description: book?.description || '',
    totalCopies: String(book?.totalCopies ?? 1),
    availableCopies: String(book?.availableCopies ?? 1),
    coverImage: book?.coverImage || '',
  }
}

const categories = [
  'Programming',
  'Database',
  'Web Development',
  'AI & Machine Learning',
  'Computer Networks',
  'Operating Systems',
  'Other',
]

function validate(values) {
  const errors = {}
  for (const field of ['title', 'author', 'isbn', 'category']) {
    if (!values[field].trim()) errors[field] = 'This field is required.'
  }
  const totalCopies = Number(values.totalCopies)
  const availableCopies = Number(values.availableCopies)
  if (!Number.isInteger(totalCopies) || totalCopies < 1) {
    errors.totalCopies = 'Enter a whole number greater than zero.'
  }
  if (!Number.isInteger(availableCopies) || availableCopies < 0) {
    errors.availableCopies = 'Enter zero or a positive whole number.'
  } else if (Number.isInteger(totalCopies) && availableCopies > totalCopies) {
    errors.availableCopies = 'Available copies cannot exceed total copies.'
  }
  if (values.coverImage.trim()) {
    try {
      const url = new URL(values.coverImage.trim(), window.location.origin)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL protocol.')
    } catch {
      errors.coverImage = 'Enter a valid HTTP(S) image URL or a local path.'
    }
  }
  return errors
}

function AdminBookForm({ book, submitting, serverError, onCancel, onSubmit }) {
  const [values, setValues] = useState(() => getInitialForm(book))
  const [errors, setErrors] = useState({})

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    onSubmit({
      title: values.title.trim(),
      author: values.author.trim(),
      isbn: values.isbn.trim(),
      category: values.category.trim(),
      publisher: values.publisher.trim(),
      description: values.description.trim(),
      totalCopies: Number(values.totalCopies),
      availableCopies: Number(values.availableCopies),
      coverImage: values.coverImage.trim(),
    })
  }

  return (
    <div className="admin-book-form-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onCancel()
    }}>
      <section
        className="admin-book-form-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-book-form-title"
      >
        <header className="admin-book-form-header">
          <div>
            <p>LIBRARY CATALOGUE</p>
            <h2 id="admin-book-form-title">{book ? 'Edit book' : 'Add new book'}</h2>
          </div>
          <button type="button" className="admin-dialog-close" onClick={onCancel} disabled={submitting} aria-label="Close form">
            ×
          </button>
        </header>
        <form className="admin-book-form" onSubmit={handleSubmit} noValidate>
          <div className="admin-form-grid">
            <AdminInput id="admin-book-title" name="title" label="Title" value={values.title} onChange={updateField} error={errors.title} required />
            <AdminInput id="admin-book-author" name="author" label="Author" value={values.author} onChange={updateField} error={errors.author} required />
            <AdminInput id="admin-book-isbn" name="isbn" label="ISBN" value={values.isbn} onChange={updateField} error={errors.isbn} required />
            <div className="admin-form-field">
              <label htmlFor="admin-book-category">Category <span>*</span></label>
              <select id="admin-book-category" name="category" value={values.category} onChange={updateField} aria-invalid={Boolean(errors.category)}>
                <option value="">Select category</option>
                {categories.map((category) => <option value={category} key={category}>{category}</option>)}
                {values.category && !categories.includes(values.category) && (
                  <option value={values.category}>{values.category}</option>
                )}
              </select>
              {errors.category && <small role="alert">{errors.category}</small>}
            </div>
            <AdminInput id="admin-book-publisher" name="publisher" label="Publisher" value={values.publisher} onChange={updateField} />
            <AdminInput id="admin-book-cover" name="coverImage" label="Cover image URL" value={values.coverImage} onChange={updateField} error={errors.coverImage} placeholder="https://…" />
            <AdminInput id="admin-book-total" name="totalCopies" label="Total copies" type="number" min="1" value={values.totalCopies} onChange={updateField} error={errors.totalCopies} required />
            <AdminInput id="admin-book-available" name="availableCopies" label="Available copies" type="number" min="0" value={values.availableCopies} onChange={updateField} error={errors.availableCopies} required />
            <div className="admin-form-field admin-form-field--full">
              <label htmlFor="admin-book-description">Description</label>
              <textarea id="admin-book-description" name="description" rows="4" value={values.description} onChange={updateField} maxLength="5000" />
            </div>
          </div>
          {serverError && <p className="admin-form-server-error" role="alert">{serverError}</p>}
          <footer className="admin-book-form-actions">
            <button type="button" className="admin-secondary-button" onClick={onCancel} disabled={submitting}>Cancel</button>
            <button type="submit" className="admin-primary-button" disabled={submitting}>
              {submitting ? 'Saving…' : book ? 'Save changes' : 'Add book'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function AdminInput({ id, name, label, value, onChange, error, required = false, ...props }) {
  return (
    <div className="admin-form-field">
      <label htmlFor={id}>{label}{required && <> <span>*</span></>}</label>
      <input id={id} name={name} value={value} onChange={onChange} aria-invalid={Boolean(error)} {...props} />
      {error && <small role="alert">{error}</small>}
    </div>
  )
}

export default AdminBookForm
