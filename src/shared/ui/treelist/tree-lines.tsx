import { memo } from 'react'
import type { TreeListLineConfig } from './types'

interface TreeListLinesProps {
  depth: number
  isLast: boolean
  ancestorLineFlags: boolean[]
  lineConfig: TreeListLineConfig
}

const LineCap = ({ lineConfig }: { lineConfig: TreeListLineConfig }) => (
  <div
    className={`absolute ${lineConfig.lineXClass} w-0.5 ${lineConfig.lineColorClass}`}
    style={{ top: -lineConfig.capExtensionPx, height: lineConfig.capExtensionPx }}
  />
)

const AncestorLine = ({ show, lineConfig }: { show: boolean; lineConfig: TreeListLineConfig }) => (
  <div className={`${lineConfig.indentWidthClass} relative`}>
    {show ? (
      <>
        <LineCap lineConfig={lineConfig} />
        <div className={`absolute ${lineConfig.lineXClass} top-0 bottom-0 w-0.5 ${lineConfig.lineColorClass}`} />
      </>
    ) : null}
  </div>
)

const CurrentLine = ({ isLast, lineConfig }: { isLast: boolean; lineConfig: TreeListLineConfig }) => (
  <div className={`${lineConfig.indentWidthClass} relative`}>
    <LineCap lineConfig={lineConfig} />
    <div className={`absolute ${lineConfig.lineXClass} ${isLast ? 'h-1/2 top-0' : 'h-full top-0'} w-0.5 ${lineConfig.lineColorClass}`} />
    <div
      className={`absolute ${lineConfig.lineXClass} ${lineConfig.lineYClass} ${lineConfig.lineGapClass} h-0.5 ${lineConfig.lineColorClass}`}
    />
  </div>
)

export const TreeListLines = memo(({ depth, isLast, ancestorLineFlags, lineConfig }: TreeListLinesProps) => {
  if (depth === 0) return null

  return (
    <div className="flex shrink-0">
      {ancestorLineFlags.map((hasLine, index) => (
        <AncestorLine key={index} show={hasLine} lineConfig={lineConfig} />
      ))}
      <CurrentLine isLast={isLast} lineConfig={lineConfig} />
    </div>
  )
})
