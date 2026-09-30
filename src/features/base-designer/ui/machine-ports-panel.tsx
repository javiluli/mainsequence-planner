import { Button } from '@heroui/react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useId, useState } from 'react'
import type { MachinePortState } from '../lib/connections'
import { machinePortKey, type MachinePort } from '../lib/ports'
import type { Direction } from '../model/catalog'

interface MachinePortsPanelProps {
  machineName: string
  ports: readonly MachinePortState[]
  onToggleOutput: (port: MachinePort) => void
}

const faceLabels: Record<Direction, string> = { north: 'North', east: 'East', south: 'South', west: 'West' }
const faces: readonly Direction[] = ['north', 'east', 'south', 'west']

function connectionLabel(port: MachinePortState): string {
  if (!port.accessible) return 'No floor access'
  switch (port.flow) {
    case 'input':
      return 'Input'
    case 'output':
      return 'Output'
    case 'disabled-output':
      return 'Output blocked'
    case null:
      return 'No belt'
  }
}

export function MachinePortsPanel({ machineName, ports, onToggleOutput }: MachinePortsPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const disabledCount = ports.filter((port) => !port.outputEnabled).length

  return (
    <section className="mt-3 border-t border-divider pt-2" aria-label={`I/O ports for ${machineName}`}>
      <Button
        size="sm"
        variant="light"
        className="h-auto min-h-8 w-full min-w-0 justify-between gap-2 rounded-sm px-1 text-xs"
        aria-expanded={expanded}
        aria-controls={contentId}
        onPress={() => setExpanded((current) => !current)}
        endContent={expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
      >
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="font-semibold">I/O ports</span>
          <span className="text-foreground/70 tabular-nums">
            {ports.length} ports{disabledCount ? ` · ${disabledCount} output${disabledCount === 1 ? '' : 's'} off` : ''}
          </span>
        </span>
      </Button>
      <div id={contentId} hidden={!expanded}>
        <p className="mt-1 text-xs text-foreground/70">
          Teal arrows enter; amber arrows leave. A red mark disables output only; inputs stay open. Hover a canvas port and press F to
          toggle output.
        </p>
        {ports.length ? (
          <div className="mt-3 space-y-3">
            {faces.map((face) => {
              const facePorts = ports.filter((port) => port.face === face)
              if (!facePorts.length) return null
              return (
                <div key={face}>
                  <h4 className="mb-1 text-xs font-medium text-foreground">{faceLabels[face]}</h4>
                  <ul aria-label={`${faceLabels[face]} ports`} className="divide-y divide-divider">
                    {facePorts.map((port) => {
                      const label = `${faceLabels[face]} cell ${port.offset + 1}`
                      const state = connectionLabel(port)
                      const stateId = `${contentId}-${machinePortKey(port)}-state`
                      return (
                        <li key={machinePortKey(port)} className="flex min-w-0 items-center gap-2 py-1">
                          <span className="shrink-0 text-xs text-foreground/75 tabular-nums">Cell {port.offset + 1}</span>
                          <span
                            id={stateId}
                            className={`min-w-0 flex-1 text-xs break-words ${port.flow === 'disabled-output' ? 'text-warning' : 'text-foreground/75'}`}
                          >
                            {state}
                          </span>
                          <Button
                            size="sm"
                            variant="flat"
                            className="min-w-0 shrink-0 rounded-sm px-2 text-xs"
                            aria-label={`${machineName}, ${label}: output enabled`}
                            aria-describedby={stateId}
                            aria-pressed={port.outputEnabled}
                            title={`${port.outputEnabled ? 'Disable' : 'Enable'} output; input stays available`}
                            onPress={() => onToggleOutput(port)}
                          >
                            Output {port.outputEnabled ? 'on' : 'off'}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
            <p className="text-xs text-foreground/65">
              Cell numbers run left to right on north/south faces, top to bottom on east/west faces.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-foreground/70">No I/O ports are defined for this structure.</p>
        )}
      </div>
    </section>
  )
}
