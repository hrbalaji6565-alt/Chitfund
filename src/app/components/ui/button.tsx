import React from 'react';

type ButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';

type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'default',
  className = '',
  children,
  ...props
}) => {
  // Variant styles - all linked to root variables
  const variantStyles: Record<ButtonVariant, string> = {
    default:
      'bg-[var(--gradient-primary)] hover:bg-[var(--gradient-primary-hover)] text-[var(--text-light)] rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-[var(--text-light)] rounded-xl shadow-lg h-12 px-6',

    destructive:
      'bg-[var(--btn-accent-bg)] text-[var(--text-light)] hover:bg-[var(--btn-accent-hover)] focus:ring-[var(--btn-accent-bg)]',

    outline:
      'border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-highlight)]',

    secondary:
      'bg-[var(--btn-secondary-bg)] text-[var(--text-light)] hover:bg-[var(--btn-secondary-hover)]',

    ghost:
      'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-highlight)]',

    link:
      'bg-transparent text-[var(--color-accent)] underline-offset-4 hover:underline',
  };

  // Size styles
  const sizeStyles: Record<ButtonSize, string> = {
    default: 'h-9 px-4 py-2 text-sm',
    sm: 'h-8 px-3 py-1.5 text-sm',
    lg: 'h-10 px-6 py-2.5 text-lg',
    icon: 'w-9 h-9 p-0',
    'icon-sm': 'w-8 h-8 p-0',
    'icon-lg': 'w-10 h-10 p-0',
  };

  // Common styles
  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--color-primary)]';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
