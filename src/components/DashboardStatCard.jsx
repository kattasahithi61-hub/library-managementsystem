import './DashboardStatCard.css'

const icons = {
  books: <><path d="M5 5.5h11.5A2.5 2.5 0 0 1 19 8v11H7a2 2 0 0 1-2-2V5.5Z" /><path d="M5 16.5h14M8.5 9h7M8.5 12h7" /><path d="M7 19a2 2 0 0 1 0-4h12" /></>,
  issued: <><path d="M5 5.5h11.5A2.5 2.5 0 0 1 19 8v11H7a2 2 0 0 1-2-2V5.5Z" /><path d="M8.5 9h7M8.5 12h7M5 16.5h14" /></>,
  due: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
  returned: <><path d="M8 8H5V5" /><path d="M5.2 8a7.5 7.5 0 1 1-1 6" /><path d="m9 12 2 2 4-4" /></>,
  fine: <><rect x="4" y="6" width="16" height="13" rx="2" /><path d="M8 6V4h8v2M8 12h8M8 15h4" /><circle cx="16" cy="15" r="1" /></>,
}

function DashboardStatCard({ icon, label, value, note, tone }) {
  return (
    <article className={`dashboard-stat-card dashboard-stat-card--${tone}`}>
      <div className="stat-card-top">
        <span className="stat-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">{icons[icon]}</svg>
        </span>
        <span className="stat-period">CURRENT</span>
      </div>
      <p className="stat-value">{value}</p>
      <h2>{label}</h2>
      <p className="stat-note">{note}</p>
    </article>
  )
}

export default DashboardStatCard
