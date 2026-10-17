import { Button, Input, Modal, ModalBody, ModalContent, ModalHeader, Tooltip } from '@heroui/react'
import { Factory, Grid2X2, LayoutGrid, MousePointer2, Route, Search, Boxes, Zap, Clock3, ChartNoAxesCombined } from 'lucide-react'
import { useState } from 'react'
import { BUILDINGS, type BuildingType } from '../model/buildings'
import { BELTS, SPLITTERS, TUNNELS } from '../model/logistics'
import { CatalogArtwork } from './catalog-artwork'
import type { EditorTool } from '../lib/tool-drafts'

const categories = [
  { label: 'Stations', icon: Grid2X2 },
  { label: 'Buildings', icon: Factory },
  { label: 'Logistics', icon: Route },
  { label: 'Storage', icon: Boxes },
  { label: 'Power', icon: Zap },
] as const

/** Catalog tools keep stable source keys; recent choices are session-only and never persist layout data. */
interface CatalogEntry {
  id: string
  label: string
  category: (typeof categories)[number]['label']
  tool: EditorTool
  keywords?: string
}
const entries: CatalogEntry[] = [
  { id: 'station', label: 'Station 1×1', category: 'Stations', tool: { kind: 'place', item: { kind: 'station' } } },
  {
    id: 'station_2x2_a',
    label: 'Station 2×2 A',
    category: 'Stations',
    tool: { kind: 'place', item: { kind: 'station', type: 'station_2x2_a' } },
  },
  {
    id: 'drone',
    label: 'Drone Station',
    category: 'Stations',
    tool: { kind: 'place', item: { kind: 'station', type: 'drone', rotation: 0, cargo: [null, null] } },
  },
  ...(Object.keys(BUILDINGS) as BuildingType[]).map((type): CatalogEntry => ({
    id: type,
    label: BUILDINGS[type].label,
    category: BUILDINGS[type].category,
    keywords: BUILDINGS[type].marking,
    tool: { kind: 'place', item: { kind: 'building', type, rotation: 0 } },
  })),
  ...(Object.keys(BELTS) as (keyof typeof BELTS)[]).map((type): CatalogEntry => ({
    id: type,
    label: BELTS[type].label,
    category: 'Logistics',
    tool: { kind: 'belt', type, points: [] },
  })),
  ...(Object.keys(TUNNELS) as (keyof typeof TUNNELS)[]).map((type): CatalogEntry => ({
    id: type,
    label: TUNNELS[type].label,
    category: 'Logistics',
    tool: { kind: 'tunnel', type },
  })),
  ...(Object.keys(SPLITTERS) as (keyof typeof SPLITTERS)[]).map((type): CatalogEntry => ({
    id: type,
    label: SPLITTERS[type].label,
    category: 'Logistics',
    tool: { kind: 'place', item: { kind: 'splitter', type, rotation: 0 } },
  })),
]

/** Search, recent choices and static scene thumbnails share one compact grouped catalog. */
export function EditorPalette({
  tool,
  isOpen,
  onOpenChange,
  onChoose,
  productionOpen,
  onProductionToggle,
}: {
  tool: EditorTool
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (tool: EditorTool) => void
  productionOpen: boolean
  onProductionToggle: () => void
}) {
  const [artwork, setArtwork] = useState<Readonly<Record<string, string>> | null>(null)
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const filtered = entries.filter((entry) =>
    words.every((word) => (entry.label + ' ' + entry.category + ' ' + (entry.keywords ?? '')).toLowerCase().includes(word)),
  )
  const changeOpen = (open: boolean) => {
    if (!open) setQuery('')
    onOpenChange(open)
  }
  return (
    <>
      {isOpen && !artwork && <CatalogArtwork onReady={setArtwork} />}
      <div
        role="toolbar"
        aria-label="Base tools"
        aria-orientation="vertical"
        className="flex w-13 shrink-0 flex-col items-center justify-center gap-2 border-r border-divider bg-content1 py-3"
      >
        <Tooltip content="Select (Escape)" placement="right">
          <Button
            isIconOnly
            size="sm"
            variant={tool.kind === 'select' ? 'flat' : 'light'}
            color={tool.kind === 'select' ? 'warning' : 'default'}
            aria-label="Select"
            aria-pressed={tool.kind === 'select'}
            onPress={() => onChoose({ kind: 'select' })}
          >
            <MousePointer2 size={18} aria-hidden />
          </Button>
        </Tooltip>
        <Tooltip content="Element catalog" placement="right">
          <Button
            isIconOnly
            size="sm"
            variant={tool.kind !== 'select' || isOpen ? 'flat' : 'light'}
            color={tool.kind !== 'select' || isOpen ? 'warning' : 'default'}
            aria-label="Element catalog"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            onPress={() => onOpenChange(true)}
          >
            <LayoutGrid size={18} aria-hidden />
          </Button>
        </Tooltip>
        <Tooltip content="Production" placement="right">
          <Button
            isIconOnly
            size="sm"
            variant={productionOpen ? 'flat' : 'light'}
            color={productionOpen ? 'warning' : 'default'}
            aria-label="Production"
            aria-expanded={productionOpen}
            aria-controls={productionOpen ? 'base-production-panel' : undefined}
            onPress={onProductionToggle}
          >
            <ChartNoAxesCombined size={18} aria-hidden />
          </Button>
        </Tooltip>
      </div>
      <Modal
        isOpen={isOpen}
        onOpenChange={changeOpen}
        size="3xl"
        className="max-w-[min(72rem,calc(100vw-2rem))]"
        radius="sm"
        placement="center"
        scrollBehavior="inside"
        disableAnimation
      >
        <ModalContent onKeyDown={(event) => event.stopPropagation()}>
          {(close) => {
            const choose = (entry: CatalogEntry) => {
              setRecent((previous) => [entry.id, ...previous.filter((id) => id !== entry.id)].slice(0, 6))
              close()
              requestAnimationFrame(() => onChoose(entry.tool))
            }
            const cards = (list: CatalogEntry[]) => (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {list.map((entry) => (
                  <CatalogCard key={entry.id} entry={entry} image={artwork?.[entry.id]} onPress={() => choose(entry)} />
                ))}
              </div>
            )
            return (
              <>
                <ModalHeader className="border-b border-divider">Element catalog</ModalHeader>
                <div className="px-6 pt-4">
                  <Input
                    autoFocus
                    size="sm"
                    label="Search elements"
                    placeholder="Name or category"
                    value={query}
                    onValueChange={setQuery}
                    isClearable
                    onClear={() => setQuery('')}
                    startContent={<Search size={16} aria-hidden />}
                  />
                </div>
                <ModalBody className="gap-5 py-4">
                  {!words.length && recent.length > 0 && (
                    <section aria-labelledby="catalog-recent">
                      <h2 id="catalog-recent" className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Clock3 size={16} aria-hidden />
                        Recent
                      </h2>
                      {cards(recent.map((id) => entries.find((entry) => entry.id === id)!))}
                    </section>
                  )}
                  {categories.map(({ label, icon: Icon }) => {
                    const matches = filtered.filter((entry) => entry.category === label)
                    return matches.length ? (
                      <section key={label} aria-labelledby={'catalog-' + label.toLowerCase()}>
                        <h2 id={'catalog-' + label.toLowerCase()} className="mb-2 flex items-center gap-2 text-sm font-medium">
                          <Icon size={16} aria-hidden />
                          {label}
                        </h2>
                        {cards(matches)}
                      </section>
                    ) : null
                  })}
                  {!filtered.length && (
                    <p role="status" className="py-6 text-center text-sm text-foreground-500">
                      No matching elements. Try another name or category.
                    </p>
                  )}
                </ModalBody>
              </>
            )
          }}
        </ModalContent>
      </Modal>
    </>
  )
}

/** Equal preview and label slots align compact tiles even when an element name wraps. */
function CatalogCard({ entry, image, onPress }: { entry: CatalogEntry; image?: string; onPress: () => void }) {
  return (
    <Button
      onPress={onPress}
      variant="flat"
      aria-label={entry.label}
      className="h-32 min-w-0 flex-col justify-start gap-1 rounded-md bg-content2 p-2 text-center"
    >
      <span className="flex h-18 w-full shrink-0 items-center justify-center">
        {image && <img src={image} alt="" className="max-h-18 max-w-24 object-contain" />}
      </span>
      <span className="flex h-9 w-full min-w-0 items-center justify-center whitespace-normal text-sm font-medium leading-4">
        {entry.label}
      </span>
    </Button>
  )
}
