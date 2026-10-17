import { Button, Input, Listbox, ListboxItem, Modal, ModalBody, ModalContent, ModalHeader, Tab, Tabs } from '@heroui/react'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { items, itemById } from '@/shared/data'
import { AssetImage } from '@/shared/ui/asset-image'
import type { DroneStation } from '../model/scene'

const cargoItems = [...items].sort((a, b) => a.name.localeCompare(b.name))

/** Each selection confirms one catalog cargo immediately; search and active slot are editor-only context. */
export function DroneCargoDialog({
  station,
  slot,
  onSlotChange,
  onChoose,
  onClose,
}: {
  station: DroneStation
  slot: 0 | 1
  onSlotChange: (slot: 0 | 1) => void
  onChoose: (itemId: string | null) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    return cargoItems.filter((item) => item.name.toLocaleLowerCase().includes(search))
  }, [query])
  const current = station.cargo[slot]
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      size="lg"
      radius="sm"
      placement="center"
      scrollBehavior="inside"
      disableAnimation
    >
      <ModalContent onKeyDown={(event) => event.stopPropagation()}>
        <ModalHeader className="border-b border-divider">Drone cargo</ModalHeader>
        <ModalBody className="gap-4 py-5">
          <Tabs
            aria-label="Drone outputs"
            selectedKey={String(slot)}
            disableAnimation
            onSelectionChange={(key) => {
              if (key === '0' || key === '1') {
                onSlotChange(key === '0' ? 0 : 1)
                setQuery('')
              }
            }}
          >
            <Tab key="0" title="Cargo 1" />
            <Tab key="1" title="Cargo 2" />
          </Tabs>
          <div className="flex min-w-0 items-center gap-3 rounded-md bg-content2 px-3 py-2">
            {current && <AssetImage kind="items" id={current} width={28} alt="" />}
            <span className="min-w-0 flex-1 truncate text-sm">{current ? itemById.get(current)?.name : 'No cargo assigned'}</span>
            <Button size="sm" variant="light" isDisabled={!current} onPress={() => onChoose(null)}>
              Clear cargo
            </Button>
          </div>
          <Input autoFocus label="Search products" value={query} onValueChange={setQuery} startContent={<Search size={16} aria-hidden />} />
          <Listbox
            // Collection items cache callbacks by identity; each cargo context needs its own collection.
            key={`${station.id}:${slot}`}
            aria-label={`Products for cargo ${slot + 1}`}
            items={filtered}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={current ? [current] : []}
            emptyContent="No matching products"
            className="max-h-80 overflow-y-auto"
          >
            {(item) => (
              <ListboxItem
                key={item.id}
                textValue={item.name}
                onPress={() => onChoose(item.id)}
                startContent={<AssetImage kind="items" id={item.id} width={28} alt="" />}
              >
                {item.name}
              </ListboxItem>
            )}
          </Listbox>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
