import { memo } from 'react'
import type { TreeListLineConfig } from './types'

interface TreeListLinesProps {
  depth: number
  isLast: boolean
  ancestorLineFlags: boolean[]
  lineConfig: TreeListLineConfig
}

const AncestorLine = ({ show, lineConfig }: { show: boolean; lineConfig: TreeListLineConfig }) => (
  <div className={`${lineConfig.indentWidthClass} relative`}>
    {show ? <span className={`absolute ${lineConfig.lineXClass} inset-y-0 w-px ${lineConfig.lineColorClass}`} /> : null}
  </div>
)

const CurrentLine = ({ isLast, lineConfig }: { isLast: boolean; lineConfig: TreeListLineConfig }) => (
  <div className={`${lineConfig.indentWidthClass} relative`}>
    <span className={`absolute ${lineConfig.lineXClass} top-0 ${isLast ? 'h-1/2' : 'h-full'} w-px ${lineConfig.lineColorClass}`} />
    <span className={`absolute ${lineConfig.lineXClass} ${lineConfig.lineYClass} h-px w-full ${lineConfig.lineColorClass}`} />
  </div>
)

/** Start the child spine at the parent's actual row center; fixed caps cannot account for wrapped labels. */
export const TreeListContinuation = ({ lineConfig }: { lineConfig: TreeListLineConfig }) => (
  <span
    aria-hidden
    className={`pointer-events-none absolute ${lineConfig.lineXClass} top-1/2 bottom-0 w-px ${lineConfig.lineColorClass}`}
  />
)

export const TreeListLines = memo(({ depth, isLast, ancestorLineFlags, lineConfig }: TreeListLinesProps) => {
  if (depth === 0) return null

  return (
    <div aria-hidden className="pointer-events-none flex shrink-0">
      {ancestorLineFlags.map((hasLine, index) => (
        <AncestorLine key={index} show={hasLine} lineConfig={lineConfig} />
      ))}
      <CurrentLine isLast={isLast} lineConfig={lineConfig} />
    </div>
  )
})
