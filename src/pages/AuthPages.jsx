import { useState } from 'react'
import axios from 'axios'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import useAuth from '../components/useAuth.js'
import BrandPanel, { BrandMark } from '../components/BrandPanel.jsx'
import FormField from '../components/FormField.jsx'
import PasswordField from '../components/PasswordField.jsx'
import PasswordRules from '../components/PasswordRules.jsx'
import { getPasswordChecks } from '../utils/passwordValidation.js'
import { API_BASE_URL } from '../services/apiConfig.js'
import {
  changeAccountPassword,
  resetAccountPassword,
  setAccountRecoveryPin,
  verifyRecoveryDetails,
} from '../services/authService.js'
import '../App.css'

const REGISTER_NUMBER_PATTERN = /^[A-Za-z0-9]{10}$/

function getRegisterNumberError(value) {
  if (!value.trim()) return 'Enter your register number.'
  if (!REGISTER_NUMBER_PATTERN.test(value.trim())) {
    return 'Register number must be exactly 10 characters using letters and numbers only.'
  }
  return ''
}

export function AuthLayout({ children }) {
  return (
    <main className="portal">
      <BrandPanel />
      <section className="form-panel">
        <div className="mobile-brand">
          <BrandMark />
          <span>Northstar University</span>
        </div>
        {children}
      </section>
    </main>
  )
}

function PageHeading({ eyebrow, title, description }) {
  return (
    <header className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="heading-description">{description}</p>
    </header>
  )
}

function FormNotice({ notice, type = 'info' }) {
  if (!notice) return null
  return (
    <p className={`form-notice form-notice--${type}`} role="status">
      {notice}
    </p>
  )
}

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [registerNumber, setRegisterNumber] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [noticeType, setNoticeType] = useState(
    () => searchParams.get('registered') === '1' || searchParams.get('passwordReset') === '1' ? 'info' : 'error',
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState(
    () => searchParams.get('passwordReset') === '1'
      ? 'Password reset successfully. Please login with your new password.'
      : searchParams.get('registered') === '1' ? 'Your account was created. You can now sign in.' : '',
  )

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}
    const registerNumberError = getRegisterNumberError(registerNumber)
    if (registerNumberError) nextErrors.registerNumber = registerNumberError
    if (!password) nextErrors.password = 'Enter your password.'
    setErrors(nextErrors)
    setNotice('')
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    setNoticeType('error')
    try {
      await signIn(registerNumber.trim().toUpperCase(), password)
      const returnTo = location.state?.from
      navigate(returnTo && returnTo !== '/login' ? returnTo : '/dashboard', { replace: true })
    } catch (error) {
      const response = error.response
      if (response?.status === 404) {
        setNotice('No account found for this register number.')
      } else if (response?.status === 401) {
        setNotice('Incorrect password.')
      } else if (response?.status === 400) {
        setNotice(response.data?.message || 'Enter a valid register number and password.')
      } else {
        console.error('Student login request failed.', error)
        setNotice(
          response?.data?.message
            || 'Could not sign in. Check that the library server is running, then try again.',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="form-content">
      <PageHeading
        eyebrow="STUDENT PORTAL"
        title="Welcome back"
        description="Sign in with your university credentials to continue."
      />
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormField
          id="login-register-number"
          label="Register number"
          placeholder="10-character register number"
          inputMode="text"
          maxLength={10}
          pattern="[A-Za-z0-9]{10}"
          autoComplete="username"
          value={registerNumber}
          onChange={(event) => setRegisterNumber(event.target.value)}
          error={errors.registerNumber}
        />
        <PasswordField
          id="login-password"
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <div className="form-meta">
          <span className="secure-note">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2M3.5 7h9v7h-9z" />
            </svg>
            Secure student access
          </span>
          <Link className="text-link" to="/forgot-password">Forgot password?</Link>
        </div>
        <FormNotice notice={notice} type={noticeType} />
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'} {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
      </form>
      <p className="switch-page">
        New to the library? <Link className="text-link" to="/register">Create an account</Link>
      </p>
      <PortalFootnote />
    </div>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [values, setValues] = useState({
    registerNumber: '',
    studentName: '',
    phone: '',
    department: '',
    year: '',
    password: '',
    confirmPassword: '',
    recoveryPin: '',
    confirmRecoveryPin: '',
  })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('info')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const checks = getPasswordChecks(values.password)

  function updateValue(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setNotice('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}
    const registerNumberError = getRegisterNumberError(values.registerNumber)
    if (registerNumberError) nextErrors.registerNumber = registerNumberError
    if (!values.studentName.trim()) nextErrors.studentName = 'Enter your full name.'
    if (!values.phone.trim()) nextErrors.phone = 'Enter your phone number.'
    else if (!/^[+()\d\s-]{7,20}$/.test(values.phone.trim())) {
      nextErrors.phone = 'Enter a valid phone number.'
    }
    if (!values.department) nextErrors.department = 'Select your department.'
    if (!values.year) nextErrors.year = 'Select your current year.'
    if (!checks.every((check) => check.valid)) nextErrors.password = 'Your password does not meet all the rules.'
    if (!values.confirmPassword) nextErrors.confirmPassword = 'Confirm your password.'
    else if (values.password !== values.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }
    if (!/^\d{6}$/.test(values.recoveryPin)) nextErrors.recoveryPin = 'Recovery PIN must be exactly 6 digits.'
    if (!values.confirmRecoveryPin) nextErrors.confirmRecoveryPin = 'Confirm your Recovery PIN.'
    else if (values.recoveryPin !== values.confirmRecoveryPin) {
      nextErrors.confirmRecoveryPin = 'Recovery PINs do not match.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setNotice('')
      return
    }

    setIsSubmitting(true)
    setNotice('')
    setNoticeType('info')
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, {
        name: values.studentName.trim(),
        registerNumber: values.registerNumber.trim().toUpperCase(),
        phone: values.phone.trim(),
        department: values.department,
        year: values.year,
        password: values.password,
        recoveryPin: values.recoveryPin,
      })
      setErrors({})
      navigate('/login?registered=1', { replace: true })
    } catch (error) {
      const response = error.response
      const message = response?.data?.message
      if (response?.status === 409) {
        setErrors((current) => ({ ...current, registerNumber: message || 'Register Number already registered.' }))
      } else if (response?.status === 400 && response.data?.errors) {
        const apiErrors = { ...response.data.errors }
        if (apiErrors.name) {
          apiErrors.studentName = apiErrors.name
          delete apiErrors.name
        }
        setErrors((current) => ({ ...current, ...apiErrors }))
      } else {
        console.error('Registration request failed.', error)
        setNotice(
          response
            ? message || 'Registration failed. Please review your details and try again.'
            : 'Could not reach the registration server. Make sure the backend is running and MongoDB is connected.',
        )
      }
    } finally {
      setIsSubmitting(false)
      setNoticeType('error')
    }
  }

  return (
    <div className="form-content form-content--wide">
      <PageHeading
        eyebrow="JOIN THE LIBRARY"
        title="Create your account"
        description="Set up your student profile for library access."
      />
      <form className="auth-form registration-form" onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <FormField
            id="register-number"
            name="registerNumber"
            label="Register number"
            placeholder="10-character register number"
            inputMode="text"
            maxLength={10}
            pattern="[A-Za-z0-9]{10}"
            autoComplete="off"
            value={values.registerNumber}
            onChange={updateValue}
            error={errors.registerNumber}
          />
          <FormField
            id="student-name"
            name="studentName"
            label="Student name"
            placeholder="Your full name"
            autoComplete="name"
            value={values.studentName}
            onChange={updateValue}
            error={errors.studentName}
          />
          <FormField
            id="student-phone"
            name="phone"
            label="Phone number"
            type="tel"
            placeholder="+1 (555) 000-0000"
            autoComplete="tel"
            value={values.phone}
            onChange={updateValue}
            error={errors.phone}
          />
          <FormField
            id="student-department"
            name="department"
            label="Department"
            as="select"
            value={values.department}
            onChange={updateValue}
            error={errors.department}
            options={[
              ['Computer Science', 'Computer Science'],
              ['Engineering', 'Engineering'],
              ['Business', 'Business'],
              ['Arts and Humanities', 'Arts and Humanities'],
              ['Science', 'Science'],
              ['Other', 'Other'],
            ]}
          />
          <FormField
            id="student-year"
            name="year"
            label="Year of study"
            as="select"
            value={values.year}
            onChange={updateValue}
            error={errors.year}
            options={[
              ['First year', 'First year'],
              ['Second year', 'Second year'],
              ['Third year', 'Third year'],
              ['Fourth year', 'Fourth year'],
              ['Postgraduate', 'Postgraduate'],
            ]}
          />
        </div>
        <div className="form-grid">
          <FormField
            id="recovery-pin"
            name="recoveryPin"
            label="Recovery PIN"
            placeholder="Create a 6-digit PIN"
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]{6}"
            autoComplete="off"
            value={values.recoveryPin}
            onChange={updateValue}
            error={errors.recoveryPin}
          />
          <FormField
            id="confirm-recovery-pin"
            name="confirmRecoveryPin"
            label="Confirm Recovery PIN"
            placeholder="Enter your PIN again"
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]{6}"
            autoComplete="off"
            value={values.confirmRecoveryPin}
            onChange={updateValue}
            error={errors.confirmRecoveryPin}
          />
        </div>
        <PasswordField
          id="register-password"
          name="password"
          label="Password"
          placeholder="Create a strong password"
          autoComplete="new-password"
          value={values.password}
          onChange={updateValue}
          error={errors.password}
        />
        <PasswordRules password={values.password} />
        <PasswordField
          id="confirm-password"
          name="confirmPassword"
          label="Confirm password"
          placeholder="Enter your password again"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={updateValue}
          error={errors.confirmPassword}
        />
        <FormNotice notice={notice} type={noticeType} />
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'} {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
      </form>
      <p className="switch-page">
        Already registered? <Link className="text-link" to="/login">Sign in</Link>
      </p>
      <PortalFootnote />
    </div>
  )
}

export function ForgotPasswordPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isChangePassword = pathname === '/change-password'
  const [values, setValues] = useState({
    registerNumber: '',
    recoveryPin: '',
    resetToken: '',
    currentPassword: '',
    password: '',
    confirmPassword: '',
  })
  const [recoveryVerified, setRecoveryVerified] = useState(false)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('info')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const checks = getPasswordChecks(values.password)

  function updateValue(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setNotice('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!isChangePassword) {
      if (!recoveryVerified) {
        const nextErrors = {}
        const registerNumberError = getRegisterNumberError(values.registerNumber)
        if (registerNumberError) nextErrors.registerNumber = registerNumberError
        if (!/^\d{6}$/.test(values.recoveryPin)) nextErrors.recoveryPin = 'Enter your 6-digit Recovery PIN.'
        setErrors(nextErrors)
        setNotice('')
        if (Object.keys(nextErrors).length > 0) return

        setIsSubmitting(true)
        try {
          const result = await verifyRecoveryDetails(values.registerNumber.trim().toUpperCase(), values.recoveryPin)
          setValues((current) => ({ ...current, resetToken: result.resetToken, recoveryPin: '' }))
          setErrors({})
          setRecoveryVerified(true)
          setNoticeType('info')
          setNotice('Recovery details verified. Choose a new password.')
        } catch (error) {
          setNoticeType('error')
          if (error.response?.status === 400 || error.response?.status === 401) {
            setNotice(error.response.data?.message || 'Unable to verify recovery details. Check them and try again.')
          } else {
            console.error('Recovery verification request failed.', error)
            setNotice(error.response?.data?.message || 'Could not verify recovery details. Check your connection and try again.')
          }
        } finally {
          setIsSubmitting(false)
        }
        return
      }

      const nextErrors = {}
      if (!checks.every((check) => check.valid)) nextErrors.password = 'Your password does not meet all the rules.'
      if (!values.confirmPassword) nextErrors.confirmPassword = 'Confirm your new password.'
      else if (values.password !== values.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.'
      setErrors(nextErrors)
      setNotice('')
      if (Object.keys(nextErrors).length > 0) return

      setIsSubmitting(true)
      try {
        await resetAccountPassword(values.resetToken, values.password)
        navigate('/login?passwordReset=1', { replace: true })
      } catch (error) {
        setNoticeType('error')
        setNotice(error.response?.data?.message || 'Password could not be reset. Verify your Recovery PIN again and retry.')
        if (error.response?.status === 401) {
          setRecoveryVerified(false)
          setValues((current) => ({ ...current, resetToken: '', password: '', confirmPassword: '' }))
        }
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    const nextErrors = {}
    if (!values.currentPassword) nextErrors.currentPassword = 'Enter your current password.'
    if (!checks.every((check) => check.valid)) nextErrors.password = 'Your password does not meet all the rules.'
    if (!values.confirmPassword) nextErrors.confirmPassword = 'Confirm your new password.'
    else if (values.password !== values.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }
    setErrors(nextErrors)
    setNotice('')
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    setNoticeType('error')
    try {
      const result = await changeAccountPassword(values.currentPassword, values.password)
      setValues((current) => ({ ...current, currentPassword: '', password: '', confirmPassword: '' }))
      setErrors({})
      setNoticeType('success')
      setNotice(result.message || 'Password changed successfully.')
    } catch (error) {
      const response = error.response
      if (response?.status === 401) {
        setNotice(response.data?.message || 'Your current password or sign-in session is invalid.')
      } else if (response?.status === 400) {
        setNotice(response.data?.message || 'Please check the new password requirements.')
      } else {
        console.error('Password change request failed.', error)
        setNotice(response?.data?.message || 'The server could not change your password. Check your connection and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="form-content">
      <PageHeading
        eyebrow={isChangePassword ? 'ACCOUNT SECURITY' : 'ACCOUNT RECOVERY'}
        title={isChangePassword ? 'Change your password' : 'Reset your password'}
        description={isChangePassword
          ? 'Verify your current password, then choose a new password.'
          : recoveryVerified
            ? 'Choose a new password for your account.'
            : 'Verify your register number with the Recovery PIN you set during registration.'}
      />
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {!isChangePassword && !recoveryVerified && (
          <FormField
            id="reset-register-number"
            name="registerNumber"
            label="Register number"
            placeholder="10-character register number"
            inputMode="text"
            maxLength={10}
            pattern="[A-Za-z0-9]{10}"
            autoComplete="username"
            value={values.registerNumber}
            onChange={updateValue}
            error={errors.registerNumber}
          />
        )}
        {!isChangePassword && !recoveryVerified && (
          <FormField
            id="reset-recovery-pin"
            name="recoveryPin"
            label="Recovery PIN"
            placeholder="Enter your 6-digit PIN"
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]{6}"
            autoComplete="off"
            value={values.recoveryPin}
            onChange={updateValue}
            error={errors.recoveryPin}
          />
        )}
        {isChangePassword && (
          <PasswordField
            id="current-password"
            name="currentPassword"
            label="Current password"
            placeholder="Enter your current password"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={updateValue}
            error={errors.currentPassword}
          />
        )}
        {(isChangePassword || recoveryVerified) && <PasswordField
          id="new-password"
          name="password"
          label="New password"
          placeholder="Choose a strong password"
          autoComplete="new-password"
          value={values.password}
          onChange={updateValue}
          error={errors.password}
        />}
        <PasswordRules password={values.password} />
        {(isChangePassword || recoveryVerified) && <PasswordField
          id="new-password-confirm"
          name="confirmPassword"
          label="Confirm new password"
          placeholder="Enter your new password again"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={updateValue}
          error={errors.confirmPassword}
        />}
        <FormNotice notice={notice} type={noticeType} />
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isChangePassword ? 'Changing password…' : recoveryVerified ? 'Resetting password…' : 'Verifying…'
            : isChangePassword ? 'Change password' : recoveryVerified ? 'Reset password' : 'Verify Recovery PIN'}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
      </form>
      {isChangePassword && <RecoveryPinSetupForm />}
      <p className="switch-page">
        {isChangePassword ? 'Password updated?' : 'Can sign in?'} <Link className="text-link" to="/login">Back to sign in</Link>
      </p>
      <PortalFootnote />
    </div>
  )
}

function RecoveryPinSetupForm() {
  const [values, setValues] = useState({ currentPassword: '', recoveryPin: '', confirmRecoveryPin: '' })
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('info')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setNotice('')
    if (!/^\d{6}$/.test(values.recoveryPin)) {
      setNoticeType('error')
      setNotice('Recovery PIN must be exactly 6 digits.')
      return
    }
    if (values.recoveryPin !== values.confirmRecoveryPin) {
      setNoticeType('error')
      setNotice('Recovery PINs do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await setAccountRecoveryPin(values.currentPassword, values.recoveryPin)
      setValues({ currentPassword: '', recoveryPin: '', confirmRecoveryPin: '' })
      setNoticeType('success')
      setNotice(result.message || 'Recovery PIN saved securely.')
    } catch (error) {
      setNoticeType('error')
      if (error.response?.status === 400 || error.response?.status === 401) {
        setNotice(error.response.data?.message || 'Could not verify your account details.')
      } else {
        console.error('Recovery PIN setup request failed.', error)
        setNotice(error.response?.data?.message || 'Recovery PIN could not be saved. Try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <h2 className="recovery-setup-heading">Set or update your Recovery PIN</h2>
      <p className="heading-description">Use a 6-digit PIN to securely recover your account if you forget your password.</p>
      <PasswordField
        id="recovery-setup-current-password"
        label="Current password"
        placeholder="Verify your current password"
        autoComplete="current-password"
        value={values.currentPassword}
        onChange={(event) => setValues((current) => ({ ...current, currentPassword: event.target.value }))}
      />
      <FormField
        id="recovery-setup-pin"
        label="Recovery PIN"
        placeholder="Create a 6-digit PIN"
        inputMode="numeric"
        maxLength={6}
        pattern="[0-9]{6}"
        autoComplete="off"
        value={values.recoveryPin}
        onChange={(event) => setValues((current) => ({ ...current, recoveryPin: event.target.value }))}
      />
      <FormField
        id="recovery-setup-pin-confirm"
        label="Confirm Recovery PIN"
        placeholder="Enter your PIN again"
        inputMode="numeric"
        maxLength={6}
        pattern="[0-9]{6}"
        autoComplete="off"
        value={values.confirmRecoveryPin}
        onChange={(event) => setValues((current) => ({ ...current, confirmRecoveryPin: event.target.value }))}
      />
      <FormNotice notice={notice} type={noticeType} />
      <button className="primary-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving Recovery PIN…' : 'Save Recovery PIN'}
      </button>
    </form>
  )
}

function PortalFootnote() {
  return (
    <footer className="portal-footnote">
      <span className="footnote-dot" />
      Northstar University · Library Services
      <span className="footnote-divider">·</span>
      <Link to="/login">Help &amp; support</Link>
    </footer>
  )
}
