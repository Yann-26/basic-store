import { motion, type HTMLMotionProps } from 'framer-motion'
import type { IconType } from 'react-icons'
import clsx from 'clsx'
import type { ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dark'
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconType
  iconPosition?: 'left' | 'right'
  loading?: boolean
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-gold text-primary-black hover:bg-gold-light',
  secondary: 'bg-white text-primary-black hover:bg-gold-pale',
  outline: 'border border-gold/60 text-gold hover:bg-gold hover:text-primary-black',
  ghost: 'text-white hover:bg-white/10',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  dark: 'bg-primary-black text-white hover:bg-dark-600 border border-white/10',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-sm',
  xl: 'px-10 py-5 text-base',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  icon: Icon,
  iconPosition = 'left',
  loading,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const inactive = disabled || loading
  return (
    <motion.button
      type={type}
      whileHover={{ scale: inactive ? 1 : 1.02 }}
      whileTap={{ scale: inactive ? 1 : 0.98 }}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold uppercase tracking-[0.15em] transition-all duration-200',
        variants[variant],
        sizes[size],
        inactive && 'cursor-not-allowed opacity-50',
        className,
      )}
      disabled={inactive}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="h-5 w-5" aria-hidden />}
          {children}
          {Icon && iconPosition === 'right' && <Icon className="h-5 w-5" aria-hidden />}
        </>
      )}
    </motion.button>
  )
}
