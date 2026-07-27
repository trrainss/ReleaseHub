import { type SelectHTMLAttributes, forwardRef, useId } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', ...props }, ref) => {
    const id = useId();

    return (
      <div className="input-group">
        {label && <label className="input-group__label" htmlFor={id}>{label}</label>}
        <select
          id={id}
          ref={ref}
          className={`input ${error ? 'input--error' : ''} ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="input-group__error">{error}</span>}
      </div>
    );
  },
);

Select.displayName = 'Select';
