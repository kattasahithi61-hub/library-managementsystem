import './PasswordRules.css'
import { getPasswordChecks } from '../utils/passwordValidation.js'

function PasswordRules({ password }) {
  const checks = getPasswordChecks(password)

  return (
    <div className="password-rules" aria-live="polite">
      <p className="rules-heading">Your password must include</p>
      <ul>
        {checks.map((check) => (
          <li className={check.valid ? 'rule--valid' : ''} key={check.label}>
            <span className="rule-indicator" aria-hidden="true">{check.valid ? '✓' : ''}</span>
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default PasswordRules
