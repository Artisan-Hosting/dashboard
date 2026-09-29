import { InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react';

// Text/password/email input styled with the shared `.field` class (mono by
// default, matching console.css's forms) instead of each page's own
// `border-gray-300 dark:border-gray-600 ...` Tailwind stack.
export const Field = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { sans?: boolean }>(
  ({ sans, className, ...props }, ref) => (
    <input ref={ref} className={`field ${sans ? 'field-sans' : ''} ${className ?? ''}`} {...props} />
  ),
);
Field.displayName = 'Field';

export const SelectField = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { sans?: boolean }>(
  ({ sans = true, className, children, ...props }, ref) => (
    <select ref={ref} className={`field ${sans ? 'field-sans' : ''} ${className ?? ''}`} {...props}>
      {children}
    </select>
  ),
);
SelectField.displayName = 'SelectField';
