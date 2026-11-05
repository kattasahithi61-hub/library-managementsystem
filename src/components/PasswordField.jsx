import { useState } from 'react'
import './PasswordField.css'

function PasswordField({
  id,
  name = id,
  label,
  placeholder,
  autoComplete,
  value,
  onChange,
  error,
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={`field password-field ${error ? 'field--error' : ''}`}>
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="password-control-wrap">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="field-control password-control"
        />
        <button
          className="password-visibility"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? (
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m3 3 14 14M8.6 8.7a2 2 0 0 0 2.7 2.7M7.1 5.5A8.8 8.8 0 0 1 10 5c4.3 0 7 5 7 5a12 12 0 0 1-2.2 2.8M5.2 6.7C3.7 7.8 3 10 3 10s2.7 5 7 5a8.6 8.6 0 0 0 2.4-.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 10s2.7-5 7-5 7 5 7 5-2.7 5-7 5-7-5-7-5Z" />
              <circle cx="10" cy="10" r="2" />
            </svg>
          )}
        </button>
      </div>
      {error && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}
    </div>
  )
}

export default PasswordField
