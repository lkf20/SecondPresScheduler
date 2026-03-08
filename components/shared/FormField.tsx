import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ReactNode, useId, cloneElement, isValidElement } from 'react'

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
  description?: string
}

export default function FormField({
  label,
  error,
  required,
  children,
  className,
  description,
}: FormFieldProps) {
  const id = useId()
  const labelledChild = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ id?: string }>, { id })
    : children

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {labelledChild}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
