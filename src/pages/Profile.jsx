import { useState } from 'react'
import FormField from '../components/FormField.jsx'
import useAuth from '../components/useAuth.js'
import { updateCurrentUser } from '../services/authService.js'
import './Profile.css'

const departments = [
  'Computer Science',
  'Engineering',
  'Business',
  'Arts and Humanities',
  'Science',
  'Other',
]
const studyYears = ['First year', 'Second year', 'Third year', 'Fourth year', 'Postgraduate']
const phonePattern = /^[+()\d\s-]{7,20}$/
const emptyForm = { name: '', phone: '', department: '', year: '' }

function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date)
}

function profileFormFromUser(user) {
  return {
    name: user.name || '',
    phone: user.phone || '',
    department: user.department || '',
    year: user.year || '',
  }
}

function validateProfile(form) {
  const errors = {}
  const name = form.name.trim()
  const phone = form.phone.trim()

  if (!name || name.length > 120) errors.name = 'Enter a name between 1 and 120 characters.'
  if (!phonePattern.test(phone)) errors.phone = 'Enter a valid phone number.'
  if (!departments.includes(form.department)) errors.department = 'Select a valid department.'
  if (!studyYears.includes(form.year)) errors.year = 'Select a valid year of study.'
  return errors
}

function Profile() {
  const { user: profile, updateUser } = useAuth()
  const [form, setForm] = useState(() => profileFormFromUser(profile || emptyForm))
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  function beginEditing() {
    setForm(profileFormFromUser(profile))
    setFieldErrors({})
    setError('')
    setSuccess('')
    setIsEditing(true)
  }

  function cancelEditing() {
    setForm(profileFormFromUser(profile))
    setFieldErrors({})
    setError('')
    setIsEditing(false)
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
    setSuccess('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const validationErrors = validateProfile(form)
    setFieldErrors(validationErrors)
    setError('')
    setSuccess('')
    if (Object.keys(validationErrors).length > 0) return

    setIsSaving(true)
    try {
      const updatedUser = await updateCurrentUser({
        name: form.name.trim(),
        phone: form.phone.trim(),
        department: form.department,
        year: form.year,
      })
      setForm(profileFormFromUser(updatedUser))
      updateUser(updatedUser)
      setIsEditing(false)
      setSuccess('Your profile has been updated.')
    } catch (requestError) {
      const responseErrors = requestError.response?.data?.errors
      if (responseErrors && typeof responseErrors === 'object') setFieldErrors(responseErrors)
      setError(requestError.response?.data?.message || 'Your changes could not be saved. Check your connection and try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="profile-page">
      <header className="profile-heading">
        <p>YOUR LIBRARY ACCOUNT</p>
        <h1>Student Profile</h1>
        <span>View and manage the personal details connected to your library account.</span>
      </header>

      {profile && (
        <article className="profile-card">
          <div className="profile-card-header">
            <div className="profile-identity">
              <div className="profile-avatar" aria-hidden="true">{getInitials(profile.name)}</div>
              <div>
                <p>STUDENT ACCOUNT</p>
                <h2>{profile.name}</h2>
                <span>Register No. {profile.registerNumber}</span>
              </div>
            </div>
            {!isEditing && (
              <button className="profile-button profile-button--primary" type="button" onClick={beginEditing}>
                Edit Profile
              </button>
            )}
          </div>

          {success && <p className="profile-message profile-message--success" role="status">{success}</p>}
          {error && <p className="profile-message profile-message--error" role="alert">{error}</p>}

          {isEditing ? (
            <form className="profile-form" onSubmit={handleSubmit} noValidate>
              <div className="profile-form-grid">
                <FormField
                  id="profile-name"
                  name="name"
                  label="Student Name"
                  autoComplete="name"
                  maxLength={120}
                  value={form.name}
                  onChange={handleChange}
                  error={fieldErrors.name}
                />
                <FormField
                  id="profile-phone"
                  name="phone"
                  label="Phone Number"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={20}
                  value={form.phone}
                  onChange={handleChange}
                  error={fieldErrors.phone}
                />
                <FormField
                  id="profile-department"
                  name="department"
                  label="Department"
                  as="select"
                  value={form.department}
                  onChange={handleChange}
                  error={fieldErrors.department}
                  options={departments.map((department) => [department, department])}
                />
                <FormField
                  id="profile-year"
                  name="year"
                  label="Year of Study"
                  as="select"
                  value={form.year}
                  onChange={handleChange}
                  error={fieldErrors.year}
                  options={studyYears.map((year) => [year, year])}
                />
              </div>
              {fieldErrors.profile && <p className="profile-message profile-message--error" role="alert">{fieldErrors.profile}</p>}
              <div className="profile-form-actions">
                <button className="profile-button profile-button--secondary" type="button" onClick={cancelEditing} disabled={isSaving}>
                  Cancel
                </button>
                <button className="profile-button profile-button--primary" type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <dl className="profile-details">
              <div><dt>Register Number</dt><dd>{profile.registerNumber}</dd></div>
              <div><dt>Phone Number</dt><dd>{profile.phone || '—'}</dd></div>
              <div><dt>Department</dt><dd>{profile.department || '—'}</dd></div>
              <div><dt>Year of Study</dt><dd>{profile.year || '—'}</dd></div>
              <div><dt>Account Type</dt><dd>{profile.role === 'admin' ? 'Administrator' : 'Student'}</dd></div>
              <div><dt>Member Since</dt><dd>{formatDate(profile.createdAt)}</dd></div>
            </dl>
          )}

          <p className="profile-security-note">
            Register number and account access details are protected and cannot be changed here.
          </p>
        </article>
      )}
    </section>
  )
}

export default Profile
