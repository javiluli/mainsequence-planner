import type { ReactNode } from 'react'

export const AccordionItemContent = ({ children }: { children: ReactNode }) => {
  return <div className="grid gap-4 py-2">{children}</div>
}
