import './BrandPanel.css'

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M5 8.5c4.2-1.6 7.8-.9 11 1.8v14c-3.2-2.7-6.8-3.4-11-1.8v-14Z" />
        <path d="M27 8.5c-4.2-1.6-7.8-.9-11 1.8v14c3.2-2.7 6.8-3.4 11-1.8v-14Z" />
        <path d="M16 10v14" />
      </svg>
    </span>
  )
}

function BrandPanel() {
  return (
    <aside className="brand-panel">
      <div className="brand-panel-inner">
        <a className="university-brand" href="/login" aria-label="Northstar University Library home">
          <BrandMark />
          <span>
            <strong>Northstar</strong>
            <small>UNIVERSITY LIBRARY</small>
          </span>
        </a>

        <div className="brand-copy">
          <span className="brand-kicker">
            <span className="kicker-line" />
            A space to think
          </span>
          <h2>Find your next<br />great idea.</h2>
          <p>
            Your campus library is more than a place to study. It&apos;s where curiosity
            finds room to grow.
          </p>
        </div>

        <div className="library-art" aria-hidden="true">
          <div className="art-glow" />
          <div className="art-window">
            <div className="window-light" />
            <div className="window-mullion window-mullion--vertical" />
            <div className="window-mullion window-mullion--horizontal" />
          </div>
          <div className="art-shelf art-shelf--back">
            <i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="art-shelf art-shelf--front">
            <i /><i /><i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="art-desk" />
          <div className="art-caption">
            <span className="caption-line" />
            <span>EST. 1968</span>
            <span className="caption-line" />
          </div>
        </div>

        <div className="brand-bottom">
          <span>Quiet spaces. Boundless possibilities.</span>
          <span className="brand-pagination" aria-label="Page 1 of 3">
            <i className="is-current" /><i /><i />
          </span>
        </div>
      </div>
    </aside>
  )
}

export default BrandPanel
