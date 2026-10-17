import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@heroui/react'

interface FlowNodeShellProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode
  selected?: boolean
}

/** Shared surface for every card rendered inside the production flow. */
export function FlowNodeShell({ children, selected = false, className, ...props }: FlowNodeShellProps) {
  return (
    <div
      className={cn(
        'relative w-64 overflow-hidden rounded-md border bg-content1 text-foreground transition-colors duration-150',
        selected ? 'border-primary' : 'border-divider/80 hover:border-foreground/50',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
