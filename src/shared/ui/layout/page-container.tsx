import type { HTMLAttributes } from 'react'

import { cn } from '@heroui/react'

/** Edge-to-edge route shell; callers own any padding and section gaps through className. */
export const PageContainer = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('page-enter flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden', className)} {...props}>
    {children}
  </div>
)
