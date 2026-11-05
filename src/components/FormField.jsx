import './FormField.css'

function FormField({
  id,
  name = id,
  label,
  type = 'text',
  placeholder,
  inputMode,
  maxLength,
  pattern,
  autoComplete,
  value,
  onChange,
  error,
  as = 'input',
  options = [],
}) {
  const controlProps = {
    id,
    name,
    value,
    onChange,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : undefined,
    autoComplete,
    inputMode,
    maxLength,
    pattern,
    className: 'field-control',
  }

  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <label className="field-label" htmlFor={id}>{label}</label>
      {as === 'select' ? (
        <select {...controlProps}>
          <option value="">Select an option</option>
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>{optionLabel}</option>
          ))}
        </select>
      ) : (
        <input {...controlProps} type={type} placeholder={placeholder} />
      )}
      {error && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}
    </div>
  )
}

export default FormField
