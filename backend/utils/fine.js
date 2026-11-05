const millisecondsPerDay = 86_400_000
export const finePerLateDay = 10
export const issuePeriodDays = 14

function utcDayStart(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new TypeError('A valid date is required.')
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function calculateFine(dueDate, returnDate = new Date()) {
  const lateDays = Math.max(
    0,
    Math.floor((utcDayStart(returnDate) - utcDayStart(dueDate)) / millisecondsPerDay),
  )
  return lateDays * finePerLateDay
}

export function getDueDate(issueDate = new Date()) {
  const dueDate = new Date(utcDayStart(issueDate))
  dueDate.setUTCDate(dueDate.getUTCDate() + issuePeriodDays)
  return dueDate
}

export function getIssueStatus(issue, now = new Date()) {
  if (issue.status === 'issued' && utcDayStart(now) > utcDayStart(issue.dueDate)) {
    return 'overdue'
  }
  return issue.status
}
