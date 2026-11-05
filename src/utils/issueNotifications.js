const millisecondsPerDay = 86_400_000
const dueSoonDays = 3

function utcDay(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return null
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function getIssueDaysRemaining(dueDate, now = new Date()) {
  const dueDay = utcDay(dueDate)
  const today = utcDay(now)
  if (dueDay === null || today === null) return null
  return Math.floor((dueDay - today) / millisecondsPerDay)
}

export function getCurrentIssueStatus(issue, now = new Date()) {
  if (issue.status === 'returned') return 'returned'
  const daysRemaining = getIssueDaysRemaining(issue.dueDate, now)
  return daysRemaining !== null && daysRemaining < 0 ? 'overdue' : 'issued'
}

export function createIssueNotifications(issues, now = new Date()) {
  return issues.flatMap((issue) => {
    const bookTitle = issue.book?.title || 'Book no longer in catalogue'
    const notificationBase = {
      bookTitle,
      issueId: issue.id,
    }
    const notifications = [{
      ...notificationBase,
      id: `${issue.id}:issued`,
      type: 'issued',
      title: 'Book issued',
      message: `${bookTitle} was issued to your account.`,
      occurredAt: issue.issueDate,
    }]

    if (issue.status === 'returned' && issue.returnDate) {
      notifications.push({
        ...notificationBase,
        id: `${issue.id}:returned`,
        type: 'returned',
        title: 'Book returned',
        message: `${bookTitle} was returned successfully.`,
        occurredAt: issue.returnDate,
      })
    } else {
      const daysRemaining = getIssueDaysRemaining(issue.dueDate, now)
      if (daysRemaining !== null && daysRemaining < 0) {
        notifications.push({
          ...notificationBase,
          id: `${issue.id}:overdue`,
          type: 'overdue',
          title: 'Book overdue',
          message: `${bookTitle} is overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'}.`,
          occurredAt: now,
        })
      } else if (daysRemaining !== null && daysRemaining <= dueSoonDays) {
        notifications.push({
          ...notificationBase,
          id: `${issue.id}:due`,
          type: 'due',
          title: daysRemaining === 0 ? 'Book due today' : 'Due date approaching',
          message: daysRemaining === 0
            ? `${bookTitle} is due today.`
            : `${bookTitle} is due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
          occurredAt: now,
        })
      }
    }

    if (Number.isFinite(issue.fine) && issue.fine > 0) {
      notifications.push({
        ...notificationBase,
        id: `${issue.id}:fine`,
        type: 'fine',
        title: 'Fine generated',
        message: `A fine of ₹${issue.fine} applies to ${bookTitle}.`,
        occurredAt: issue.returnDate || now,
      })
    }

    return notifications
  }).sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt))
}

export function getReadNotificationIds(storageKey) {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch (error) {
    console.warn('Notification read state could not be restored.', error)
    return []
  }
}

export function saveReadNotificationIds(storageKey, ids) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids))
  } catch (error) {
    console.error('Notification read state could not be saved.', error)
  }
}

export function formatNotificationDate(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}
