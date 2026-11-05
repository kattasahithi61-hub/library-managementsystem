import { useEffect, useState } from 'react'
import {
  fetchAdminStudent,
  fetchAdminStudents,
  updateAdminStudentStatus,
} from '../services/adminStudentsService.js'
import './AdminStudents.css'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function studentId(student) {
  return student.id || student._id
}

function StudentDetails({ details, onClose }) {
  if (!details) return null
  const { student, summary } = details

  return (
    <div className="admin-students-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section
        className="admin-students-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-details-title"
      >
        <button className="admin-students-dialog-close" type="button" onClick={onClose} aria-label="Close student details">×</button>
        <p>STUDENT RECORD</p>
        <h2 id="student-details-title">{student.name}</h2>
        <span className="admin-students-dialog-register">{student.registerNumber}</span>
        <dl className="admin-students-details">
          <div><dt>Phone</dt><dd>{student.phone || '—'}</dd></div>
          <div><dt>Department</dt><dd>{student.department || '—'}</dd></div>
          <div><dt>Year</dt><dd>{student.year || '—'}</dd></div>
          <div><dt>Account status</dt><dd>{student.active ? 'Active' : 'Inactive'}</dd></div>
          <div><dt>Registered</dt><dd>{formatDate(student.createdAt)}</dd></div>
        </dl>
        <h3>Book activity</h3>
        <div className="admin-students-summary">
          <div><strong>{summary.totalBooksIssued}</strong><span>Total issues</span></div>
          <div><strong>{summary.currentlyIssued}</strong><span>Currently issued</span></div>
          <div><strong>{summary.returnedBooks}</strong><span>Returned</span></div>
          <div><strong>{summary.overdueBooks}</strong><span>Overdue</span></div>
          <div><strong>₹{summary.totalFines}</strong><span>Total fines</span></div>
        </div>
      </section>
    </div>
  )
}

function AdminStudents() {
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState('')
  const [loadState, setLoadState] = useState('loading')
  const [retryKey, setRetryKey] = useState(0)
  const [selectedDetails, setSelectedDetails] = useState(null)
  const [detailsError, setDetailsError] = useState('')
  const [statusUpdatingId, setStatusUpdatingId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [feedbackType, setFeedbackType] = useState('success')

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoadState('loading')
      fetchAdminStudents({ search, signal: controller.signal })
        .then((result) => {
          setStudents(result)
          setLoadState('ready')
        })
        .catch((error) => {
          if (controller.signal.aborted) return
          console.error('Unable to load admin student list.', error)
          setLoadState(error.response?.status === 403 ? 'forbidden' : 'error')
        })
    }, search.trim() ? 250 : 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search, retryKey])

  async function openDetails(student) {
    setDetailsError('')
    setSelectedDetails({ loading: true })
    try {
      setSelectedDetails(await fetchAdminStudent(studentId(student)))
    } catch (error) {
      console.error('Unable to load student details.', error)
      setSelectedDetails(null)
      setDetailsError(error.response?.data?.message || 'Student details could not be loaded.')
    }
  }

  async function toggleStatus(student) {
    const id = studentId(student)
    const nextActive = !student.active
    setStatusUpdatingId(id)
    setFeedback('')
    try {
      const result = await updateAdminStudentStatus(id, nextActive)
      setStudents((current) => current.map((item) => (
        studentId(item) === id ? { ...item, ...result.student } : item
      )))
      setFeedback(result.message)
      setFeedbackType('success')
      setSelectedDetails((current) => current?.student && studentId(current.student) === id
        ? { ...current, student: result.student }
        : current)
    } catch (error) {
      setFeedback(error.response?.data?.message || 'Student status could not be updated.')
      setFeedbackType('error')
    } finally {
      setStatusUpdatingId('')
    }
  }

  let content
  if (loadState === 'loading') {
    content = <div className="admin-students-state" role="status"><strong>Loading students</strong><span>Retrieving student accounts from the library database.</span></div>
  } else if (loadState === 'forbidden') {
    content = <div className="admin-students-state" role="alert"><strong>Administrator access required</strong><span>Your account is not authorized to view student records.</span></div>
  } else if (loadState === 'error') {
    content = (
      <div className="admin-students-state" role="alert">
        <strong>Students could not be loaded</strong>
        <span>Check your connection and administrator access, then try again.</span>
        <button type="button" onClick={() => {
          setLoadState('loading')
          setRetryKey((current) => current + 1)
        }}>Try again</button>
      </div>
    )
  } else if (students.length === 0) {
    content = (
      <div className="admin-students-state" role="status">
        <strong>{search.trim() ? 'No students match your search' : 'No student accounts found'}</strong>
        <span>{search.trim() ? 'Try another name, register number, or phone number.' : 'Registered students will appear here.'}</span>
      </div>
    )
  } else {
    content = (
      <div className="admin-students-table-wrap">
        <table className="admin-students-table">
          <thead>
            <tr>
              <th scope="col">STUDENT</th>
              <th scope="col">REGISTER NUMBER</th>
              <th scope="col">PHONE</th>
              <th scope="col">ACTIVE ISSUES</th>
              <th scope="col">STATUS</th>
              <th scope="col">REGISTERED</th>
              <th scope="col">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const id = studentId(student)
              return (
                <tr key={id}>
                  <td className="admin-student-name"><strong>{student.name}</strong><small>{student.department} · {student.year}</small></td>
                  <td>{student.registerNumber}</td>
                  <td>{student.phone || '—'}</td>
                  <td>{student.activeIssuesCount}</td>
                  <td><span className={`admin-student-status${student.active ? '' : ' admin-student-status--inactive'}`}>{student.active ? 'Active' : 'Inactive'}</span></td>
                  <td>{formatDate(student.createdAt)}</td>
                  <td>
                    <div className="admin-student-actions">
                      <button type="button" onClick={() => openDetails(student)}>Details</button>
                      <button
                        type="button"
                        className={student.active ? 'admin-student-deactivate' : ''}
                        disabled={statusUpdatingId === id}
                        onClick={() => toggleStatus(student)}
                      >
                        {statusUpdatingId === id ? 'Saving…' : student.active ? 'Deactivate' : 'Activate'}
                      </button>
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
    <section className="admin-students-page">
      <header className="admin-students-header">
        <div>
          <p>LIBRARY ADMINISTRATION</p>
          <h1>Manage Students</h1>
          <span>Review student accounts, book activity, and account status.</span>
        </div>
      </header>

      <label className="admin-students-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, register number, or phone"
          aria-label="Search students"
        />
      </label>

      {feedback && <p className={`admin-students-feedback${feedbackType === 'error' ? ' admin-students-feedback--error' : ''}`} role={feedbackType === 'error' ? 'alert' : 'status'}>{feedback}</p>}
      {detailsError && <p className="admin-students-feedback admin-students-feedback--error" role="alert">{detailsError}</p>}

      <p className="admin-students-count">{loadState === 'ready' ? `${students.length} student${students.length === 1 ? '' : 's'}${search.trim() ? ' found' : ''}` : ' '}</p>
      <div className="admin-students-panel">{content}</div>

      {selectedDetails && (
        selectedDetails.loading
          ? <div className="admin-students-dialog-backdrop"><div className="admin-students-state" role="status">Loading student details…</div></div>
          : <StudentDetails details={selectedDetails} onClose={() => setSelectedDetails(null)} />
      )}
    </section>
  )
}

export default AdminStudents
