import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import clsx from 'clsx'
import type { IconType } from 'react-icons'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: IconType
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, hint, icon: Icon, className, id, ...props }, ref) => {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium uppercase tracking-[0.15em] text-gray-300">
          {label}
          {props.required && <span className="text-gold"> *</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Icon className="h-5 w-5 text-gray-500" aria-hidden />
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={clsx('field', Icon && 'pl-11', error && '!border-red-500', className)}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-red-400">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${inputId}-hint`} className="text-xs text-gray-500">
            {hint}
          </p>
        )
      )}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
