import { Button, Input } from '@heroui/react'
import { Copy, LocateFixed, RotateCw, Search, Settings2, Trash2, X } from 'lucide-react'
import { useId, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import type { LayoutInventoryEntry } from '../lib/inventory'
import { beltIncoming, beltOutputs } from '../lib/connections'
import { recipeForPlaceable, recipeLabel, recipesForPlaceable } from '../lib/machine-recipes'
import type { BaseStation } from '../lib/placement'
import { PLACEABLES, isSplitterType, type Direction } from '../model/catalog'

export interface LayoutInventoryHandle {
  focusEntry: (key?: string | null) => void
  containsFocus: () => boolean
}

interface LayoutInventoryPanelProps {
  ref: Ref<LayoutInventoryHandle>
  entries: readonly LayoutInventoryEntry[]
  stations: readonly BaseStation[]
  selectedKey: string | null
  onSelect: (entry: LayoutInventoryEntry) => void
  onLocate: (entry: LayoutInventoryEntry) => void
  onInspect: () => void
  onCopy: () => void
  onRotate: () => void
  onDelete: () => void
  onClose: () => void
}

const directionLabels: Record<Direction, string> = { north: 'North', east: 'East', south: 'South', west: 'West' }

function entryDescription(entry: LayoutInventoryEntry, stationNames: ReadonlyMap<string, string>): string {
  const names = entry.stationIds.map((id) => stationNames.get(id) ?? id).join(' · ')
  const direction = entry.directions.length === 1 ? directionLabels[entry.directions[0]] : 'Mixed directions'
  const recipe = recipeForPlaceable(entry.placement.type, entry.placement.recipeId)
  const recipeName = recipe
    ? recipeLabel(recipe)
    : recipesForPlaceable(entry.placement.type).length
      ? 'No recipe assigned'
      : 'No catalog recipe'
  const portDescription = isSplitterType(entry.placement.type)
    ? ` · Input: ${directionLabels[beltIncoming(entry.placement)]} · Outputs: ${beltOutputs(entry.placement)
        .map((face) => directionLabels[face])
        .join(', ')}`
    : ''
  const detail =
    entry.kind === 'route'
      ? `${entry.cellCount} cells · ${direction}`
      : `${direction}${portDescription}${PLACEABLES[entry.placement.type].category === 'machine' ? ` · ${recipeName}` : ''}`
  return `${entry.kind === 'route' ? 'Stations' : 'Owner'}: ${names}. ${detail}`
}

export function LayoutInventoryPanel({
  ref,
  entries,
  stations,
  selectedKey,
  onSelect,
  onLocate,
  onInspect,
  onCopy,
  onRotate,
  onDelete,
  onClose,
}: LayoutInventoryPanelProps) {
  const [query, setQuery] = useState('')
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const rootRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const instructionsId = useId()
  const stationNames = useMemo(() => new Map(stations.map((station) => [station.id, station.name])), [stations])
  const rows = useMemo(
    () =>
      entries.map((entry) => ({
        entry,
        label: PLACEABLES[entry.placement.type].label,
        description: entryDescription(entry, stationNames),
      })),
    [entries, stationNames],
  )
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matches = normalizedQuery
    ? rows.filter((row) => `${row.label} ${row.description}`.toLocaleLowerCase().includes(normalizedQuery))
    : rows
  const preferredKey = focusedKey ?? selectedKey
  const tabKey = matches.some((row) => row.entry.key === preferredKey) ? preferredKey : matches[0]?.entry.key
  const selected = rows.find((row) => row.entry.key === selectedKey)

  useImperativeHandle(ref, () => ({
    focusEntry(key) {
      const target = matches.find((row) => row.entry.key === key) ?? matches[0]
      if (target) {
        setFocusedKey(target.entry.key)
        buttons.current.get(target.entry.key)?.focus({ preventScroll: true })
        buttons.current.get(target.entry.key)?.scrollIntoView({ block: 'nearest' })
      } else searchRef.current?.focus({ preventScroll: true })
    },
    containsFocus: () => Boolean(rootRef.current?.contains(document.activeElement)),
  }))

  const navigate = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || !matches.length) return
    const index = matches.findIndex((row) => row.entry.key === focusedKey)
    const next =
      event.key === 'ArrowDown'
        ? Math.min(matches.length - 1, index + 1)
        : event.key === 'ArrowUp'
          ? Math.max(0, index - 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? matches.length - 1
              : null
    if (next === null) return
    event.preventDefault()
    event.stopPropagation()
    const key = matches[next].entry.key
    setFocusedKey(key)
    buttons.current.get(key)?.focus()
    buttons.current.get(key)?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <aside
      ref={rootRef}
      id="base-layout-inventory"
      aria-label="Layout inventory"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }
      }}
      className="flex min-h-0 w-full shrink-0 flex-col bg-content1 md:flex-1 md:shrink md:overflow-hidden"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-divider px-3 py-2">
        <h2 className="text-sm font-semibold">
          Inventory <span className="text-foreground/65 tabular-nums">({entries.length})</span>
        </h2>
        <Button isIconOnly size="sm" variant="light" aria-label="Close inventory" onPress={onClose}>
          <X size={16} aria-hidden />
        </Button>
      </div>
      <div className="shrink-0 px-3 pt-3">
        <Input
          ref={searchRef}
          aria-label="Search layout inventory"
          type="search"
          size="sm"
          placeholder="Machine, recipe or station…"
          value={query}
          onValueChange={setQuery}
          startContent={<Search size={14} aria-hidden />}
          classNames={{ inputWrapper: 'rounded-sm border border-divider bg-content2 shadow-none' }}
        />
        <p id={instructionsId} className="mt-2 text-xs text-foreground/70">
          Arrows move focus. Enter selects. Routes appear once.
        </p>
      </div>
      <ul
        role="listbox"
        aria-label="Placed machines, logistics and routes"
        aria-describedby={instructionsId}
        onKeyDown={navigate}
        className="shrink-0 overscroll-contain px-3 py-2 md:min-h-0 md:flex-1 md:shrink md:overflow-y-auto"
      >
        {matches.map(({ entry, label, description }) => (
          <li role="presentation" key={entry.key} className="mb-1 last:mb-0">
            <Button
              ref={(button: HTMLButtonElement | null) => {
                if (button) buttons.current.set(entry.key, button)
                else buttons.current.delete(entry.key)
              }}
              role="option"
              aria-selected={entry.key === selectedKey}
              tabIndex={entry.key === tabKey ? 0 : -1}
              variant="light"
              onFocus={() => setFocusedKey(entry.key)}
              onPress={() => onSelect(entry)}
              className={`h-auto w-full min-w-0 flex-col items-start gap-1 rounded-sm px-2 py-2 text-left ${entry.key === selectedKey ? 'bg-primary/10' : ''}`}
            >
              <span className="text-xs font-medium text-foreground">
                {label}
                {entry.kind === 'route' ? ' · route' : ''}
              </span>
              <span className="w-full text-xs whitespace-normal text-foreground/75">{description}</span>
            </Button>
          </li>
        ))}
        {!matches.length ? (
          <li role="presentation" className="py-3 text-xs text-foreground/70">
            {entries.length ? 'No matching parts. Change the search.' : 'No parts placed yet. Open Build to add machines and belts.'}
          </li>
        ) : null}
      </ul>
      {selected ? (
        <div className="shrink-0 border-t border-divider p-3">
          <p className="mb-2 text-xs font-medium">
            Selected: {selected.label}
            {selected.entry.kind === 'route' ? ' route' : ''}
          </p>
          <div role="group" aria-label="Selected part actions" className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="flat" onPress={() => onLocate(selected.entry)} startContent={<LocateFixed size={14} aria-hidden />}>
              Locate
            </Button>
            {PLACEABLES[selected.entry.placement.type].category === 'machine' ? (
              <Button size="sm" variant="flat" onPress={onInspect} startContent={<Settings2 size={14} aria-hidden />}>
                Settings
              </Button>
            ) : null}
            <Button size="sm" variant="flat" onPress={onCopy} startContent={<Copy size={14} aria-hidden />}>
              Copy
            </Button>
            <Button
              size="sm"
              variant="flat"
              isDisabled={selected.entry.kind === 'route'}
              onPress={onRotate}
              startContent={<RotateCw size={14} aria-hidden />}
            >
              Rotate
            </Button>
            <Button size="sm" variant="flat" color="danger" onPress={onDelete} startContent={<Trash2 size={14} aria-hidden />}>
              Delete
            </Button>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
