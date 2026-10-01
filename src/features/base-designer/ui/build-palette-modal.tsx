import { Button, Input, Modal, ModalBody, ModalContent, ModalHeader, cn } from '@heroui/react'
import { Search } from 'lucide-react'
import { useState } from 'react'
import {
  CELL_SIZE,
  LOGISTICS_TYPES,
  MACHINE_TYPES,
  PLACEABLES,
  STATION_TYPES,
  type EditorTool,
  type PlaceableType,
  type StationType,
} from '../model/catalog'
import { BeltTile, MachineTile } from './station-node'
import { DroneStationArtwork } from './station-artwork'

interface BuildPaletteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tool: EditorTool
  onSelect: (type: PlaceableType) => void
  onAddStation: (type: StationType) => void
}

/** Palette thumbnails reuse the actual plan artwork, scaled uniformly to fit a compact card. */
function PartButton({ type, active, onSelect }: { type: PlaceableType; active: boolean; onSelect: (type: PlaceableType) => void }) {
  const part = PLACEABLES[type]
  const width = part.width * CELL_SIZE
  const height = part.height * CELL_SIZE
  const scale = Math.min(part.category === 'machine' ? 1.45 : 2.2, 58 / Math.max(width, height))
  const placement = {
    id: `palette-${type}`,
    type,
    x: 0,
    y: 0,
    direction: type === 'material_lab' || type === 'computation_lab' ? ('south' as const) : ('east' as const),
  }

  return (
    <Button
      variant="flat"
      className={cn(
        'h-28 min-w-0 flex-col justify-between gap-2 rounded-sm border px-2 py-3 text-center',
        active ? 'border-primary bg-primary/10' : 'border-transparent bg-content2/80 hover:border-divider hover:bg-content2',
      )}
      onPress={() => onSelect(type)}
      aria-pressed={active}
      title={part.label}
    >
      <span className="flex h-16 w-full items-center justify-center" aria-hidden>
        <span className="relative block shrink-0" style={{ width: width * scale, height: height * scale }}>
          <span
            className="absolute top-0 left-0 block"
            style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          >
            {part.category === 'machine' ? (
              <MachineTile occupied={new Map()} placement={placement} />
            ) : (
              <BeltTile occupied={new Map()} placement={placement} />
            )}
          </span>
        </span>
      </span>
      <span className="flex w-full flex-col items-center gap-0.5">
        <span className="w-full truncate text-[11px] font-semibold uppercase tracking-wide">{part.label}</span>
      </span>
    </Button>
  )
}

function StationThumbnail({ type }: { type: StationType }) {
  const size = STATION_TYPES[type].footprintCells
  const patternId = `station-palette-grid-${type}`
  if (type === 'drone_station') {
    return (
      <span className="relative block size-11 shrink-0" aria-hidden>
        <span className="absolute left-0 top-0 size-[280px] origin-top-left scale-[0.15714]">
          <DroneStationArtwork
            station={{ id: 'palette-drone', type, name: 'Drone Station', position: { x: 0, y: 0 }, placements: [], lockedTo: [] }}
          />
        </span>
      </span>
    )
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={cn('shrink-0 text-primary', size === 14 ? 'size-11' : 'size-13')} aria-hidden>
      <defs>
        <pattern id={patternId} width="1" height="1" patternUnits="userSpaceOnUse">
          <rect
            x="0.12"
            y="0.12"
            width="0.76"
            height="0.76"
            rx="0.13"
            fill="#282523"
            stroke="currentColor"
            strokeOpacity="0.6"
            strokeWidth="0.08"
          />
        </pattern>
      </defs>
      <rect x="0.15" y="0.15" width={size - 0.3} height={size - 0.3} fill="#201f1d" stroke="currentColor" strokeWidth="0.3" />
      <rect x="0.35" y="0.35" width={size - 0.7} height={size - 0.7} fill={`url(#${patternId})`} />
    </svg>
  )
}

const paletteGroups = [
  { id: 'production', label: 'Production' },
  { id: 'power', label: 'Power' },
  { id: 'storage', label: 'Storage' },
  { id: 'logistics', label: 'Logistics' },
] as const

export function BuildPaletteModal({ open, onOpenChange, tool, onSelect, onAddStation }: BuildPaletteModalProps) {
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<PlaceableType[]>([])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matches = (label: string) => label.toLocaleLowerCase().includes(normalizedQuery)
  const stations = (Object.entries(STATION_TYPES) as [StationType, (typeof STATION_TYPES)[StationType]][]).filter(([, station]) =>
    matches(station.label),
  )
  const matchingParts = [...MACHINE_TYPES, ...LOGISTICS_TYPES].filter((type) => matches(PLACEABLES[type].label))
  const recentMatches = normalizedQuery ? [] : recent

  const selectPart = (type: PlaceableType) => {
    setRecent((current) => [type, ...current.filter((entry) => entry !== type)].slice(0, 5))
    setQuery('')
    onSelect(type)
    onOpenChange(false)
  }
  const addStation = (type: StationType) => {
    setQuery('')
    onAddStation(type)
    onOpenChange(false)
  }
  const cards = (types: readonly PlaceableType[]) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {types.map((type) => (
        <PartButton key={type} type={type} active={tool === type} onSelect={selectPart} />
      ))}
    </div>
  )

  return (
    <Modal
      disableAnimation
      isOpen={open}
      onOpenChange={onOpenChange}
      size="5xl"
      scrollBehavior="inside"
      classNames={{ base: 'rounded-sm bg-content1' }}
    >
      <ModalContent>
        <ModalHeader className="border-b border-divider">Build menu</ModalHeader>
        <ModalBody className="gap-5 py-5">
          <Input
            type="search"
            aria-label="Search buildables"
            placeholder="Search stations, machines or logistics…"
            size="sm"
            value={query}
            onValueChange={setQuery}
            startContent={<Search size={16} aria-hidden className="text-foreground/55" />}
            classNames={{ inputWrapper: 'rounded-sm border border-divider bg-content2 shadow-none' }}
          />
          {stations.length > 0 ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Stations</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {stations.map(([type, station]) => (
                  <Button
                    key={type}
                    variant="flat"
                    className="h-20 justify-start gap-3 rounded-sm bg-content2 px-3"
                    onPress={() => addStation(type)}
                    startContent={<StationThumbnail type={type} />}
                  >
                    <span className="flex min-w-0 flex-col items-start gap-1 text-left">
                      <span className="truncate text-xs font-semibold">{station.label}</span>
                      <span className="font-mono text-[10px] opacity-65">
                        {station.footprintCells}×{station.footprintCells} {type === 'drone_station' ? 'module · outputs only' : 'cells'}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            </section>
          ) : null}
          {recentMatches.length > 0 ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Last used</h3>
              {cards(recentMatches)}
            </section>
          ) : null}
          {paletteGroups.map((group) => {
            const types = matchingParts.filter((type) => PLACEABLES[type].paletteGroup === group.id)
            return types.length > 0 ? (
              <section key={group.id}>
                <h3 className="mb-2 text-sm font-semibold">{group.label}</h3>
                {cards(types)}
              </section>
            ) : null
          })}
          {stations.length + matchingParts.length === 0 ? (
            <p className="py-8 text-center text-sm text-foreground/60">No buildables match “{query}”.</p>
          ) : null}
          <p className="border-t border-divider pt-3 text-xs text-foreground/60">
            Choose a buildable, then click the floor. Middle-click an existing part to pick its tool; right-click or Escape returns to
            Select.
          </p>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
