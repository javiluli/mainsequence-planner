import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@heroui/react'

type PageContainerProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode
}

export const PageContainer = ({ children, className, ...props }: PageContainerProps) => (
  <div className={cn('page-enter flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden p-3 sm:p-4 lg:p-6', className)} {...props}>
    {children}
  </div>
)
