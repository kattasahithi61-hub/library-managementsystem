import './DashboardActivity.css'

const activityLabels = {
  issued: 'Book issued',
  returned: 'Book returned',
  renewed: 'Book renewed',
  fine: 'Fine generated',
}

const activityIcons = {
  issued: '↗',
  returned: '↙',
  renewed: '↻',
  fine: '!',
}

function formatActivityDate(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function DashboardActivity({ activities, unavailable }) {
  if (unavailable) {
    return <p className="dashboard-empty-note">Activity information is currently unavailable.</p>
  }

  if (activities.length === 0) {
    return <p className="dashboard-empty-note">No recent library activity.</p>
  }

  return (
    <ul className="activity-list">
      {activities.map((activity) => {
        const knownType = Boolean(activityLabels[activity.type])
        const type = knownType ? activity.type : 'issued'
        return (
          <li className="activity-item" key={activity.id || `${activity.type}-${activity.occurredAt}-${activity.title}`}>
            <span className={`activity-icon activity-icon--${type}`} aria-hidden="true">{activityIcons[type]}</span>
            <span className="activity-copy">
              <strong>{knownType ? activityLabels[type] : 'Library update'}</strong>
              <small>{activity.title}</small>
            </span>
            <time className="activity-date" dateTime={activity.occurredAt}>
              {formatActivityDate(activity.occurredAt)}
            </time>
          </li>
        )
      })}
    </ul>
  )
}

export default DashboardActivity
