import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

/** ラベル・入力・補足・エラーをまとめたフォーム行 */
function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string | undefined
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

export { Field }
