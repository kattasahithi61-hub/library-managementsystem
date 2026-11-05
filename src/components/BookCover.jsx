import { useState } from 'react'
import './BookCover.css'

function BookCover({ book, className = '' }) {
  const imageUrl = typeof book.coverImage === 'string' && book.coverImage.trim()
    ? book.coverImage.trim()
    : typeof book.coverUrl === 'string' && book.coverUrl.trim()
      ? book.coverUrl.trim()
      : ''
  const [failedUrl, setFailedUrl] = useState('')

  const showImage = imageUrl && failedUrl !== imageUrl

  return (
    <div className={`library-book-cover ${className}`.trim()}>
      {showImage ? (
        <img
          src={imageUrl}
          alt={`Cover of ${book.title}`}
          loading="lazy"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <div className="library-book-cover-fallback" aria-label="Library-themed book cover">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <path d="M8 14c8-3 16-1 24 4v34c-8-5-16-7-24-4V14Z" />
            <path d="M56 14c-8-3-16-1-24 4v34c8-5 16-7 24-4V14Z" />
            <path d="M15 22h10m-10 6h10m14-6h10m-10 6h10M32 18v34" />
          </svg>
          <span>NORTHSTAR UNIVERSITY</span>
          <strong>{book.title || 'Library Collection'}</strong>
        </div>
      )}
    </div>
  )
}

export default BookCover
