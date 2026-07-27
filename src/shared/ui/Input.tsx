import { type InputHTMLAttributes, forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    const id = useId();

    return (
      <div className="input-group">
        {label && <label className="input-group__label" htmlFor={id}>{label}</label>}
        <input
          id={id}
          ref={ref}
          className={`input ${error ? 'input--error' : ''} ${className}`}
          {...props}
        />
        {error && <span className="input-group__error">{error}</span>}
      </div>
    );
  },
);

Input.displayName = 'Input';
