import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

// Wraps the .btn/.btn-primary/.btn-ghost/.btn-danger classes from
// console.css (see globals.css) so every page shares one button instead of
// re-picking Tailwind colors (bg-blue-600, bg-red-600, ...) per call site.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', small, className, ...props }, ref) => (
    <button
      ref={ref}
      className={`btn ${variantClass[variant]} ${small ? 'btn-sm' : ''} ${className ?? ''}`}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
