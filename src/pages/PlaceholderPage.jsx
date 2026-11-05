import './PlaceholderPage.css'

function PlaceholderPage({ eyebrow = 'LIBRARY PORTAL', title, description }) {
  return (
    <section className="placeholder-page">
      <header className="placeholder-heading">
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </header>
      <div className="placeholder-card">
        <span className="placeholder-card-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M6 8.5c3.8-1.4 7.2-.8 10 1.7v13c-2.8-2.5-6.2-3.1-10-1.7v-13Z" />
            <path d="M26 8.5c-3.8-1.4-7.2-.8-10 1.7v13c2.8-2.5 6.2-3.1 10-1.7v-13Z" />
          </svg>
        </span>
        <h2>{title} workspace</h2>
        <p>{description} This section is ready for library features.</p>
        <span className="placeholder-status"><i /> Feature area coming soon</span>
      </div>
    </section>
  )
}

export default PlaceholderPage
